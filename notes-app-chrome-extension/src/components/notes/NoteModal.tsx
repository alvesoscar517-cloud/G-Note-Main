import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { NoteEditor } from './NoteEditor'
import { useNotesStore } from '@/stores/notesStore'
import { useUIStore, type ModalSize } from '@/stores/uiStore'
import { cn } from '@/lib/utils'
import { getPlainText } from '@/lib/utils'
import { NoteBackground, getNoteBackgroundStyle } from './NoteStylePicker'
import { useSwipeGesture } from '@/hooks/useSwipeGesture'
import { EditorErrorBoundary } from '@/components/ui/ErrorBoundary'
import type { Note } from '@/types'

// Modal max-width in pixels for each size
const MODAL_MAX_WIDTHS: Record<ModalSize, number> = {
  default: 672,  // max-w-2xl = 42rem = 672px
  large: 896,    // max-w-4xl = 56rem = 896px
  xlarge: 1024   // max-w-5xl = 64rem = 1024px
}

// Minimum margin on each side (in pixels) before auto-fullscreen
const MIN_SIDE_MARGIN = 32

// Modal size configurations
const MODAL_SIZES: Record<ModalSize, string> = {
  default: 'md:w-full md:max-w-2xl md:h-[70vh] md:max-h-[600px]',
  large: 'md:w-full md:max-w-4xl md:h-[80vh] md:max-h-[700px]',
  xlarge: 'md:w-full md:max-w-5xl md:h-[85vh] md:max-h-[800px]'
}

// High refresh rate optimized transition config
// Uses critically damped spring for smooth, bounce-free animation at any frame rate
const LAYOUT_TRANSITION = { 
  layout: { 
    type: 'spring' as const,
    stiffness: 500,      // Higher = snappier response
    damping: 40,         // Critical damping = no bounce
    mass: 0.8,           // Lower = faster acceleration
    restDelta: 0.001,    // Smaller = smoother finish
    restSpeed: 0.001,
  }
}

// Fullscreen transition - slightly faster for snappy feel
const FULLSCREEN_TRANSITION = {
  layout: {
    type: 'spring' as const,
    stiffness: 600,
    damping: 45,
    mass: 0.7,
    restDelta: 0.001,
    restSpeed: 0.001,
  }
}

// Content reveal - quick fade with spring
const CONTENT_TRANSITION = {
  type: 'spring' as const,
  stiffness: 600,
  damping: 45,
  mass: 0.7,
}

