/**
 * LoadingDots - Unified loading indicator component
 * Used for: HTML splash screen, LoadingOverlay, Logout overlay
 * Design: 3 dots with pulse animation, centered on screen
 */

interface LoadingDotsProps {
  /** Size of each dot in pixels */
  size?: 'sm' | 'md' | 'lg'
  /** Color variant */
  variant?: 'default' | 'muted'
}

export function LoadingDots({ size = 'md', variant = 'default' }: LoadingDotsProps) {
  const sizeClasses = {
    sm: 'w-1.5 h-1.5 gap-1',
    md: 'w-2 h-2 gap-1.5',
    lg: 'w-2.5 h-2.5 gap-2'
  }
  
  const colorClasses = {
    default: 'bg-neutral-400 dark:bg-neutral-500',
    muted: 'bg-neutral-300 dark:bg-neutral-600'
  }

  const dotSize = sizeClasses[size].split(' ').slice(0, 2).join(' ')
  const gap = sizeClasses[size].split(' ')[2]

  return (
    <div className={`flex items-center ${gap}`} role="status" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`${dotSize} rounded-full ${colorClasses[variant]} animate-loading-dot`}
          style={{
            animationDelay: `${i * 0.16}s`
          }}
        />
      ))}
    </div>
  )
}

/**
 * LoadingScreen - Full screen loading overlay with centered dots
 * Used for: Initial app load, public note loading, logout
 */
interface LoadingScreenProps {
  isVisible: boolean
  /** Optional text below dots */
  text?: string
}

export function LoadingScreen({ isVisible, text }: LoadingScreenProps) {
  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-950 transition-opacity duration-300 status-bar-bg">
      <div className="flex flex-col items-center gap-4">
        <LoadingDots size="md" />
        {text && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400 animate-fade-in">
            {text}
          </p>
        )}
      </div>
    </div>
  )
}
