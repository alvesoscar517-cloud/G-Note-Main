import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import { VantaWaves } from '@/components/ui/VantaWaves'
import { useAppStore } from '@/stores/appStore'
import { WifiOff } from 'lucide-react'
import { isChromeExtension } from '@/lib/platform/detection'
import { platformLogin } from '@/lib/platform/auth'
import { DownloadAppPill } from '@/components/layout/DownloadAppPill'

interface LoginScreenProps {
  LinkComponent?: React.ElementType<{ to: string, className?: string, children: React.ReactNode }>
}

export function LoginScreen({ LinkComponent }: LoginScreenProps) {
  const { t } = useTranslation()
  const { setUser, setLoading, setLoginTransition } = useAuthStore()
  const { isOnline } = useAppStore()
  const isExtension = isChromeExtension()

  // Platform-aware login handler
  const handleLogin = async () => {
    setLoginTransition(true)
    setLoading(true)

    try {
      const result = await platformLogin()

      if (result.success && result.user) {
        setUser(result.user)
        // Keep overlay visible briefly for smooth transition
        setTimeout(() => setLoginTransition(false), 500)
      } else if (result.error) {
        console.error('Login failed:', result.error)
        setLoginTransition(false)
      }
    } catch (error) {
      console.error('Login failed:', error)
      setLoginTransition(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen min-h-dvh flex flex-col items-center justify-center relative overflow-hidden p-4 safe-top safe-bottom"
    >
      {/* Vanta Clouds Background */}
      <VantaWaves />

      {/* Card Container - Apple-style glassmorphism */}
      <div className="relative z-10 w-full max-w-sm bg-white/40 dark:bg-black/40 backdrop-blur-xl rounded-[24px] p-8 shadow-2xl border border-white/50 dark:border-white/10">
        <div className="space-y-5 text-center">
          {/* Logo - App icon: white background with black logo, iOS standard corners */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-[18px] bg-white shadow-lg flex items-center justify-center p-[13px]">
              <img
                src="/g-note.svg"
                alt="G-Note"
                className="w-full h-full"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">G-Note</h1>
              <p className="text-neutral-600 dark:text-white/70 mt-1">
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

          {/* Google Login Button - Same UI for both platforms */}
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

          {/* Terms and Privacy Links - Conditional rendering */}
          <TermsAndPrivacyLinks LinkComponent={LinkComponent} isExtension={isExtension} />
        </div>
      </div>

      {/* Download App Pill - Web only */}
      {!isExtension && (
        <div className="relative z-10 mt-6">
          <DownloadAppPill />
        </div>
      )}
    </div>
  )
}

// Conditional component for terms/privacy links
function TermsAndPrivacyLinks({ LinkComponent, isExtension }: { LinkComponent?: any, isExtension: boolean }) {
  const { t } = useTranslation()
  const linkClass = "text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"

  // Extension or no LinkComponent provided: Plain text or external links
  if (isExtension || !LinkComponent) {
    if (isExtension) {
      // For extension, use <a> tags with target blank for external pages
      // Assuming pages are hosted on main domain which is likely gnoteai.com 
      // But better to just link what we have.
      // Or if users can't navigate, just text is handled by previous implementation.
      // I'll stick to a simple external link if possible or just text if that's what user had.
      // User had just text. 
      // But let's upgrade to use external links if possible, 
      // or just keep it simple.
      // I'll use simple <span> as in original code, but cleaner.
      // Original code used <span> without links.
      return (
        <p className="text-xs text-neutral-600 dark:text-white/60 !mt-3">
          {t('auth.agreeToTerms.prefix')}{' '}
          <span className="text-blue-600 dark:text-blue-400">
            {t('auth.agreeToTerms.terms')}
          </span>{' '}
          {t('auth.agreeToTerms.and')}{' '}
          <span className="text-blue-600 dark:text-blue-400">
            {t('auth.agreeToTerms.privacy')}
          </span>
        </p>
      )
    }

    // Fallback?
    return null
  }

  // Web with LinkComponent: Router links
  return (
    <p className="text-xs text-neutral-600 dark:text-white/60 !mt-3">
      {t('auth.agreeToTerms.prefix')}{' '}
      <LinkComponent
        to="/terms"
        className={linkClass}
      >
        {t('auth.agreeToTerms.terms')}
      </LinkComponent>{' '}
      {t('auth.agreeToTerms.and')}{' '}
      <LinkComponent
        to="/privacy"
        className={linkClass}
      >
        {t('auth.agreeToTerms.privacy')}
      </LinkComponent>
    </p>
  )
}
