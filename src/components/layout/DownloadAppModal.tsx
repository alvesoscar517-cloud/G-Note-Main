import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Share, Plus, MoreVertical, Download, ChevronRight, Smartphone, Monitor, Tablet, Info, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'

// Chrome Extension ID
const CHROME_EXTENSION_ID = 'pncgcnggbbbgnhdniigjndekfmmblioj'
const CHROME_EXTENSION_URL = `https://chromewebstore.google.com/detail/${CHROME_EXTENSION_ID}`

interface DownloadAppModalProps {
  isOpen: boolean
  onClose: () => void
}

// Browser Icon component - uses external SVG files
interface BrowserIconProps {
  browser: 'chrome' | 'safari' | 'firefox'
  className?: string
}

function BrowserIcon({ browser, className = "w-5 h-5" }: BrowserIconProps) {
  const iconMap = {
    chrome: '/chrome-svgrepo-com.svg',
    safari: '/safari-svgrepo-com.svg',
    firefox: '/firefox-svgrepo-com.svg'
  }
  
  return (
    <img 
      src={iconMap[browser]} 
      alt={browser} 
      className={`${className} dark:invert`}
      style={{ opacity: 0.7 }}
    />
  )
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
  const isTablet = /iPad/.test(ua) || (isAndroid && !/Mobile/.test(ua))
  
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                       (window.navigator as any).standalone === true
  
  return { isIOS, isAndroid, isSafari, isChrome, isEdge, isFirefox, isSamsung, isOpera, isMac, isWindows, isTablet, isStandalone }
}

type Platform = 'ios' | 'android' | 'desktop' | 'extension'

// Chrome Extension Icon
const ChromeExtensionIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
    <circle cx="12" cy="12" r="4"/>
  </svg>
)

// Reusable card component for consistent styling
interface BrowserCardProps {
  browser: 'chrome' | 'safari' | 'firefox'
  name: string
  isRecommended?: boolean
  children: React.ReactNode
}

