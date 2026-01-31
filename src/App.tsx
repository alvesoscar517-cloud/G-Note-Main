import { useEffect, useCallback, useState } from 'react'
// useDebouncedCallback was removed as debouncedSync is no longer used
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { LayoutGroup } from 'framer-motion'
import { useAuthStore } from '@/stores/authStore'
import { useNotesStore } from '@/stores/notesStore'
import { useAppStore } from '@/stores/appStore'
import { syncManager } from '@/lib/sync/simpleSyncManager'
import { LoginScreen } from '@/components/auth/LoginScreen'
import { DrivePermissionError } from '@/components/auth/DrivePermissionError'
import { Header } from '@/components/layout/Header'
import { InstallPrompt } from '@/components/layout/InstallPrompt'
import { VirtualizedNotesList } from '@/components/notes/VirtualizedNotesList'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { NoteModal } from '@/components/notes/NoteModal'
import { PublicNoteView } from '@/components/notes/PublicNoteView'
import { FreeNoteView } from '@/components/notes/FreeNoteView'
import { PrivacyPolicy, TermsOfService } from '@/components/legal'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { useBlockContextMenu } from '@/components/ui/ContextMenuBlocker'
import { AppErrorBoundary, ListErrorBoundary, ModalErrorBoundary } from '@/components/ui/ErrorBoundary'
import { SEOHead } from '@/components/SEOHead'
import { initOfflineSync } from '@/lib/offlineSync'
import { hideSplashScreen } from '@/lib/splashScreen'
import { tokenManager, isTokenExpired } from '@/lib/tokenManager'
import {
  parseAuthCode,
  exchangeCodeForTokens,
  hasAuthBackend
} from '@/lib/tokenRefresh'

// Key for pending note from free-note page
const PENDING_NOTE_KEY = 'g-note-pending-from-free'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID'

// Check for public view mode
function getViewFileId(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('view')
}

