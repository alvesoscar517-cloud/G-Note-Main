import { useEffect, useCallback, useState } from 'react'
import { useDebouncedCallback } from 'use-debounce'
import { LayoutGroup } from 'framer-motion'
import { useAuthStore } from '@/stores/authStore'
import { useNotesStore } from '@/stores/notesStore'
import { useThemeStore } from '@/stores/themeStore'
import { useNetworkStore } from '@/stores/networkStore'
import { LoginScreen } from '@/components/auth/LoginScreen'
import { DrivePermissionError } from '@/components/auth/DrivePermissionError'
import { Header } from '@/components/layout/Header'
import { VirtualizedNotesList } from '@/components/notes/VirtualizedNotesList'
import { NoteModal } from '@/components/notes/NoteModal'
import { PublicNoteView } from '@/components/notes/PublicNoteView'
import { WebContentDialog } from '@/components/notes/WebContentDialog'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { useBlockContextMenu } from '@/components/ui/ContextMenuBlocker'
import { AppErrorBoundary, ListErrorBoundary, ModalErrorBoundary } from '@/components/ui/ErrorBoundary'
import { initOfflineSync } from '@/lib/offlineSync'
import { isTokenExpired } from '@/lib/tokenRefresh'
import { chromeRefreshToken, isChromeExtension } from '@/lib/chromeAuth'
import { getValidAccessToken } from '@/lib/tokenManager'

// Check for public view mode
function getViewFileId(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('view')
}

