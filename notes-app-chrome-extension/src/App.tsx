import { useEffect, useCallback, useState } from 'react'

import { LayoutGroup } from 'framer-motion'
import { useAuthStore } from '@/stores/authStore'
import { useNotesStore } from '@/stores/notesStore'
import { useAppStore } from '@/stores/appStore'
import { syncManager } from '@/lib/sync/simpleSyncManager'
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
import { tokenManager, isTokenExpired } from '@/lib/tokenManager'
import { chromeRefreshToken, isChromeExtension } from '@/lib/chromeAuth'

// Check for public view mode
function getViewFileId(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('view')
}

function AppContent() {
  const { user, setUser } = useAuthStore()
  const { syncWithDrive, checkDriveHasData, loadSharedNotes, initOfflineStorage, syncError } = useNotesStore()
  const { initTheme } = useAppStore()
  const initNetwork = useAppStore(state => state.initialize)
  const isOnline = useAppStore(state => state.isOnline)
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

    // Sync and flush on page unload/visibility change
    const handleBeforeUnload = async () => {
      await syncManager.flush()
    }

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden') {
        // Only flush to IndexedDB when going to background
        // Sync will happen when app comes back online (handled by offlineSync)
        await syncManager.flush()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cleanupNetwork()
      cleanupOfflineSync()
      syncManager.stop()
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [initNetwork, initOfflineStorage])



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
      const accessToken = await tokenManager.getValidToken()
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
      if (hasPending) doSync()
    }, 30000)

    return () => clearInterval(interval)
  }, [user?.accessToken, user?.tokenExpiry, isOnline])

  // REMOVED: Polling-based sync check (replaced by event-driven sync in SimpleSyncManager)
  // SimpleSyncManager now handles sync scheduling via scheduleSync() called from note actions
  // This eliminates the 500ms polling overhead and improves performance

  // If viewing a public note, show the view page
  if (viewFileId) {
    return <PublicNoteView fileId={viewFileId} />
  }

  if (!user) {
    return <LoginScreen />
  }

  return (
    <LayoutGroup>
      <div className="h-screen bg-neutral-50 dark:bg-neutral-950 overflow-y-auto">
        <div className="pt-3 px-4">
          <Header />
        </div>
        <main className="max-w-6xl w-full mx-auto px-4 pt-6 pb-32">
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
