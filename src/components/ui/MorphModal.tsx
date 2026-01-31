import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useEdgeSwipeBack } from '@/hooks/useEdgeSwipeBack'
import { onModalOpen, onModalClose } from '@/stores/appStore'

interface MorphModalProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  /** Custom max width class */
  maxWidth?: string
  /** Additional className for the modal */
  className?: string
  /** Whether to update status bar color */
  updateStatusBar?: boolean
  /** Z-index for the modal */
  zIndex?: number
}

export function MorphModal({
  open,
  onClose,
  children,
  maxWidth = 'max-w-sm',
  className,
  updateStatusBar = true,
  zIndex = 50,
}: MorphModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  // Edge swipe to close
  const { swipeStyle } = useEdgeSwipeBack({
    onSwipeBack: onClose,
    edgeWidth: 25,
    threshold: 80,
    enabled: open
  })

  // Handle escape key and body scroll
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
      if (updateStatusBar) onModalOpen()
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
      if (open && updateStatusBar) onModalClose()
    }
  }, [open, onClose, updateStatusBar])

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 flex items-center justify-center p-2 sm:p-4 safe-x"
          style={{ zIndex }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 transition-opacity duration-200"
            style={{ opacity: open ? 1 : 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <div
            ref={modalRef}
            style={swipeStyle}
            className={cn(
              'relative w-full max-h-[90vh] overflow-y-auto',
              'bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl',
              'border border-neutral-200 dark:border-neutral-700 modal-safe-area',
              maxWidth,
              className
            )}
          >
            {children}
          </div>
        </div>
      )}
    </>
  )
}

// Hook to create a trigger ref and handler
export function useMorphTrigger() {
  const triggerRef = useRef<HTMLButtonElement>(null)
  return triggerRef
}