export function NoteModal() {
  const isModalOpen = useNotesStore(state => state.isModalOpen)
  const setModalOpen = useNotesStore(state => state.setModalOpen)
  const selectedNoteId = useNotesStore(state => state.selectedNoteId)
  const togglePin = useNotesStore(state => state.togglePin)
  const modalSize = useUIStore(state => state.modalSize)
  
  // Subscribe to the specific note by ID - memoized selector
  const note = useNotesStore(useCallback((state) => {
    if (!selectedNoteId) return undefined
    return state.notes.find(n => n.id === selectedNoteId)
  }, [selectedNoteId]))
  
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isFullscreenAnimating, setIsFullscreenAnimating] = useState(false) // Track animation state
  const [canExitFullscreen, setCanExitFullscreen] = useState(true)
  const userToggledRef = useRef(false)
  const [isClosing, setIsClosing] = useState(false) // Track if modal is closing to re-enable layoutId
  
  // Check if modal should auto-fullscreen based on screen width
  const checkAutoFullscreen = useCallback(() => {
    const modalWidth = MODAL_MAX_WIDTHS[modalSize]
    const screenWidth = window.innerWidth
    const sideMargin = (screenWidth - modalWidth) / 2
    
    // Auto-fullscreen if side margins are too small
    const shouldAutoFullscreen = sideMargin <= MIN_SIDE_MARGIN
    
    // Update whether user can exit fullscreen
    setCanExitFullscreen(!shouldAutoFullscreen)
    
    // Only auto-change if user hasn't manually toggled
    if (!userToggledRef.current) {
      setIsFullscreen(shouldAutoFullscreen)
    }
  }, [modalSize])
  
  // Check auto-fullscreen on mount and window resize
  useEffect(() => {
    if (!isModalOpen) return
    
    // Initial check
    checkAutoFullscreen()
    
    // Listen for resize
    const handleResize = () => {
      checkAutoFullscreen()
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isModalOpen, checkAutoFullscreen])
  
  // Re-check when modal size changes
  useEffect(() => {
    if (isModalOpen) {
      checkAutoFullscreen()
    }
  }, [modalSize, isModalOpen, checkAutoFullscreen])
  
  // Local state to keep note data even if store temporarily loses it
  const [localNote, setLocalNote] = useState<Note | undefined>(undefined)
  
  // Sync local note with store note - only update on meaningful changes
  useEffect(() => {
    if (note) {
      setLocalNote(note)
    }
  }, [note?.id, note?.isPinned, note?.title, note?.content, note?.style])
  
  // Clear local note when modal closes
  useEffect(() => {
    if (!isModalOpen) {
      // Delay to allow animation
      const timer = setTimeout(() => {
        setLocalNote(undefined)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isModalOpen])
  
  // The note to render - prefer store note, fallback to local
  const displayNote = note || localNote
  
  // Memoize background style to prevent recalculation
  const backgroundStyle = useMemo(() => 
    displayNote ? getNoteBackgroundStyle(displayNote.style) : {},
    [displayNote?.style?.backgroundColor, displayNote?.style?.backgroundImage]
  )
  
  const hasCustomBg = displayNote?.style?.backgroundColor || displayNote?.style?.backgroundImage

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false)
        } else {
          handleClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFullscreen])

  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden'
      document.body.classList.add('modal-open')
      setIsClosing(false)
      // Note: Don't call onModalOpen() here because NoteModal is fullscreen
      // and doesn't need the status bar overlay effect
    } else {
      document.body.style.overflow = ''
      document.body.classList.remove('modal-open')
    }
    return () => {
      document.body.style.overflow = ''
      document.body.classList.remove('modal-open')
    }
  }, [isModalOpen])

  const handleClose = () => {
    setIsFullscreen(false)
    setCanExitFullscreen(true)
    userToggledRef.current = false
    setIsClosing(true) // Enable layoutId for closing animation
    
    // Only check for empty notes that were JUST CREATED (never had content)
    // Don't auto-delete notes that had content and were then emptied - let users decide
    const freshNote = useNotesStore.getState().notes.find(n => n.id === selectedNoteId)
    if (freshNote) {
      const plainContent = getPlainText(freshNote.content).trim()
      const hasTitle = freshNote.title.trim().length > 0
      const hasContent = plainContent.length > 0
      
      // Only auto-delete if note was never modified (brand new empty note)
      // Check if createdAt and updatedAt are very close (within 1 second) = never edited
      const isNewNote = Math.abs(freshNote.updatedAt - freshNote.createdAt) < 1000
      
      if (!hasTitle && !hasContent && isNewNote) {
        // Only permanently delete brand new empty notes
        useNotesStore.getState().permanentlyDelete(freshNote.id)
        setModalOpen(false)
        return
      }
    }
    setModalOpen(false)
  }

  const handleTogglePin = () => {
    if (displayNote) togglePin(displayNote.id)
  }

  // Swipe down to close on mobile (only on fullscreen/mobile view)
  const { handlers: swipeHandlers } = useSwipeGesture({
    onSwipeDown: handleClose,
    threshold: 80,
    enabled: isModalOpen
  })

  // If viewing a public note, show the view page
  if (!displayNote) return null

  return (
    <AnimatePresence mode="wait">
      {isModalOpen && displayNote && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="hidden md:block fixed inset-0 bg-black/50 z-40"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            layoutId={isModalOpen && !isClosing ? undefined : `note-card-${displayNote.id}`}
            transition={isFullscreenAnimating ? FULLSCREEN_TRANSITION : LAYOUT_TRANSITION}
            onLayoutAnimationStart={() => setIsFullscreenAnimating(true)}
            onLayoutAnimationComplete={() => setIsFullscreenAnimating(false)}
            style={{ 
              willChange: 'transform',
              contain: 'layout style paint',
              backfaceVisibility: 'hidden',
              perspective: 1000,
              transformStyle: 'preserve-3d',
              ...backgroundStyle 
            }}
            className={cn(
              'fixed flex flex-col overflow-hidden',
              // Higher z-index when closing to ensure animation is visible above other cards
              isClosing ? 'z-[100]' : 'z-50',
              'inset-0',
              'md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2',
              'md:rounded-[12px] md:shadow-2xl md:border md:border-neutral-200 md:dark:border-neutral-700',
              // Always have solid bg - either custom color or default
              displayNote.style?.backgroundImage 
                ? 'bg-white dark:bg-neutral-900' 
                : (!hasCustomBg && 'bg-white dark:bg-neutral-900'),
              isFullscreen 
                ? 'md:w-full md:h-full md:max-w-none md:max-h-none md:rounded-none md:border-0' 
                : MODAL_SIZES[modalSize]
            )}
          >
            <NoteBackground style={displayNote.style} className="rounded-[12px]" />
            
            {/* Swipe indicator for mobile - drag down to close */}
            <div 
              className="md:hidden flex justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing touch-manipulation safe-top"
              {...swipeHandlers}
            >
              <div className="w-10 h-1 bg-neutral-300 dark:bg-neutral-600 rounded-full swipe-indicator" />
            </div>
            
            {/* Mobile Header - only visible on mobile, scrolls with content via NoteEditor */}
            {/* Desktop header is handled inside NoteEditor's scrollable area */}

            {/* Content */}
            <motion.div 
              initial={{ opacity: 0.7 }}
              animate={{ opacity: 1 }}
              transition={CONTENT_TRANSITION}
              className="flex-1 overflow-hidden flex flex-col relative z-10"
            >
              <EditorErrorBoundary onReset={handleClose}>
                <NoteEditor 
                  key={displayNote.id}
                  note={displayNote}
                  onClose={handleClose} 
                  onTogglePin={handleTogglePin} 
                  isPinned={displayNote.isPinned}
                  isFullscreen={isFullscreen}
                  canToggleFullscreen={canExitFullscreen}
                  onToggleFullscreen={() => {
                    userToggledRef.current = true
                    setIsFullscreen(!isFullscreen)
                  }}
                />
              </EditorErrorBoundary>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