function BrowserCard({ browser, name, isRecommended, children }: BrowserCardProps) {
  const { t } = useTranslation()
  
  return (
    <div className="p-4 bg-neutral-100 dark:bg-neutral-800 rounded-2xl space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center">
          <BrowserIcon browser={browser} className="w-5 h-5" />
        </div>
        <span className="font-medium text-neutral-900 dark:text-white">{name}</span>
        {isRecommended && (
          <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-600 dark:text-green-400 rounded-full">
            {t('install.recommended')}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

export function DownloadAppModal({ isOpen, onClose }: DownloadAppModalProps) {
  const { t } = useTranslation()
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('ios')
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  
  const deviceInfo = getDeviceInfo()

  // Auto-select platform based on device
  useEffect(() => {
    if (deviceInfo.isIOS) {
      setSelectedPlatform('ios')
    } else if (deviceInfo.isAndroid) {
      setSelectedPlatform('android')
    } else {
      setSelectedPlatform('desktop')
    }
  }, [deviceInfo.isIOS, deviceInfo.isAndroid])

  // Listen for beforeinstallprompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleNativeInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        onClose()
      }
      setDeferredPrompt(null)
    }
  }

  if (!isOpen) return null

  const platforms: { id: Platform; icon: React.ReactNode; label: string }[] = [
    { id: 'ios', icon: <Smartphone className="w-4 h-4" />, label: 'iOS' },
    { id: 'android', icon: <Tablet className="w-4 h-4" />, label: 'Android' },
    { id: 'desktop', icon: <Monitor className="w-4 h-4" />, label: 'Desktop' },
    { id: 'extension', icon: <ChromeExtensionIcon className="w-4 h-4" />, label: t('install.chromeExtension') },
  ]

  // Step buttons component for consistent styling
  const StepButtons = ({ steps }: { steps: { icon: React.ReactNode; label: string }[] }) => (
    <div className="flex items-center gap-1.5 text-xs flex-wrap">
      {steps.map((step, index) => (
        <div key={index} className="contents">
          <div className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg">
            {step.icon}
            <span className="text-neutral-700 dark:text-neutral-200">{step.label}</span>
          </div>
          {index < steps.length - 1 && (
            <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
          )}
        </div>
      ))}
    </div>
  )

  const renderInstructions = () => {
    switch (selectedPlatform) {
      case 'ios':
        return (
          <div className="space-y-3">
            {/* Safari - Recommended */}
            <BrowserCard browser="safari" name="Safari" isRecommended>
              <p className="text-sm text-neutral-600 dark:text-neutral-300">
                {t('install.iosSafariInstructions')}
              </p>
              <StepButtons steps={[
                { icon: <Share className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-300" />, label: t('install.shareButton') },
                { icon: <Plus className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-300" />, label: t('install.addToHomeScreen') }
              ]} />
            </BrowserCard>

            {/* Chrome on iOS */}
            <BrowserCard browser="chrome" name="Chrome">
              <p className="text-sm text-neutral-600 dark:text-neutral-300">
                {t('install.iosChromeInstructions')}
              </p>
            </BrowserCard>
          </div>
        )

      case 'android':
        return (
          <div className="space-y-3">
            {/* Native install button if available */}
            {deferredPrompt && (
              <Button onClick={handleNativeInstall} className="w-full h-12 text-base">
                <Download className="w-5 h-5 mr-2" />
                {t('install.installNow')}
              </Button>
            )}

            {/* Chrome - Recommended */}
            <BrowserCard browser="chrome" name="Chrome / Edge" isRecommended>
              <p className="text-sm text-neutral-600 dark:text-neutral-300">
                {t('install.androidChromeInstructions')}
              </p>
              <StepButtons steps={[
                { icon: <MoreVertical className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-300" />, label: t('install.menu') },
                { icon: <Download className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-300" />, label: t('install.install') }
              ]} />
            </BrowserCard>

            {/* Firefox */}
            <BrowserCard browser="firefox" name="Firefox">
              <p className="text-sm text-neutral-600 dark:text-neutral-300">
                {t('install.androidFirefoxInstructions')}
              </p>
              <StepButtons steps={[
                { icon: <MoreVertical className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-300" />, label: t('install.menu') },
                { icon: <Download className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-300" />, label: t('install.install') }
              ]} />
            </BrowserCard>
          </div>
        )

      case 'desktop':
        return (
          <div className="space-y-3">
            {/* Native install button if available */}
            {deferredPrompt && (
              <Button onClick={handleNativeInstall} className="w-full h-12 text-base">
                <Download className="w-5 h-5 mr-2" />
                {t('install.installNow')}
              </Button>
            )}

            {/* Chrome/Edge - Recommended */}
            <BrowserCard browser="chrome" name="Chrome / Edge" isRecommended>
              <p className="text-sm text-neutral-600 dark:text-neutral-300">
                {t('install.desktopChromeInstructions')}
              </p>
            </BrowserCard>

            {/* Safari (macOS) */}
            <BrowserCard browser="safari" name="Safari (macOS)">
              <p className="text-sm text-neutral-600 dark:text-neutral-300">
                {t('install.desktopSafariInstructions')}
              </p>
            </BrowserCard>

            {/* Firefox notice - neutral background */}
            <div className="p-4 bg-neutral-100 dark:bg-neutral-800 rounded-2xl">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center">
                  <BrowserIcon browser="firefox" className="w-5 h-5" />
                </div>
                <span className="font-medium text-neutral-900 dark:text-white">Firefox</span>
              </div>
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-neutral-500 dark:text-neutral-400 mt-0.5 shrink-0" />
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {t('install.desktopFirefoxInstructions')}
                </p>
              </div>
            </div>
          </div>
        )

      case 'extension':
        return (
          <div className="space-y-3">
            {/* Chrome Extension Card */}
            <div className="p-4 bg-neutral-100 dark:bg-neutral-800 rounded-2xl space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center">
                  <BrowserIcon browser="chrome" className="w-5 h-5" />
                </div>
                <span className="font-medium text-neutral-900 dark:text-white">{t('install.chromeExtension')}</span>
                <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full">
                  {t('install.new')}
                </span>
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-300">
                {t('install.chromeExtensionDescription')}
              </p>
              <a
                href={CHROME_EXTENSION_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full h-10 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                {t('install.addToChrome')}
              </a>
            </div>

            {/* Info about extension */}
            <div className="p-4 bg-neutral-100 dark:bg-neutral-800 rounded-2xl">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-neutral-500 dark:text-neutral-400 mt-0.5 shrink-0" />
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {t('install.chromeExtensionInfo')}
                </p>
              </div>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center safe-x">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full sm:max-w-md bg-white dark:bg-neutral-900 rounded-t-3xl sm:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300 max-h-[90vh] overflow-hidden safe-bottom">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-neutral-900 px-5 pt-5 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* App Icon - always white background with black logo */}
              <div className="w-10 h-10 rounded-xl bg-white shadow-md flex items-center justify-center p-1.5">
                <img 
                  src="/g-note.svg"
                  alt="G-Note" 
                  className="w-full h-full"
                />
              </div>
              <div>
                <h2 className="font-semibold text-neutral-900 dark:text-white">
                  {t('install.downloadApp')}
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t('install.downloadDescription')}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Platform tabs */}
          <div className="flex gap-2 mt-4">
            {platforms.map((platform) => (
              <button
                key={platform.id}
                onClick={() => setSelectedPlatform(platform.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  selectedPlatform === platform.id
                    ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                {platform.icon}
                {platform.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto max-h-[60vh]">
          {deviceInfo.isStandalone ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-green-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="font-semibold text-neutral-900 dark:text-white mb-2">
                {t('install.alreadyInstalled')}
              </h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {t('install.alreadyInstalledDescription')}
              </p>
            </div>
          ) : (
            renderInstructions()
          )}
        </div>
      </div>
    </div>
  )
}
