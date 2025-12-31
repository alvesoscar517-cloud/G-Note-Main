import { useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Pin, Loader2, AlertCircle, Users, CloudCheck, Copy, Trash2, PinOff } from 'lucide-react'
import { motion } from 'framer-motion'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useNotesStore } from '@/stores/notesStore'
import { formatDate, getPlainText } from '@/lib/utils'
import { Highlight } from '@/components/ui/Highlight'
import { NoteBackground, getNoteBackgroundStyle } from './NoteStylePicker'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/ContextMenu'
import type { Note } from '@/types'
import { cn } from '@/lib/utils'

// Smooth transition config - optimized for 120Hz displays
// Uses critically damped spring for smooth, bounce-free animation
const LAYOUT_TRANSITION = { 
  layout: { 
    type: 'spring' as const,
    stiffness: 500,      // Higher stiffness = faster response
    damping: 40,         // Critical damping = no bounce
    mass: 0.8,           // Lower mass = snappier feel
    restDelta: 0.001,    // Smaller = smoother finish
    restSpeed: 0.001,
  }
}

// Hook to detect resize and temporarily disable layoutId to prevent ghost elements
function useResizeGuard() {
  const [isResizing, setIsResizing] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  useEffect(() => {
    const handleResize = () => {
      setIsResizing(true)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setIsResizing(false), 200)
    }
    
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])
  
  return isResizing
}

/**
 * Generate smart preview that shows context around search match
 * If no search query or match is in first 120 chars, return normal preview
 * Otherwise, return snippet around the match with ellipsis
 */
function getSmartPreview(plainContent: string, searchQuery?: string): string {
  const maxLength = 120
  
  // No search query - return normal preview
  if (!searchQuery?.trim()) {
    return plainContent.slice(0, maxLength) + (plainContent.length > maxLength ? '...' : '')
  }
  
  const query = searchQuery.toLowerCase()
  const contentLower = plainContent.toLowerCase()
  const matchIndex = contentLower.indexOf(query)
  
  // No match found or match is within first 120 chars - return normal preview
  if (matchIndex === -1 || matchIndex < maxLength - 20) {
    return plainContent.slice(0, maxLength) + (plainContent.length > maxLength ? '...' : '')
  }
  
  // Match is beyond preview area - create smart snippet
  const contextBefore = 40 // chars before match
  const contextAfter = 80 // chars after match
  
  const start = Math.max(0, matchIndex - contextBefore)
  const end = Math.min(plainContent.length, matchIndex + query.length + contextAfter)
  
  let snippet = plainContent.slice(start, end)
  
  // Add ellipsis
  if (start > 0) {
    // Find word boundary to avoid cutting words
    const firstSpace = snippet.indexOf(' ')
    if (firstSpace > 0 && firstSpace < 15) {
      snippet = snippet.slice(firstSpace + 1)
    }
    snippet = '...' + snippet
  }
  
  if (end < plainContent.length) {
    // Find word boundary at end
    const lastSpace = snippet.lastIndexOf(' ')
    if (lastSpace > snippet.length - 15 && lastSpace > 0) {
      snippet = snippet.slice(0, lastSpace)
    }
    snippet = snippet + '...'
  }
  
  return snippet
}

interface NoteCardProps {
  note: Note
  searchQuery?: string
}