function AppContent() {
  const { user, setUser } = useAuthStore()
  const { syncWithDrive, checkDriveHasData, loadSharedNotes, initOfflineStorage, addNote, setSelectedNote, setModalOpen, syncError, setIsNewUser } = useNotesStore()
  const { initTheme, initialize: initNetwork, isOnline } = useAppStore()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showPermissionError, setShowPermissionError] = useState(false)

  // Block default context menu globally
  useBlockContextMenu()

  const viewFileId = getViewFileId()

  // Helper function to process pending note from free-note page
  // Called after user is confirmed logged in
  const processPendingFreeNote = useCallback(() => {
    try {
      const pendingData = localStorage.getItem(PENDING_NOTE_KEY)
      if (!pendingData) return

      const pending = JSON.parse(pendingData)

      // Clear pending data first to prevent duplicate processing
      localStorage.removeItem(PENDING_NOTE_KEY)

      // Clear the free-note localStorage as well
      try {
        localStorage.removeItem('g-note-free-note')
      } catch (e) {
        // Ignore
      }

      // Create new note from pending data
      const newNote = addNote()
      if (newNote) {
        // Update note with pending content
        useNotesStore.getState().updateNote(newNote.id, {
          title: pending.title || '',
          content: pending.content || '',
          style: pending.style
        })

        // Open the note modal
        setSelectedNote(newNote.id)
        setModalOpen(true)

        console.log('✅ Pending note from free-note processed:', newNote.id)
      }
    } catch (e) {
      console.error('Failed to process pending note:', e)
    }
  }, [addNote, setSelectedNote, setModalOpen])

  // Check and process pending note when user is logged in
  // This runs when user is already logged in and navigates from free-note
  useEffect(() => {
    // Check if we're coming from free-note via URL param
    const params = new URLSearchParams(window.location.search)
    const fromFreeNote = params.get('from') === 'free-note'

    if (fromFreeNote) {
      // Clean URL immediately
      window.history.replaceState({}, '', '/')

      // Only process if user is already logged in
      if (user?.accessToken) {
        // Small delay to ensure store is ready
        setTimeout(() => processPendingFreeNote(), 100)
      }
    }
  }, []) // Only run on mount - auth callback will handle OAuth redirect case

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

  // NOTE: debouncedSync is currently unused as sync is handled by SimpleSyncManager
  // Keeping as reference for potential future use
  // const debouncedSync = useDebouncedCallback(async () => {
  //   if (!user?.accessToken || isTokenExpired(user.tokenExpiry)) return
  //   if (!isOnline) return // Don't sync when offline
  //   await syncWithDrive(user.accessToken)
  // }, 2000)

  // Handle OAuth callback (authorization code flow)
  useEffect(() => {
    const handleAuthCallback = async () => {
      const code = parseAuthCode()
      if (code && hasAuthBackend()) {
        console.log('Processing auth callback...')
        try {
          const result = await exchangeCodeForTokens(code)
          if (result) {
            // Set isNewUser flag before setting user (to skip skeleton for new users)
            if (result.isNewUser) {
              setIsNewUser(true)
            }

            setUser({
              id: result.user.id,
              email: result.user.email,
              name: result.user.name,
              avatar: result.user.avatar,
              accessToken: result.accessToken,
              tokenExpiry: Date.now() + (result.expiresIn * 1000)
            })
            console.log('Login successful via auth code flow', result.isNewUser ? '(new user)' : '(existing user)')

            // Process pending note from free-note page AFTER user is set
            // Small delay to ensure zustand store is updated
            setTimeout(() => processPendingFreeNote(), 200)
          }
        } catch (error) {
          // Handle permission error during login
          if (error instanceof Error && error.message === 'DRIVE_PERMISSION_DENIED') {
            console.log('Drive permission denied during login')
            setShowPermissionError(true)
          } else {
            console.error('Auth callback error:', error)
          }
        }
        // Hide splash after auth processing (success or fail)
        setTimeout(() => hideSplashScreen(), 300)
      }
    }
    handleAuthCallback()
  }, [setUser, processPendingFreeNote])

  // Show permission error dialog when sync fails due to permission
  useEffect(() => {
    if (syncError === 'DRIVE_PERMISSION_DENIED') {
      setShowPermissionError(true)
    }
  }, [syncError])

  // Silent refresh using backend (no popup needed)
  // Graceful degradation: if offline + token expired, allow local editing
  const checkAndRefreshToken = useCallback(async () => {
    if (!user || isRefreshing) return false

    if (isTokenExpired(user.tokenExpiry)) {
      // If offline, don't try to refresh - allow local editing
      if (!isOnline) {
        console.log('[App] Token expired but offline - allowing local editing')
        return false
      }

      console.log('[App] Token expired, attempting refresh...')
      setIsRefreshing(true)

      try {
        const newToken = await tokenManager.getValidToken()
        if (newToken) {
          console.log('[App] Token refreshed successfully')
          return true
        }

        // If refresh fails and we're online, user needs to re-login
        if (isOnline) {
          console.log('[App] Token refresh failed, user needs to re-login')
        }
        return false
      } catch (error) {
        console.error('[App] Token refresh error:', error)
        return false
      } finally {
        setIsRefreshing(false)
      }
    }
    return true
  }, [user, isRefreshing, isOnline])

  // Initialize theme on mount
  useEffect(() => {
    initTheme()
  }, [])

  // Check token validity on mount and when tab becomes visible
  useEffect(() => {
    if (!user?.accessToken) return

    // Check immediately
    checkAndRefreshToken()

    // Check when tab becomes visible (user returns to app)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkAndRefreshToken()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // Check every 50 minutes (token expires in 1 hour)
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
      <SEOHead />
      <div className="h-screen h-dvh bg-neutral-50 dark:bg-neutral-950 status-bar-bg overflow-y-auto">
        <div className="pt-3 px-4 safe-top safe-x">
          <Header />
        </div>
        <main className="max-w-6xl w-full mx-auto px-4 pt-6 pb-32 safe-x safe-bottom">
          <ListErrorBoundary>
            <VirtualizedNotesList />
          </ListErrorBoundary>
        </main>
        <ModalErrorBoundary>
          <NoteModal />
        </ModalErrorBoundary>
        <InstallPrompt />
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
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <TooltipProvider delayDuration={300}>
          <GlobalEffects />
          <GlobalLoading />
          <BrowserRouter>
            <Routes>
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/free-note" element={<FreeNoteView />} />
              <Route path="*" element={<AppContent />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </GoogleOAuthProvider>
    </AppErrorBoundary>
  )
}

function GlobalEffects() {
  const { initTheme } = useAppStore()

  useEffect(() => {
    // Initialize theme globally for all routes
    initTheme()
  }, [initTheme])

  return null
}

function GlobalLoading() {
  const isLoggingOut = useAuthStore(state => state.isLoggingOut)
  return <LoadingOverlay isVisible={isLoggingOut} />
}

export default App
