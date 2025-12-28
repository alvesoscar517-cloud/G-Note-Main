import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe, Check } from 'lucide-react'
import { CircleFlag } from '@/components/ui/CircleFlag'
import { languages } from '@/locales'
import { cn } from '@/lib/utils'

// Map language codes to country codes for flags
const langToCountry: Record<string, string> = {
  'en': 'us',
  'vi': 'vn',
  'ja': 'jp',
  'ko': 'kr',
  'zh-CN': 'cn',
  'zh-TW': 'tw',
  'de': 'de',
  'fr': 'fr',
  'es': 'es',
  'pt-BR': 'br',
  'it': 'it',
  'nl': 'nl',
  'ar': 'sa',
  'hi': 'in',
  'tr': 'tr',
  'pl': 'pl',
  'th': 'th',
  'id': 'id',
}

// Memoized flag component to prevent re-renders
const MemoizedFlag = memo(function MemoizedFlag({ 
  countryCode, 
  size = 24,
  className
}: { 
  countryCode: string
  size?: number
  className?: string
}) {
  return (
    <CircleFlag 
      countryCode={countryCode} 
      size={size}
      className={cn("flex-shrink-0", className)}
    />
  )
})

interface LanguageSelectorProps {
  onClose?: () => void
}

export function LanguageSelector({ onClose }: LanguageSelectorProps) {
  const { i18n } = useTranslation()

  const handleSelect = (code: string) => {
    i18n.changeLanguage(code)
    // Update document direction for RTL languages
    const lang = languages.find(l => l.code === code)
    document.documentElement.dir = lang?.rtl ? 'rtl' : 'ltr'
    onClose?.()
  }

  return (
    <div className="w-full">
      {/* Language list */}
      <div className="max-h-[400px] overflow-y-auto p-1">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleSelect(lang.code)}
            className={cn(
              "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left transition-colors",
              "hover:bg-neutral-100 dark:hover:bg-neutral-800",
              i18n.language === lang.code && "bg-neutral-100 dark:bg-neutral-800"
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <MemoizedFlag countryCode={langToCountry[lang.code] || 'us'} size={20} />
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                  {lang.nativeName}
                </span>
                <span className="text-xs text-neutral-500 truncate">
                  {lang.name}
                </span>
              </div>
            </div>
            {i18n.language === lang.code && (
              <Check className="w-4 h-4 text-neutral-900 dark:text-white flex-shrink-0" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

export function LanguageButton({ onClick }: { onClick: () => void }) {
  const { i18n } = useTranslation()
  const currentLang = languages.find(l => l.code === i18n.language) || languages[0]
  
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-2 py-2.5 rounded-xl text-left text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors touch-manipulation"
    >
      <div className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
        <Globe className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{currentLang.nativeName}</p>
        <p className="text-[11px] mt-0.5 text-neutral-500 dark:text-neutral-500 truncate">
          {currentLang.name}
        </p>
      </div>
      <MemoizedFlag countryCode={langToCountry[currentLang.code] || 'us'} size={20} />
    </button>
  )
}
