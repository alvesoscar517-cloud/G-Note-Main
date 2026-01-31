import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { NoteEditor } from './NoteEditor'
import { useNotesStore } from '@/stores/notesStore'
import { useAppStore, type ModalSize } from '@/stores/appStore'
import { syncManager } from '@/lib/sync/simpleSyncManager'
import { cn } from '@/lib/utils'
import { getPlainText } from '@/lib/utils'
import { NoteBackground, getNoteBackgroundStyle } from './NoteStylePicker'
import { useEdgeSwipeBack, EdgeSwipeIndicator } from '@/hooks/useEdgeSwipeBack'
import { useHistoryBack } from '@/hooks/useHistoryBack'
import { EditorErrorBoundary } from '@/components/ui/ErrorBoundary'
import type { Note } from '@/types'

// Modal max-width in pixels for each size
const MODAL_MAX_WIDTHS: Record<ModalSize, number> = {
  default: 672,  // max-w-2xl = 42rem = 672px
  large: 896,    // max-w-4xl = 56rem = 896px
  xlarge: 1024,  // max-w-5xl = 64rem = 1024px
  fullscreen: 9999 // Always fullscreen
}

// Minimum margin on each side (in pixels) before auto-fullscreen
const MIN_SIDE_MARGIN = 32

// Modal size configurations
const MODAL_SIZES: Record<ModalSize, string> = {
  default: 'md:w-full md:max-w-2xl md:h-[70vh] md:max-h-[600px]',
  large: 'md:w-full md:max-w-4xl md:h-[80vh] md:max-h-[700px]',
  xlarge: 'md:w-full md:max-w-5xl md:h-[85vh] md:max-h-[800px]',
  fullscreen: 'md:w-full md:h-full md:max-w-none md:max-h-none'
}

interface NoteModalProps {
  isFreeMode?: boolean // Free mode: always fullscreen, no close button
}