function AppContent() {
  const { user, setUser } = useAuthStore()
  const { syncWithDrive, checkDriveHasData, loadSharedNotes, initOfflineStorage, syncError } = useNotesStore()
  const { initTheme } = useThemeStore()
  const initNetwork = useNetworkStore(state => state.initialize)
  const isOnline = useNetworkStore(state => state.isOnline)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showPermissionError, setShowPermissionError] = useState(false)
  
  // Block default context menu globally
  useBlockContextMenu()
  
  const viewFileId = getViewFileId()
  
  // Initialize network status monitoring and offline storage
  useEffect(() => {
    const cleanupNetwork = initNetwork()
    const cleanupOfflineSync = initOfflineSync()
    
    // Initialize offline storage (IndexedDB)
    initOfflineStorage()
    
    return () => {
      cleanupNetwork()
      cleanupOfflineSync()
    }
  }, [initNetwork, initOfflineStorage])

  // Debounced sync - wait 2s after last change before syncing
  const debouncedSync = useDebouncedCallback(async () => {
    if (!user?.accessToken || isTokenExpired(user.tokenExpiry)) return
    if (!isOnline) return // Don't sync when offline
    await syncWithDrive(user.accessToken)
  }, 2000)

  // Initialize theme on mount
  useEffect(() => {
    initTheme()
  }, [])

  // Show permission error dialog when sync fails due to permission
  useEffect(() => {
    if (syncError === 'DRIVE_PERMISSION_DENIED') {
      setShowPermissionError(true)
    }
  }, [syncError])

  // Chrome Extension token refresh
  const checkAndRefreshToken = useCallback(async () => {
    if (!user || isRefreshing || !isChromeExtension()) return false
    
    if (isTokenExpired(user.tokenExpiry)) {
      if (!isOnline) {
        console.log('Token expired but offline - allowing local editing')
        return false
      }
      
      console.log('Token expired, attempting refresh via Chrome Identity API...')
      setIsRefreshing(true)
      
      try {
        const result = await chromeRefreshToken()
        if (result.success && result.token) {
          setUser({
            ...user,
            accessToken: result.token,
            tokenExpiry: Date.now() + (3600 * 1000) // 1 hour
          })
          console.log('Token refreshed successfully')
          return true
        }
      } catch (error) {
        console.error('Token refresh failed:', error)
      } finally {
        setIsRefreshing(false)
      }
      
      return false
    }
    return true
  }, [user, isRefreshing, setUser, isOnline])

  // Check token validity on mount and periodically
  useEffect(() => {
    if (!user?.accessToken) return

    checkAndRefreshToken()

    // Check when popup becomes visible
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkAndRefreshToken()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // Check every 50 minutes
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        checkAndRefreshToken()
      }
    }, 50 * 60 * 1000)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [user?.accessToken, checkAndRefreshToken])

  // Auto sync when user logs in and periodically
  // Graceful: skip sync if offline or token expired, but don't block local editing
  useEffect(() => {
    if (!user?.accessToken) return
    
    // Don't sync if offline - local changes will be queued
    if (!isOnline) {
      console.log('[App] Offline, skipping auto-sync')
      return
    }
    
    // Don't sync if token is expired - will retry after refresh
    if (isTokenExpired(user.tokenExpiry)) {
      console.log('[App] Token expired, skipping auto-sync')
      return
    }

    let lastSync = 0
    const doSync = async () => {
      if (!isOnline) return
      
      const now = Date.now()
      if (now - lastSync < 5000) return
      lastSync = now
      
      // Get valid token (auto-refresh if expired)
      const accessToken = await getValidAccessToken()
      if (!accessToken) return
      
      // Check if Drive has data first (only on initial sync when no local notes)
      const currentNotes = useNotesStore.getState().notes
      if (currentNotes.length === 0) {
        await checkDriveHasData(accessToken)
      }
      
      await syncWithDrive(accessToken)
      await loadSharedNotes()
    }

    doSync()

    const interval = setInterval(() => {
      // Check token and online status before syncing
      if (isTokenExpired(user.tokenExpiry)) return
      if (!isOnline) return
      
      const hasPending = useNotesStore.getState().notes.some(n => n.syncStatus === 'pending')
      const hasPendingCollections = useNotesStore.getState().collections.some(c => c.syncStatus === 'pending')
      if (hasPending || hasPendingCollections) doSync()
    }, 30000)

    return () => clearInterval(interval)
  }, [user?.accessToken, user?.tokenExpiry, isOnline])

  // Sync when notes change (debounced)
  // Skip if offline or token expired - changes are queued in IndexedDB
  // Use interval-based check instead of effect dependency to avoid re-renders
  useEffect(() => {
    if (!user?.accessToken) return
    if (!isOnline) return
    if (isTokenExpired(user.tokenExpiry)) return

    // Check for pending changes every 500ms instead of on every notes change
    const checkPending = () => {
      const state = useNotesStore.getState()
      const hasPending = state.notes.some(n => n.syncStatus === 'pending')
      const hasPendingCollections = state.collections.some(c => c.syncStatus === 'pending')
      if ((hasPending || hasPendingCollections) && !state.isSyncing) {
        debouncedSync()
      }
    }

    const interval = setInterval(checkPending, 500)
    return () => clearInterval(interval)
  }, [user?.accessToken, user?.tokenExpiry, isOnline, debouncedSync])

  // If viewing a public note, show the view page
  if (viewFileId) {
    return <PublicNoteView fileId={viewFileId} />
  }

  if (!user) {
    return <LoginScreen />
  }

  return (
    <LayoutGroup>
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
        <div className="pt-3 px-4">
          <Header />
        </div>
        <main className="max-w-6xl w-full mx-auto px-4 py-6">
          <ListErrorBoundary>
            <VirtualizedNotesList />
          </ListErrorBoundary>
        </main>
        <ModalErrorBoundary>
          <NoteModal />
        </ModalErrorBoundary>
        <WebContentDialog />
      </div>
      
      {/* Drive Permission Error Dialog */}
      {showPermissionError && (
        <DrivePermissionError onClose={() => setShowPermissionError(false)} />
      )}
    </LayoutGroup>
  )
}

function App() {
  return (
    <AppErrorBoundary>
      <TooltipProvider delayDuration={300}>
        <AppContent />
      </TooltipProvider>
    </AppErrorBoundary>
  )
}

export default App
