import { useEffect, useRef, useCallback, useState } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useEdgeSwipeBack } from '@/hooks/useEdgeSwipeBack'
import { onModalOpen, onModalClose } from '@/stores/themeStore'

// Spring config for smooth morph animations - optimized for 120Hz displays
const MORPH_SPRING = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 35,
  mass: 0.8,
}

// Faster spring for backdrop
const BACKDROP_SPRING = {
  type: 'spring' as const,
  stiffness: 600,
  damping: 40,
}

interface TriggerRect {
  x: number
  y: number
  width: number
  height: number
}

interface MorphModalProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  /** Trigger element ref for morph animation origin */
  triggerRef?: React.RefObject<HTMLElement>
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
  triggerRef,
  maxWidth = 'max-w-sm',
  className,
  updateStatusBar = true,
  zIndex = 50,
}: MorphModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const [triggerRect, setTriggerRect] = useState<TriggerRect | null>(null)

  // Capture trigger position when opening
  useEffect(() => {
    if (open && triggerRef?.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setTriggerRect({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      })
    } else if (!open) {
      // Clear trigger rect when closing to prepare for next open
      setTriggerRect(null)
    }
  }, [open, triggerRef])

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

  // Calculate initial position for morph effect
  const getInitialPosition = useCallback(() => {
    if (!triggerRect) {
      return { opacity: 0, scale: 0.95, y: 20 }
    }
    
    const screenCenterX = window.innerWidth / 2
    const screenCenterY = window.innerHeight / 2
    const triggerCenterX = triggerRect.x + triggerRect.width / 2
    const triggerCenterY = triggerRect.y + triggerRect.height / 2
    
    return {
      opacity: 0,
      scale: 0.3,
      x: triggerCenterX - screenCenterX,
      y: triggerCenterY - screenCenterY,
    }
  }, [triggerRect])

  const modalVariants: Variants = {
    hidden: getInitialPosition(),
    visible: {
      opacity: 1,
      scale: 1,
      x: 0,
      y: 0,
      transition: MORPH_SPRING,
    },
    exit: {
      ...getInitialPosition(),
      transition: { ...MORPH_SPRING, stiffness: 600 },
    },
  }

  const backdropVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: BACKDROP_SPRING },
    exit: { opacity: 0, transition: { duration: 0.15 } },
  }

  return (
    <AnimatePresence mode="wait">
      {open && (
        <div 
          className="fixed inset-0 flex items-center justify-center p-2 sm:p-4 safe-x"
          style={{ zIndex }}
        >
          {/* Backdrop */}
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
          />
          
          {/* Modal */}
          <motion.div
            ref={modalRef}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
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
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

// Hook to create a trigger ref and handler
export function useMorphTrigger() {
  const triggerRef = useRef<HTMLButtonElement>(null)
  return triggerRef
}