export function NoteModal({ isFreeMode = false }: NoteModalProps = {}) {
  const isModalOpen = useNotesStore(state => state.isModalOpen)
  const setModalOpen = useNotesStore(state => state.setModalOpen)
  const selectedNoteId = useNotesStore(state => state.selectedNoteId)
  const togglePin = useNotesStore(state => state.togglePin)
  const modalSize = useAppStore(state => state.modalSize)

  // Subscribe to the specific note by ID - memoized selector
  const note = useNotesStore(useCallback((state) => {
    if (!selectedNoteId) return undefined
    return state.notes.find(n => n.id === selectedNoteId)
  }, [selectedNoteId]))

  const [isFullscreen, setIsFullscreen] = useState(false)
  const [canExitFullscreen, setCanExitFullscreen] = useState(true)
  const userToggledRef = useRef(false)

  // Track if note ever had content (to avoid auto-deleting notes that user intentionally emptied)
  const noteEverHadContentRef = useRef(false)

  // Track if note was modified during this session (to avoid unnecessary sync)
  const noteWasModifiedRef = useRef(false)

  // Handle close function (defined early for useHistoryBack)
  const handleCloseRef = useRef<() => void>(() => { })

  // History back support for system back gesture (Android swipe, browser back button)
  useHistoryBack({
    isOpen: isModalOpen,
    onBack: () => handleCloseRef.current(),
    stateKey: 'note-modal'
  })

  // Check if modal should auto-fullscreen based on screen width
  const checkAutoFullscreen = useCallback(() => {
    // Free mode: always fullscreen, no exit
    if (isFreeMode) {
      setIsFullscreen(true)
      setCanExitFullscreen(false)
      return
    }

    // If modalSize is set to fullscreen, always use fullscreen
    if (modalSize === 'fullscreen') {
      setIsFullscreen(true)
      setCanExitFullscreen(false) // Hide fullscreen button when modalSize is fullscreen
      return
    }

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
  }, [modalSize, isFreeMode])

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

  // Local state to keep note data for closing animation only
  // This prevents the modal from disappearing before animation completes
  const [localNote, setLocalNote] = useState<Note | undefined>(undefined)

  // Store initial note state to detect changes
  const initialNoteStateRef = useRef<{ title: string; content: string } | null>(null)

  // Only sync localNote when note ID changes or note appears/disappears
  // Don't sync on every title/content change - store note is source of truth
  useEffect(() => {
    if (note) {
      setLocalNote(note)
      // Store initial state to detect changes later
      initialNoteStateRef.current = { title: note.title, content: note.content }
      noteWasModifiedRef.current = false // Reset modification tracking
      // Check if note has content when first opened
      const plainContent = getPlainText(note.content).trim()
      const hasTitle = note.title.trim().length > 0
      const hasContent = plainContent.length > 0
      if (hasTitle || hasContent) {
        noteEverHadContentRef.current = true
      }
    } else {
      // Reset when note changes
      noteEverHadContentRef.current = false
      initialNoteStateRef.current = null
    }
    // Note: intentionally only depend on note?.id to avoid unnecessary updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id])

  // Clear local note when modal closes
  useEffect(() => {
    if (!isModalOpen) {
      // Delay to allow animation
      const timer = setTimeout(() => {
        setLocalNote(undefined)
        noteEverHadContentRef.current = false // Reset for next note
        noteWasModifiedRef.current = false
        initialNoteStateRef.current = null
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isModalOpen])

  // Track if note ever had content and if it was modified during this session
  useEffect(() => {
    if (note) {
      const plainContent = getPlainText(note.content).trim()
      const hasTitle = note.title.trim().length > 0
      const hasContent = plainContent.length > 0

      // Track if note ever had content
      if (!noteEverHadContentRef.current && (hasTitle || hasContent)) {
        noteEverHadContentRef.current = true
      }

      // Track if note was modified from initial state
      if (initialNoteStateRef.current && !noteWasModifiedRef.current) {
        const titleChanged = note.title !== initialNoteStateRef.current.title
        const contentChanged = note.content !== initialNoteStateRef.current.content
        if (titleChanged || contentChanged) {
          noteWasModifiedRef.current = true
        }
      }
    }
  }, [note?.title, note?.content])

  // The note to render - always prefer store note (live data), fallback to local (for animation)
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
        // Free mode: don't close on ESC
        if (isFreeMode) return

        if (isFullscreen) {
          setIsFullscreen(false)
        } else {
          handleClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFullscreen, isFreeMode])

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

  const handleClose = useCallback(async () => {
    setIsFullscreen(false)
    setCanExitFullscreen(true)
    userToggledRef.current = false

    // Flush pending saves before closing
    await syncManager.flush()

    // Auto-delete empty notes when closing modal
    // This handles both: new notes that were never filled, and notes that were emptied
    const freshNote = useNotesStore.getState().notes.find(n => n.id === selectedNoteId)
    if (freshNote) {
      const plainContent = getPlainText(freshNote.content).trim()
      const hasTitle = freshNote.title.trim().length > 0
      const hasContent = plainContent.length > 0

      if (!hasTitle && !hasContent) {
        // Delete empty notes when closing (regardless of whether they ever had content)
        console.log('[NoteModal] Auto-deleting empty note:', freshNote.id)
        useNotesStore.getState().permanentlyDelete(freshNote.id)
        setModalOpen(false)
        return
      }
    }

    setModalOpen(false)

    // Only trigger sync if note was actually modified
    if (noteWasModifiedRef.current) {
      await syncManager.sync()
    }
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
    <>
      {isModalOpen && displayNote && (
        <>
          {/* Backdrop - hidden in free mode */}
          {!isFreeMode && (
            <div
              className="hidden md:block fixed inset-0 bg-black/50 z-40 transition-opacity duration-200"
              style={{ opacity: isModalOpen ? 1 : 0 }}
              onClick={handleClose}
            />
          )}

          {/* Modal */}
          <div
            style={{
              ...backgroundStyle,
              // Apply edge swipe transform on mobile
              ...(edgeSwipeState.isDragging ? edgeSwipeStyle : {})
            }}
            className={cn(
              'fixed flex flex-col overflow-hidden z-50',
              'inset-0',
              'md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2',
              // Always have solid bg - either custom color or default
              displayNote.style?.backgroundImage
                ? 'bg-white dark:bg-neutral-900'
                : (!hasCustomBg && 'bg-white dark:bg-neutral-900'),
              // Fullscreen mode: always show with rounded corners and border for better aesthetics
              isFullscreen || modalSize === 'fullscreen'
                ? 'md:w-full md:h-full md:max-w-none md:max-h-none md:rounded-[16px] md:shadow-2xl md:border md:border-neutral-200 md:dark:border-neutral-700'
                : cn(
                  'md:rounded-[16px] md:shadow-2xl md:border md:border-neutral-200 md:dark:border-neutral-700',
                  MODAL_SIZES[modalSize]
                )
            )}
            {...edgeSwipeHandlers}
          >
            {/* Edge swipe indicator */}
            <EdgeSwipeIndicator
              progress={edgeSwipeProgress}
              isActive={edgeSwipeState.isDragging && edgeSwipeState.startedFromEdge}
            />
            <NoteBackground style={displayNote.style} className="md:rounded-[16px]" />

            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col relative z-10">
              <EditorErrorBoundary onReset={handleClose}>
                <NoteEditor
                  key={displayNote.id}
                  note={displayNote}
                  onClose={handleClose}
                  onTogglePin={handleTogglePin}
                  isPinned={displayNote.isPinned}
                  isFullscreen={isFullscreen}
                  canToggleFullscreen={canExitFullscreen}
                  isFreeMode={isFreeMode}
                  onToggleFullscreen={() => {
                    userToggledRef.current = true
                    setIsFullscreen(!isFullscreen)
                  }}
                />
              </EditorErrorBoundary>
            </div>
          </div>
        </>
      )}
    </>
  )
}
