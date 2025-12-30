import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { NoteEditor } from './NoteEditor'
import { useNotesStore } from '@/stores/notesStore'
import { useUIStore, type ModalSize } from '@/stores/uiStore'
import { cn } from '@/lib/utils'
import { getPlainText } from '@/lib/utils'
import { NoteBackground, getNoteBackgroundStyle } from './NoteStylePicker'
import { useEdgeSwipeBack, EdgeSwipeIndicator } from '@/hooks/useEdgeSwipeBack'
import { useHistoryBack } from '@/hooks/useHistoryBack'
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
// Uses spring physics for smoother interpolation at any frame rate (60Hz, 90Hz, 120Hz)
// Spring animations are frame-rate independent - they calculate position based on physics, not fixed keyframes
const LAYOUT_TRANSITION = { 
  layout: { 
    type: 'spring' as const,
    stiffness: 400,    // Higher = snappier response
    damping: 35,       // Higher = less bounce
    mass: 1,           // Lower = faster acceleration
    // Fallback for older devices
    duration: 0.3,
  }
}

// Content reveal - spring for smooth fade at any refresh rate
const CONTENT_TRANSITION = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 40,
  mass: 0.8,
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
    return state.notes.find(n => n.id === selectedNoteId) || 
           state.sharedNotes.find(n => n.id === selectedNoteId)
  }, [selectedNoteId]))
  
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [canExitFullscreen, setCanExitFullscreen] = useState(true)
  const userToggledRef = useRef(false)
  
  // Handle close function (defined early for useHistoryBack)
  const handleCloseRef = useRef<() => void>(() => {})
  
  // History back support for system back gesture (Android swipe, browser back button)
  useHistoryBack({
    isOpen: isModalOpen,
    onBack: () => handleCloseRef.current(),
    stateKey: 'note-modal'
  })
  
  // Check if modal should auto-fullscreen based on screen width
  const checkAutoFullscreen = useCallback(() => {
    const modalWidth = MODAL_MAX_WIDTHS[modalSize]
    const screenWidth = window.innerWidth
    const screenHeight = window.innerHeight
    const sideMargin = (screenWidth - modalWidth) / 2
    
    // Auto-fullscreen if:
    // 1. Side margins are too small (small screen)
    // 2. Landscape mode on mobile (height < 500px indicates mobile landscape)
    const isLandscapeMobile = screenHeight < 500 && screenWidth > screenHeight
    const shouldAutoFullscreen = sideMargin <= MIN_SIDE_MARGIN || isLandscapeMobile
    
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

  const handleClose = useCallback(() => {
    setIsFullscreen(false)
    setCanExitFullscreen(true)
    userToggledRef.current = false
    
    // Get fresh note from store to check if empty
    const freshNote = useNotesStore.getState().notes.find(n => n.id === selectedNoteId)
    if (freshNote) {
      const plainContent = getPlainText(freshNote.content).trim()
      const hasTitle = freshNote.title.trim().length > 0
      const hasContent = plainContent.length > 0
      
      if (!hasTitle && !hasContent) {
        // Empty notes should be permanently deleted, not moved to trash
        useNotesStore.getState().permanentlyDelete(freshNote.id)
        setModalOpen(false)
        return
      }
    }
    setModalOpen(false)
  }, [selectedNoteId, setModalOpen])
  
  // Keep handleCloseRef in sync for useHistoryBack
  useEffect(() => {
    handleCloseRef.current = handleClose
  }, [handleClose])

  const handleTogglePin = () => {
    if (displayNote) togglePin(displayNote.id)
  }

  // Edge swipe back gesture (swipe from left edge to close)
  const { 
    handlers: edgeSwipeHandlers, 
    swipeStyle: edgeSwipeStyle,
    swipeState: edgeSwipeState,
    progress: edgeSwipeProgress 
  } = useEdgeSwipeBack({
    onSwipeBack: handleClose,
    edgeWidth: 25,
    threshold: 100,
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
            layoutId={`note-card-${displayNote.id}`}
            transition={LAYOUT_TRANSITION}
            style={{ 
              willChange: 'transform',
              contain: 'layout style paint',
              ...backgroundStyle,
              // Apply edge swipe transform on mobile
              ...(edgeSwipeState.isDragging ? edgeSwipeStyle : {})
            }}
            className={cn(
              'fixed z-50 flex flex-col overflow-hidden',
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
            {...edgeSwipeHandlers}
          >
            {/* Edge swipe indicator */}
            <EdgeSwipeIndicator 
              progress={edgeSwipeProgress} 
              isActive={edgeSwipeState.isDragging && edgeSwipeState.startedFromEdge} 
            />
            <NoteBackground style={displayNote.style} className="md:rounded-[12px]" />

            {/* Content */}
            <motion.div 
              initial={{ opacity: 0.7 }}
              animate={{ opacity: 1 }}
              transition={CONTENT_TRANSITION}
              className="flex-1 overflow-hidden flex flex-col relative z-10"
            >
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
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
