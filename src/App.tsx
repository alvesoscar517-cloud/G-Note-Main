import { useEffect, useCallback, useState } from 'react'
import { useDebouncedCallback } from 'use-debounce'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { LayoutGroup } from 'framer-motion'
import { useAuthStore } from '@/stores/authStore'
import { useNotesStore, smartSyncManager, flushPendingNoteUpdates } from '@/stores/notesStore'
import { useThemeStore } from '@/stores/themeStore'
import { useNetworkStore } from '@/stores/networkStore'
import { useMigrationStore } from '@/stores/migrationStore'
// import { migrationEngine } from '@/lib/migration/removeCollectionMigration' // Disabled - migration complete
import { LoginScreen } from '@/components/auth/LoginScreen'
import { DrivePermissionError } from '@/components/auth/DrivePermissionError'
import { Header } from '@/components/layout/Header'
import { InstallPrompt } from '@/components/layout/InstallPrompt'
import { MigrationProgress } from '@/components/layout/MigrationProgress'
import { VirtualizedNotesList } from '@/components/notes/VirtualizedNotesList'
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
import { getValidAccessToken } from '@/lib/tokenManager'
import { 
  isTokenExpired, 
  hasAuthBackend, 
  silentRefreshWithBackend,
  parseAuthCode,
  exchangeCodeForTokens
} from '@/lib/tokenRefresh'

// Key for pending note from free-note page
const PENDING_NOTE_KEY = 'g-note-pending-from-free'
const FROM_FREE_NOTE_FLAG = 'g-note-from-free-note'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID'

// Check for public view mode
function getViewFileId(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('view')
}

