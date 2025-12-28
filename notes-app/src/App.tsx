import { useEffect, useCallback, useState } from 'react'
import { useDebouncedCallback } from 'use-debounce'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { LayoutGroup } from 'framer-motion'
import { useAuthStore } from '@/stores/authStore'
import { useNotesStore } from '@/stores/notesStore'
import { useThemeStore } from '@/stores/themeStore'
import { useNetworkStore } from '@/stores/networkStore'
import { LoginScreen } from '@/components/auth/LoginScreen'
import { Header } from '@/components/layout/Header'
import { InstallPrompt } from '@/components/layout/InstallPrompt'
import { NotesList } from '@/components/notes/NotesList'
import { NoteModal } from '@/components/notes/NoteModal'
import { PublicNoteView } from '@/components/notes/PublicNoteView'
import { PrivacyPolicy, TermsOfService } from '@/components/legal'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { useBlockContextMenu } from '@/components/ui/ContextMenuBlocker'
import { SEOHead } from '@/components/SEOHead'
import { initOfflineSync } from '@/lib/offlineSync'
import { hideSplashScreen } from '@/lib/splashScreen'
import { 
  isTokenExpired, 
  hasAuthBackend, 
  silentRefreshWithBackend,
  parseAuthCode,
  exchangeCodeForTokens
} from '@/lib/tokenRefresh'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID'

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
    
    // Initialize offline storage (IndexedDB) with user ID for data isolation
    initOfflineStorage(user?.id)
    
    return () => {
      cleanupNetwork()
      cleanupOfflineSync()
    }
  }, [initNetwork, initOfflineStorage, user?.id])

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
        const result = await exchangeCodeForTokens(code)
        if (result) {
          setUser({
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            avatar: result.user.avatar,
            accessToken: result.accessToken,
            tokenExpiry: Date.now() + (result.expiresIn * 1000)
          })
          console.log('Login successful via auth code flow')
        }
        // Hide splash after auth processing (success or fail)
        setTimeout(() => hideSplashScreen(), 300)
      }
    }
    handleAuthCallback()
  }, [setUser])

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
      <SEOHead />
      <div className="min-h-screen min-h-dvh bg-neutral-50 dark:bg-neutral-950 fixed inset-0 overflow-auto">
        <Header />
        <main className="max-w-6xl mx-auto px-4 py-6 safe-x safe-bottom">
          <NotesList />
        </main>
        <NoteModal />
        <InstallPrompt />
      </div>
    </LayoutGroup>
  )
}

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <TooltipProvider delayDuration={300}>
        <BrowserRouter>
          <Routes>
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="*" element={<AppContent />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </GoogleOAuthProvider>
  )
}

export default App
