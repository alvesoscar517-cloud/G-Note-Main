import { useTranslation } from 'react-i18next'
import Lottie from 'lottie-react'
import { useThemeStore } from '@/stores/themeStore'
import { useEffect, useState } from 'react'

interface EmptyStateProps {
  type: 'no-notes' | 'no-results'
  searchQuery?: string
}

export function EmptyState({ type, searchQuery }: EmptyStateProps) {
  const { t } = useTranslation()
  const { theme } = useThemeStore()
  const [animationData, setAnimationData] = useState<object | null>(null)
  
  // Determine filter color based on theme
  const isDark = theme === 'dark' || 
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  
  // Load Lottie animation for welcome state
  useEffect(() => {
    if (type === 'no-notes') {
      fetch('/Waving.json')
        .then(res => res.json())
        .then(data => setAnimationData(data))
        .catch(() => setAnimationData(null))
    }
  }, [type])
  
  const content = type === 'no-notes' 
    ? {
        title: t('emptyState.welcome'),
        description: t('emptyState.getStarted')
      }
    : {
        title: t('emptyState.noResults'),
        description: searchQuery 
          ? t('emptyState.noResultsFor', { query: searchQuery })
          : t('emptyState.tryDifferent')
      }

  return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-[60vh] text-center px-4">
      {type === 'no-notes' && animationData ? (
        // Lottie animation for welcome screen
        <div className="w-40 h-40 mb-3">
          <Lottie 
            animationData={animationData}
            loop={true}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      ) : (
        // Static chibi monster for search results
        <img 
          src="/monster-chibi.svg" 
          alt="Monster mascot"
          className="w-32 h-32 mb-3"
          style={{ 
            filter: isDark ? 'invert(1)' : 'none',
            opacity: 0.7
          }}
        />
      )}
      <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
        {content.title}
      </h3>
      <p className="text-neutral-500 dark:text-neutral-400 max-w-sm">
        {content.description}
      </p>
    </div>
  )
}