function AppContent() {
  const { user, setUser } = useAuthStore()
  const { syncWithDrive, checkDriveHasData, loadSharedNotes, initOfflineStorage, addNote, setSelectedNote, setModalOpen, syncError, setIsNewUser } = useNotesStore()
  const { initTheme } = useThemeStore()
  const initNetwork = useNetworkStore(state => state.initialize)
  const isOnline = useNetworkStore(state => state.isOnline)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showPermissionError, setShowPermissionError] = useState(false)
  
  // Migration state
  const { migrationResult, /* setMigrating, setMigrationResult, */ reset: resetMigration } = useMigrationStore()
  const [showMigrationDialog, setShowMigrationDialog] = useState(false)
  
  // Block default context menu globally
  useBlockContextMenu()
  
  const viewFileId = getViewFileId()
  
  // Check for migration on app initialization
  // MIGRATION DISABLED - Collection feature has been removed
  // Uncomment this block if you need to run migration again
  /*
  useEffect(() => {
    const checkAndRunMigration = async () => {
      try {
        console.log('[App] Checking if migration is needed...')
        const needsMigration = await migrationEngine.needsMigration()
        
        if (needsMigration) {
          console.log('[App] Migration needed, starting migration...')
          setMigrating(true)
          setShowMigrationDialog(true)
          
          // Run migration
          const result = await migrationEngine.migrate()
          
          console.log('[App] Migration completed:', result)
          setMigrationResult(result)
          
          // Keep dialog open to show result
          // User will close it by clicking "Continue" or "Close"
        } else {
          console.log('[App] No migration needed')
        }
      } catch (error) {
        console.error('[App] Migration check failed:', error)
        // Don't block app if migration check fails
        // The app can still function normally
      }
    }
    
    // Run migration check after IndexedDB is initialized
    // Wait a bit to ensure DB is ready
    const timer = setTimeout(() => {
      checkAndRunMigration()
    }, 500)
    
    return () => clearTimeout(timer)
  }, [setMigrating, setMigrationResult])
  */
  
  // Handle migration dialog close
  const handleMigrationComplete = () => {
    setShowMigrationDialog(false)
    resetMigration()
  }
  
  // Save flag when coming from free-note page (before OAuth redirect clears URL)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const fromFreeNote = params.get('from') === 'free-note'
    
    if (fromFreeNote) {
      // Save flag to localStorage so it persists through OAuth redirect
      localStorage.setItem(FROM_FREE_NOTE_FLAG, 'true')
      // Clean URL immediately
      window.history.replaceState({}, '', '/')
    }
  }, [])
  
  // Check for pending note from free-note page after login
  useEffect(() => {
    if (!user?.accessToken) return
    
    // Check if coming from free-note page (flag saved before OAuth)
    const fromFreeNote = localStorage.getItem(FROM_FREE_NOTE_FLAG) === 'true'
    
    if (fromFreeNote) {
      // Clear flag immediately
      localStorage.removeItem(FROM_FREE_NOTE_FLAG)
      
      try {
        const pendingData = localStorage.getItem(PENDING_NOTE_KEY)
        if (pendingData) {
          const pending = JSON.parse(pendingData)
          
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
            
            // Clear pending data
            localStorage.removeItem(PENDING_NOTE_KEY)
          }
        }
      } catch (e) {
        console.error('Failed to process pending note:', e)
      }
    }
  }, [user?.accessToken, addNote, setSelectedNote, setModalOpen])
  
  // Initialize network status monitoring and offline storage
  useEffect(() => {
    const cleanupNetwork = initNetwork()
    const cleanupOfflineSync = initOfflineSync()
    
    // Initialize offline storage (IndexedDB)
    initOfflineStorage()
    
    // Start periodic sync when logged in
    if (user?.accessToken) {
      smartSyncManager.startPeriodicSync()
    }
    
    // Sync and flush on page unload/visibility change
    const handleBeforeUnload = async () => {
      await flushPendingNoteUpdates()
    }
    
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden') {
        await flushPendingNoteUpdates()
        // Trigger sync when app goes to background
        smartSyncManager.syncNow()
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      cleanupNetwork()
      cleanupOfflineSync()
      smartSyncManager.stop()
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [initNetwork, initOfflineStorage, user?.accessToken])

  // Debounced sync - wait 2s after last change before syncing
  const debouncedSync = useDebouncedCallback(async () => {
    if (!user?.accessToken || isTokenExpired(user.tokenExpiry)) return
    if (!isOnline) return // Don't sync when offline
    await syncWithDrive(user.accessToken)
  }, 2000)

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
  }, [setUser])

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
      // Sync will happen when back online with valid token
      if (!isOnline) {
        console.log('Token expired but offline - allowing local editing')
        return false // Return false but don't logout
      }
      
      console.log('Token expired or expiring soon, attempting silent refresh...')
      
      // Try backend refresh first (silent, no popup)
      if (hasAuthBackend()) {
        setIsRefreshing(true)
        try {
          const result = await silentRefreshWithBackend(user.id)
          if (result) {
            setUser({
              ...user,
              accessToken: result.access_token,
              tokenExpiry: Date.now() + (result.expires_in * 1000)
            })
            console.log('Token refreshed silently via backend')
            return true
          }
        } catch (error) {
          console.error('Silent refresh failed:', error)
        } finally {
          setIsRefreshing(false)
        }
      }
      
      // If backend refresh fails but we're online, user needs to re-login
      // But if offline, allow continued local editing
      if (isOnline) {
        console.log('Silent refresh failed, user needs to re-login')
      }
      return false
    }
    return true
  }, [user, isRefreshing, setUser, isOnline])

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
      if (hasPending) doSync()
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
      if (hasPending && !state.isSyncing) {
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
      <SEOHead />
      <div className="h-screen h-dvh bg-neutral-50 dark:bg-neutral-950 status-bar-bg overflow-y-auto">
        <div className="pt-3 px-4 safe-top safe-x">
          <Header />
        </div>
        <main className="max-w-6xl w-full mx-auto px-4 py-6 safe-x safe-bottom">
          <ListErrorBoundary>
            <VirtualizedNotesList />
          </ListErrorBoundary>
        </main>
        <ModalErrorBoundary>
          <NoteModal />
        </ModalErrorBoundary>
        <InstallPrompt />
      </div>
      
      {/* Migration Progress Dialog */}
      <MigrationProgress
        isOpen={showMigrationDialog}
        migrationResult={migrationResult}
        onComplete={handleMigrationComplete}
      />
      
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

export default App
