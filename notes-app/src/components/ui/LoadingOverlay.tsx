import { LoadingDots } from './LoadingDots'

interface LoadingOverlayProps {
  isVisible: boolean
  /** Optional text below dots */
  text?: string
}

/**
 * LoadingOverlay - Full screen loading with centered dots
 * Used for: Public note loading, logout, etc.
 * Design: Simple 3 dots animation, no icon
 */
export function LoadingOverlay({ isVisible, text }: LoadingOverlayProps) {
  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-950 transition-opacity duration-300">
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
