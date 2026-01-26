import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, WifiOff } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { VantaWaves } from '@/components/ui/VantaWaves'
import { useNetworkStore } from '@/stores/networkStore'
import { chromeGoogleLogin, isChromeExtension } from '@/lib/chromeAuth'
import { DrivePermissionError } from './DrivePermissionError'

// Apple Icon
const AppleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
  </svg>
)

// Android Icon
const AndroidIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24c-1.4-.59-2.96-.92-4.61-.92s-3.21.33-4.61.92L5.37 5.67c-.19-.29-.58-.38-.87-.2-.28.18-.37.54-.22.83L6.12 9.5C3.31 11.11 1.5 14.06 1.5 17.5h21c0-3.44-1.81-6.39-4.9-8.02zM7 15.25c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25zm10 0c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25z"/>
  </svg>
)

// Windows Icon
const WindowsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 12V6.75l6-1.32v6.48L3 12zm17-9v8.75l-10 .15V5.21L20 3zM3 13l6 .09v6.81l-6-1.15V13zm17 .25V22l-10-1.91V13.1l10 .15z"/>
  </svg>
)

export function LoginScreen() {
  const { t } = useTranslation()
  const { setUser, setLoading, setLoginTransition } = useAuthStore()
  const { theme } = useThemeStore()
  const { isOnline } = useNetworkStore()
  const [showPermissionError, setShowPermissionError] = useState(false)
  
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  // Handle login using Chrome Identity API
  const handleLogin = async () => {
    if (!isChromeExtension()) {
      console.error('Not running in Chrome Extension context')
      return
    }

    setLoading(true)
    setLoginTransition(true)
    
    try {
      const result = await chromeGoogleLogin()
      
      if (result.success && result.token && result.user) {
        setUser({
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          avatar: result.user.avatar,
          accessToken: result.token,
          tokenExpiry: Date.now() + (3600 * 1000) // 1 hour
        })
        
        // Keep overlay visible briefly for smooth transition
        setTimeout(() => setLoginTransition(false), 500)
      } else {
        // Check for permission error
        if (result.error === 'DRIVE_PERMISSION_DENIED') {
          setShowPermissionError(true)
        } else {
          console.error('Login failed:', result.error)
        }
        setLoginTransition(false)
      }
    } catch (error) {
      console.error('Login error:', error)
      setLoginTransition(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Vanta Clouds Background */}
      <VantaWaves />
      {/* Card Container - Apple-style glassmorphism */}
      <div className="relative z-10 w-full max-w-sm bg-white/40 dark:bg-black/40 backdrop-blur-xl rounded-[24px] p-8 shadow-2xl border border-white/50 dark:border-white/10">
        <div className="space-y-5 text-center">
          {/* Logo - App icon */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-[20px] bg-neutral-900/90 dark:bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center p-3">
              <img 
                src={isDark ? "/g-note.svg" : "/g-note-dark.svg"}
                alt="G-Note" 
                className="w-full h-full"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">G-Note</h1>
              <p className="text-neutral-500 dark:text-white/70 mt-1">
                {t('app.tagline')}
              </p>
            </div>
          </div>

          {/* Offline Warning */}
          {!isOnline && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/20 dark:bg-amber-500/10 border border-amber-500/30 rounded-[12px] text-amber-700 dark:text-amber-400 text-sm">
              <WifiOff className="w-4 h-4 flex-shrink-0" />
              <span>{t('offline.loginRequiresNetwork')}</span>
            </div>
          )}

          {/* Google Login Button */}
          <button
            onClick={handleLogin}
            disabled={!isOnline}
            className="w-full h-12 px-6 flex items-center justify-center gap-3 bg-white/60 dark:bg-white/15 backdrop-blur-md border border-white/60 dark:border-white/20 rounded-[12px] font-medium text-neutral-700 dark:text-white hover:bg-white/80 dark:hover:bg-white/25 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white/60 dark:disabled:hover:bg-white/15"
          >
            {/* Google Icon - Single color */}
            <svg className="w-5 h-5 text-neutral-600 dark:text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {t('auth.loginWithGoogle')}
          </button>

          <p className="text-xs text-neutral-400 dark:text-white/50 !mt-3">
            {t('auth.agreeToTerms.prefix')}{' '}
            <a 
              href="https://gnote.graphosai.com/terms" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline"
            >
              {t('auth.agreeToTerms.terms')}
            </a>{' '}
            {t('auth.agreeToTerms.and')}{' '}
            <a 
              href="https://gnote.graphosai.com/privacy" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline"
            >
              {t('auth.agreeToTerms.privacy')}
            </a>
          </p>
        </div>
      </div>

      {/* Get App Pill & Chrome Extension Info */}
      <div className="relative z-10 mt-6 flex flex-col items-center gap-3">
        <a
          href="https://gnote.graphosai.com"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-2.5 px-4 py-2.5 bg-white/40 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-full hover:bg-white/50 dark:hover:bg-black/50 transition-all shadow-lg"
        >
          {/* Platform icons */}
          <div className="flex items-center -space-x-1.5">
            {/* Apple */}
            <div className="w-7 h-7 rounded-full bg-white dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-neutral-700">
              <AppleIcon className="w-4 h-4 text-neutral-900 dark:text-white" />
            </div>
            {/* Android */}
            <div className="w-7 h-7 rounded-full bg-white dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-neutral-700">
              <AndroidIcon className="w-4 h-4 text-[#3DDC84]" />
            </div>
            {/* Windows */}
            <div className="w-7 h-7 rounded-full bg-white dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-neutral-700">
              <WindowsIcon className="w-3.5 h-3.5 text-[#0078D4]" />
            </div>
          </div>

          {/* Text */}
          <span className="text-sm font-medium text-neutral-700 dark:text-white whitespace-nowrap">
            {t('install.getApp')}
          </span>

          {/* Arrow */}
          <ChevronRight className="w-4 h-4 text-neutral-500 dark:text-white/70 group-hover:translate-x-0.5 transition-transform" />
        </a>

        <p className="text-xs text-neutral-400 dark:text-white/50">
          Chrome Extension v1.1.7
        </p>
      </div>
      
      {/* Drive Permission Error Dialog */}
      {showPermissionError && (
        <DrivePermissionError onClose={() => setShowPermissionError(false)} />
      )}
    </div>
  )
}
