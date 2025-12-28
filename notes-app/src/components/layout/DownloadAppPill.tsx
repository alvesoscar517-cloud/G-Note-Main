import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import { DownloadAppModal } from './DownloadAppModal'

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

// Chrome Icon (official Google Chrome logo)
const ChromeIcon = ({ className }: { className?: string }) => (
  <img 
    src="/chrome-color-svgrepo-com.svg" 
    alt="Chrome" 
    className={className}
  />
)

export function DownloadAppPill() {
  const { t } = useTranslation()
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Check if already installed as PWA
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                       (window.navigator as any).standalone === true

  // Don't show if already installed
  if (isStandalone) return null

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="group flex items-center gap-2.5 px-4 py-2.5 bg-white/40 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-full hover:bg-white/50 dark:hover:bg-black/50 transition-all shadow-lg"
        aria-label={t('install.downloadApp')}
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
          {/* Chrome Extension */}
          <div className="w-7 h-7 rounded-full bg-white dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-neutral-700">
            <ChromeIcon className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Text */}
        <span className="text-sm font-medium text-neutral-700 dark:text-white whitespace-nowrap">
          {t('install.getApp')}
        </span>

        {/* Arrow */}
        <ChevronRight className="w-4 h-4 text-neutral-500 dark:text-white/70 group-hover:translate-x-0.5 transition-transform" />
      </button>

      <DownloadAppModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  )
}
