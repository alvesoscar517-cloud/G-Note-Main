import { useState, useEffect, useMemo } from 'react'
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

// Smooth transition config - longer duration for more frames = smoother animation
const LAYOUT_TRANSITION = { 
  layout: { 
    duration: 0.3, 
    ease: [0.4, 0, 0.2, 1] as const // Material Design standard easing - smoother
  }
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
  
  // Keep high z-index during close animation
  useEffect(() => {
    if (isThisNoteSelected && isModalOpen) {
      setIsAnimating(true)
    } else if (isThisNoteSelected && !isModalOpen && isAnimating) {
      // Modal just closed, keep animating state for animation duration
      const timer = setTimeout(() => setIsAnimating(false), 300)
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
    plainContent.slice(0, 120) + (plainContent.length > 120 ? '...' : ''),
    [plainContent]
  )
  const title = note.title || t('notes.newNote')
  const backgroundStyle = useMemo(() => getNoteBackgroundStyle(note.style), [note.style])
  const hasCustomBg = note.style?.backgroundColor || note.style?.backgroundImage

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <motion.div
            layoutId={`note-card-${note.id}`}
            transition={LAYOUT_TRANSITION}
            style={{ 
              willChange: 'transform',
              contain: 'layout style paint',
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
                {note.isShared && (
                  <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-full">
                    <Users className="w-3 h-3" />
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {note.isPinned && (
                  <Pin className="w-4 h-4 text-neutral-400" />
                )}
                <SyncIcon status={note.syncStatus} isSyncing={isSyncing} />
              </div>
            </div>
            
            {note.sharedBy && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 relative z-10">
                {t('publicNote.from')} {note.sharedBy}
              </p>
            )}
            
            {/* Content preview - always show with min-height for consistent card size */}
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 line-clamp-2 min-h-[2.5rem] relative z-10">
              {preview ? (
                <Highlight text={preview} query={searchQuery} />
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
  
  // Keep high z-index during close animation
  useEffect(() => {
    if (isThisNoteSelected && isModalOpen) {
      setIsAnimating(true)
    } else if (isThisNoteSelected && !isModalOpen && isAnimating) {
      // Modal just closed, keep animating state for animation duration
      const timer = setTimeout(() => setIsAnimating(false), 300)
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
    plainContent.slice(0, 120) + (plainContent.length > 120 ? '...' : ''),
    [plainContent]
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
              layoutId={`note-card-${note.id}`}
              onClick={handleClick}
              transition={LAYOUT_TRANSITION}
              style={{ 
                willChange: 'transform',
                contain: 'layout style paint',
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
                  {note.isShared && (
                    <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-full">
                      <Users className="w-3 h-3" />
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {note.isPinned && (
                    <Pin className="w-4 h-4 text-neutral-400" />
                  )}
                  <SyncIcon status={note.syncStatus} isSyncing={isSyncing} />
                </div>
              </div>
              
              {note.sharedBy && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 relative z-10">
                  {t('publicNote.from')} {note.sharedBy}
                </p>
              )}
              
              {/* Content preview - always show with min-height for consistent card size */}
              <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 line-clamp-2 min-h-[2.5rem] relative z-10">
                {preview ? (
                  <Highlight text={preview} query={searchQuery} />
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
