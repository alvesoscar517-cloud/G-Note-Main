import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, X, Share, Plus, MoreVertical, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAppStore } from '@/stores/appStore'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Detect device/browser type
function getDeviceInfo() {
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua))
  const isAndroid = /Android/.test(ua)
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua)
  const isChrome = /Chrome/.test(ua) && !/Edge|Edg/.test(ua)
  const isEdge = /Edge|Edg/.test(ua)
  const isFirefox = /Firefox/.test(ua)
  const isSamsung = /SamsungBrowser/.test(ua)
  const isOpera = /OPR|Opera/.test(ua)
  const isMac = /Macintosh/.test(ua)
  const isWindows = /Windows/.test(ua)
  
  // Check if already installed as PWA
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                       (window.navigator as any).standalone === true ||
                       document.referrer.includes('android-app://')
  
  return { isIOS, isAndroid, isSafari, isChrome, isEdge, isFirefox, isSamsung, isOpera, isMac, isWindows, isStandalone }
}

type InstallMethod = 'native' | 'ios-safari' | 'ios-chrome' | 'android-firefox' | 'android-samsung' | 'android-opera' | 'desktop-firefox' | 'desktop-safari' | 'none'

function getInstallMethod(): InstallMethod {
  const { isIOS, isAndroid, isSafari, isChrome, isFirefox, isSamsung, isOpera, isMac, isStandalone } = getDeviceInfo()
  
  if (isStandalone) return 'none' // Already installed
  
  // iOS
  if (isIOS) {
    if (isSafari) return 'ios-safari'
    if (isChrome) return 'ios-chrome'
    return 'ios-safari' // Default for iOS
  }
  
  // Android
  if (isAndroid) {
    if (isFirefox) return 'android-firefox'
    if (isSamsung) return 'android-samsung'
    if (isOpera) return 'android-opera'
    // Chrome/Edge on Android supports beforeinstallprompt
    return 'native'
  }
  
  // Desktop
  if (isFirefox) return 'desktop-firefox'
  if (isMac && isSafari) return 'desktop-safari'
  
  // Chrome, Edge on desktop support beforeinstallprompt
  return 'native'
}

export function InstallPrompt() {
  const { t } = useTranslation()
  const { theme } = useAppStore()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [installMethod, setInstallMethod] = useState<InstallMethod>('none')
  
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  useEffect(() => {
    // Check if already dismissed (with expiry - show again after 7 days)
    const dismissedData = localStorage.getItem('install-prompt-dismissed')
    if (dismissedData) {
      const { timestamp } = JSON.parse(dismissedData)
      const sevenDays = 7 * 24 * 60 * 60 * 1000
      if (Date.now() - timestamp < sevenDays) {
        setDismissed(true)
        return
      }
    }

    const method = getInstallMethod()
    setInstallMethod(method)
    
    if (method === 'none') return
    
    // For native install prompt (Chrome/Edge)
    if (method === 'native') {
      const handler = (e: Event) => {
        e.preventDefault()
        setDeferredPrompt(e as BeforeInstallPromptEvent)
        setShowPrompt(true)
      }
      window.addEventListener('beforeinstallprompt', handler)
      return () => window.removeEventListener('beforeinstallprompt', handler)
    }
    
    // For manual install methods, show prompt after a delay
    const timer = setTimeout(() => {
      setShowPrompt(true)
    }, 3000) // Show after 3 seconds
    
    return () => clearTimeout(timer)
  }, [])

  const handleInstall = async () => {
    if (installMethod === 'native' && deferredPrompt) {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setShowPrompt(false)
      }
      setDeferredPrompt(null)
    }
    // For manual methods, the instructions are shown in the UI
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    setDismissed(true)
    localStorage.setItem('install-prompt-dismissed', JSON.stringify({ timestamp: Date.now() }))
  }

  if (!showPrompt || dismissed || installMethod === 'none') return null

  // Render instructions based on install method
  const renderInstructions = () => {
    switch (installMethod) {
      case 'ios-safari':
        return (
          <div className="space-y-2">
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              {t('install.iosSafariInstructions')}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 flex-wrap">
              <div className="flex items-center gap-1 px-2 py-1.5 bg-neutral-100 dark:bg-neutral-700 rounded-lg">
                <Share className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">{t('install.shareButton', 'Chia sẻ')}</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 shrink-0 text-neutral-400" />
              <div className="flex items-center gap-1 px-2 py-1.5 bg-neutral-100 dark:bg-neutral-700 rounded-lg">
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">{t('install.addToHomeScreen', 'Thêm vào MH chính')}</span>
              </div>
            </div>
          </div>
        )
      
      case 'ios-chrome':
        return (
          <div className="space-y-2">
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              {t('install.iosChromeInstructions')}
            </p>
          </div>
        )
      
      case 'android-firefox':
        return (
          <div className="space-y-2">
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              {t('install.androidFirefoxInstructions')}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 flex-wrap">
              <div className="flex items-center gap-1 px-2 py-1.5 bg-neutral-100 dark:bg-neutral-700 rounded-lg">
                <MoreVertical className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">{t('install.menu', 'Menu')}</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 shrink-0 text-neutral-400" />
              <div className="flex items-center gap-1 px-2 py-1.5 bg-neutral-100 dark:bg-neutral-700 rounded-lg">
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">{t('install.install')}</span>
              </div>
            </div>
          </div>
        )
      
      case 'android-samsung':
      case 'android-opera':
        return (
          <div className="space-y-2">
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              {t('install.androidOtherInstructions')}
            </p>
          </div>
        )
      
      case 'desktop-firefox':
        return (
          <div className="space-y-2">
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              {t('install.desktopFirefoxInstructions')}
            </p>
          </div>
        )
      
      case 'desktop-safari':
        return (
          <div className="space-y-2">
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              {t('install.desktopSafariInstructions')}
            </p>
          </div>
        )
      
      default:
        return null
    }
  }

  const isNativeInstall = installMethod === 'native' && deferredPrompt

  return (
    <div className="fixed bottom-4 left-2 right-2 sm:left-4 sm:right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-700 p-3 sm:p-4 backdrop-blur-xl">
        <div className="flex items-start gap-2.5 sm:gap-3">
          {/* App Icon */}
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-[12px] bg-neutral-900 dark:bg-white flex items-center justify-center shrink-0 shadow-lg p-1.5 sm:p-2">
            <img 
              src={isDark ? "/g-note.svg" : "/g-note-dark.svg"}
              alt="G-Note" 
              className="w-full h-full"
            />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-neutral-900 dark:text-white text-sm sm:text-base">
              {t('install.title')}
            </h3>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
              {t('install.description')}
            </p>
            
            {/* Instructions for manual install */}
            {!isNativeInstall && (
              <div className="mt-2.5 sm:mt-3">
                {renderInstructions()}
              </div>
            )}
            
            {/* Buttons */}
            <div className="flex items-center gap-2 mt-2.5 sm:mt-3">
              {isNativeInstall ? (
                <>
                  <Button size="sm" onClick={handleInstall} className="text-xs sm:text-sm">
                    <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
                    {t('install.install')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleDismiss} className="text-xs sm:text-sm">
                    {t('install.later')}
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="ghost" onClick={handleDismiss} className="text-xs sm:text-sm">
                  {t('install.gotIt')}
                </Button>
              )}
            </div>
          </div>
          
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 -mt-0.5 sm:-mt-1 -mr-0.5 sm:-mr-1"
            onClick={handleDismiss}
          >
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