export function NoteCard({ note, searchQuery }: NoteCardProps) {
  const { t } = useTranslation()
  const { setSelectedNote, setModalOpen, isSyncing, togglePin, deleteNote, duplicateNote } = useNotesStore()
  
  // Track if this card is animating (for z-index during morph)
  const isModalOpen = useNotesStore(state => state.isModalOpen)
  const selectedNoteId = useNotesStore(state => state.selectedNoteId)
  const isThisNoteSelected = selectedNoteId === note.id
  const [isAnimating, setIsAnimating] = useState(false)
  const isResizing = useResizeGuard()
  
  // Keep high z-index during close animation
  useEffect(() => {
    if (isThisNoteSelected && isModalOpen) {
      setIsAnimating(true)
    } else if (!isModalOpen && isAnimating) {
      // Modal closed, keep animating state longer for smooth transition
      const timer = setTimeout(() => setIsAnimating(false), 400)
      return () => clearTimeout(timer)
    }
  }, [isModalOpen, isThisNoteSelected, isAnimating])

  const handleClick = () => {
    setSelectedNote(note.id)
    setModalOpen(true)
  }

  const handleDuplicate = () => {
    duplicateNote(note.id)
  }

  const handleTogglePin = () => {
    togglePin(note.id)
  }

  const handleMoveToTrash = () => {
    deleteNote(note.id)
  }

  // Memoize expensive computations
  const plainContent = useMemo(() => getPlainText(note.content), [note.content])
  const preview = useMemo(() => 
    getSmartPreview(plainContent, searchQuery),
    [plainContent, searchQuery]
  )
  const title = note.title || t('notes.newNote')
  const backgroundStyle = useMemo(() => getNoteBackgroundStyle(note.style), [note.style])
  const hasCustomBg = note.style?.backgroundColor || note.style?.backgroundImage

  // Disable layoutId during resize to prevent ghost elements
  const layoutId = isResizing ? undefined : `note-card-${note.id}`

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <motion.div
            layoutId={layoutId}
            transition={LAYOUT_TRANSITION}
            style={{ 
              willChange: 'transform',
              contain: 'layout style paint',
              backfaceVisibility: 'hidden',
              transform: 'translateZ(0)', // Force GPU layer
              ...backgroundStyle,
              // High z-index during morph animation
              zIndex: isAnimating ? 40 : 'auto',
              position: isAnimating ? 'relative' : undefined
            }}
            onClick={handleClick}
            className={cn(
              "cursor-pointer rounded-[16px] border border-neutral-200 p-4 transition-shadow hover:shadow-md hover:border-neutral-300 dark:border-neutral-700 dark:hover:border-neutral-600 relative overflow-hidden",
              // Always have solid bg when using background image
              note.style?.backgroundImage ? "bg-white dark:bg-neutral-900" : (!hasCustomBg && "bg-white dark:bg-neutral-900")
            )}
          >
            <NoteBackground style={note.style} />
            <div className="flex items-start justify-between gap-2 relative z-10">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="font-semibold text-base text-neutral-900 dark:text-white line-clamp-1">
                  <Highlight text={title} query={searchQuery} />
                </h3>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {note.isPinned && (
                  <Pin className="w-4 h-4 text-neutral-400" />
                )}
                {note.isShared && (
                  <Users className="w-4 h-4 text-neutral-400" />
                )}
                <SyncIcon status={note.syncStatus} isSyncing={isSyncing} />
              </div>
            </div>
            
            {/* Content preview - fixed 2 line height for consistent card size */}
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 line-clamp-2 min-h-[2.5rem] relative z-10">
              {preview ? (
                searchQuery ? <Highlight text={preview} query={searchQuery} /> : preview
              ) : (
                <span className="text-neutral-300 dark:text-neutral-600">&nbsp;</span>
              )}
            </p>
            
            <p className="mt-3 text-xs text-neutral-400 dark:text-neutral-500 relative z-10">
              {formatDate(note.updatedAt)}
            </p>
          </motion.div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={handleTogglePin}>
            {note.isPinned ? <PinOff className="w-4 h-4 mr-2" /> : <Pin className="w-4 h-4 mr-2" />}
            {note.isPinned ? t('contextMenu.unpin') : t('contextMenu.pin')}
          </ContextMenuItem>
          <ContextMenuItem onClick={handleDuplicate}>
            <Copy className="w-4 h-4 mr-2" />
            {t('contextMenu.duplicate')}
          </ContextMenuItem>
          <ContextMenuItem onClick={handleMoveToTrash}>
            <Trash2 className="w-4 h-4 mr-2" />
            {t('trash.moveToTrash')}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </>
  )
}

