import { useEffect, useCallback, useState } from 'react'
import { useDebouncedCallback } from 'use-debounce'
import { LayoutGroup } from 'framer-motion'
import { useAuthStore } from '@/stores/authStore'
import { useNotesStore } from '@/stores/notesStore'
import { useThemeStore } from '@/stores/themeStore'
import { useNetworkStore } from '@/stores/networkStore'
import { LoginScreen } from '@/components/auth/LoginScreen'
import { Header } from '@/components/layout/Header'
import { NotesList } from '@/components/notes/NotesList'
import { NoteModal } from '@/components/notes/NoteModal'
import { PublicNoteView } from '@/components/notes/PublicNoteView'
import { WebContentDialog } from '@/components/notes/WebContentDialog'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { OfflineBanner } from '@/components/ui/OfflineIndicator'
import { useBlockContextMenu } from '@/components/ui/ContextMenuBlocker'
import { initOfflineSync } from '@/lib/offlineSync'
import { isTokenExpired } from '@/lib/tokenRefresh'
import { chromeRefreshToken, isChromeExtension } from '@/lib/chromeAuth'

// Check for public view mode
function getViewFileId(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('view')
}

function AppContent() {
  const { user, setUser } = useAuthStore()
  const { syncWithDrive, loadSharedNotes, notes, isSyncing, initOfflineStorage } = useNotesStore()
  const { initTheme } = useThemeStore()
  const initNetwork = useNetworkStore(state => state.initialize)
  const isOnline = useNetworkStore(state => state.isOnline)
  const [isRefreshing, setIsRefreshing] = useState(false)
  
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
      if (isTokenExpired(user.tokenExpiry)) return
      
      const now = Date.now()
      if (now - lastSync < 5000) return
      lastSync = now
      await syncWithDrive(user.accessToken)
      await loadSharedNotes(user.accessToken)
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
  useEffect(() => {
    if (!user?.accessToken) return
    if (!isOnline) return // Don't sync when offline - changes are queued
    if (isTokenExpired(user.tokenExpiry)) return // Will sync after token refresh
    
    const hasPending = notes.some(n => n.syncStatus === 'pending')
    if (!hasPending || isSyncing) return

    debouncedSync()
  }, [notes, user?.accessToken, user?.tokenExpiry, isSyncing, isOnline, debouncedSync])

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
        <OfflineBanner />
        <Header />
        <main className="max-w-6xl mx-auto px-4 py-6">
          <NotesList />
        </main>
        <NoteModal />
        <WebContentDialog />
      </div>
    </LayoutGroup>
  )
}

function App() {
  return (
    <TooltipProvider delayDuration={300}>
      <AppContent />
    </TooltipProvider>
  )
}

export default App