// Draggable version of NoteCard
export function DraggableNoteCard({ note, searchQuery }: NoteCardProps) {
  const { t } = useTranslation()
  const { setSelectedNote, setModalOpen, isSyncing, isModalOpen, selectedNoteId, togglePin, deleteNote, duplicateNote } = useNotesStore()
  
  // Track if this card is animating (for z-index during morph)
  const isThisNoteSelected = selectedNoteId === note.id
  const [isAnimating, setIsAnimating] = useState(false)
  const isResizing = useResizeGuard()
  
  // Keep high z-index during close animation
  useEffect(() => {
    if (isThisNoteSelected && isModalOpen) {
      setIsAnimating(true)
    } else if (!isModalOpen && isAnimating) {
      // Modal closed, keep animating state longer for smooth transition
      const timer = setTimeout(() => setIsAnimating(false), 400)
      return () => clearTimeout(timer)
    }
  }, [isModalOpen, isThisNoteSelected, isAnimating])
  
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: note.id,
  })
  
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: note.id,
  })

  const handleClick = () => {
    if (!isDragging) {
      setSelectedNote(note.id)
      setModalOpen(true)
    }
  }

  const handleDuplicate = () => {
    duplicateNote(note.id)
  }

  const handleTogglePin = () => {
    togglePin(note.id)
  }

  const handleMoveToTrash = () => {
    deleteNote(note.id)
  }

  // Memoize expensive computations
  const plainContent = useMemo(() => getPlainText(note.content), [note.content])
  const preview = useMemo(() => 
    getSmartPreview(plainContent, searchQuery),
    [plainContent, searchQuery]
  )
  const title = note.title || t('notes.newNote')
  const backgroundStyle = useMemo(() => getNoteBackgroundStyle(note.style), [note.style])
  const hasCustomBg = note.style?.backgroundColor || note.style?.backgroundImage

  // Hide original card when dragging (will show in DragOverlay)
  if (isDragging) {
    return (
      <div
        ref={(node) => {
          setDragRef(node)
          setDropRef(node)
        }}
        className="opacity-0"
      />
    )
  }

  // Card is hidden when modal is open (morph effect shows modal instead)
  const isThisNoteOpen = isModalOpen && isThisNoteSelected
  
  // Disable layoutId during resize to prevent ghost elements
  const layoutId = isResizing ? undefined : `note-card-${note.id}`

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={(node) => {
              setDragRef(node)
              setDropRef(node)
            }}
            {...listeners}
            {...attributes}
          >
            <motion.div
              layoutId={layoutId}
              onClick={handleClick}
              transition={LAYOUT_TRANSITION}
              style={{ 
                willChange: 'transform',
                contain: 'layout style paint',
                backfaceVisibility: 'hidden',
                transform: 'translateZ(0)', // Force GPU layer
                opacity: isThisNoteOpen ? 0 : 1,
                // High z-index during morph animation
                zIndex: isAnimating ? 40 : 'auto',
                position: isAnimating ? 'relative' : undefined,
                ...backgroundStyle
              }}
              className={cn(
                "cursor-pointer rounded-[16px] border border-neutral-200 p-4 transition-shadow hover:shadow-md hover:border-neutral-300 dark:border-neutral-700 dark:hover:border-neutral-600 touch-none relative overflow-hidden",
                // Always have solid bg when using background image
                note.style?.backgroundImage ? "bg-white dark:bg-neutral-900" : (!hasCustomBg && "bg-white dark:bg-neutral-900"),
                isOver && "ring-1 ring-neutral-900 dark:ring-white ring-offset-2 dark:ring-offset-neutral-900"
              )}
            >
              <NoteBackground style={note.style} />
              <div className="flex items-start justify-between gap-2 relative z-10">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="font-semibold text-base text-neutral-900 dark:text-white line-clamp-1">
                    <Highlight text={title} query={searchQuery} />
                  </h3>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {note.isPinned && (
                    <Pin className="w-4 h-4 text-neutral-400" />
                  )}
                  {note.isShared && (
                    <Users className="w-4 h-4 text-neutral-400" />
                  )}
                  <SyncIcon status={note.syncStatus} isSyncing={isSyncing} />
                </div>
              </div>
              
              {/* Content preview - fixed 2 line height for consistent card size */}
              <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 line-clamp-2 min-h-[2.5rem] relative z-10">
                {preview ? (
                  searchQuery ? <Highlight text={preview} query={searchQuery} /> : preview
                ) : (
                  <span className="text-neutral-300 dark:text-neutral-600">&nbsp;</span>
                )}
              </p>              
              <p className="mt-3 text-xs text-neutral-400 dark:text-neutral-500 relative z-10">
                {formatDate(note.updatedAt)}
              </p>
            </motion.div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={handleTogglePin}>
            {note.isPinned ? <PinOff className="w-4 h-4 mr-2" /> : <Pin className="w-4 h-4 mr-2" />}
            {note.isPinned ? t('contextMenu.unpin') : t('contextMenu.pin')}
          </ContextMenuItem>
          <ContextMenuItem onClick={handleDuplicate}>
            <Copy className="w-4 h-4 mr-2" />
            {t('contextMenu.duplicate')}
          </ContextMenuItem>
          <ContextMenuItem onClick={handleMoveToTrash}>
            <Trash2 className="w-4 h-4 mr-2" />
            {t('trash.moveToTrash')}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </>
  )
}

function SyncIcon({ status, isSyncing }: { status: Note['syncStatus'], isSyncing: boolean }) {
  // If currently syncing and this note is pending, show spinner
  if (isSyncing && status === 'pending') {
    return <Loader2 className="w-4 h-4 text-neutral-400 animate-spin" />
  }

  switch (status) {
    case 'synced':
      return <CloudCheck className="w-4 h-4 text-neutral-400" />
    case 'pending':
      // Not syncing, just pending - show subtle indicator
      return <div className="w-2 h-2 rounded-full bg-amber-400" />
    case 'error':
      // Use neutral color instead of red to match app tone
      return <AlertCircle className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
  }
}
