import { useState, useEffect, useMemo, useRef, memo } from 'react'
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

// Optimized spring config - fast and smooth without bounce
const LAYOUT_SPRING = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30,
  mass: 0.8,
}

// Exit animation for deleted notes - quick fade + scale
const EXIT_ANIMATION = {
  opacity: 0,
  scale: 0.8,
  transition: { duration: 0.15, ease: 'easeOut' as const }
}

// Enter animation for new notes
const ENTER_ANIMATION = {
  opacity: 0,
  scale: 0.9,
}

// Hook to detect resize and temporarily disable layoutId
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

function getSmartPreview(plainContent: string, searchQuery?: string): string {
  const maxLength = 120
  
  if (!searchQuery?.trim()) {
    return plainContent.slice(0, maxLength) + (plainContent.length > maxLength ? '...' : '')
  }
  
  const query = searchQuery.toLowerCase()
  const contentLower = plainContent.toLowerCase()
  const matchIndex = contentLower.indexOf(query)
  
  if (matchIndex === -1 || matchIndex < maxLength - 20) {
    return plainContent.slice(0, maxLength) + (plainContent.length > maxLength ? '...' : '')
  }
  
  const contextBefore = 40
  const contextAfter = 80
  
  const start = Math.max(0, matchIndex - contextBefore)
  const end = Math.min(plainContent.length, matchIndex + query.length + contextAfter)
  
  let snippet = plainContent.slice(start, end)
  
  if (start > 0) {
    const firstSpace = snippet.indexOf(' ')
    if (firstSpace > 0 && firstSpace < 15) {
      snippet = snippet.slice(firstSpace + 1)
    }
    snippet = '...' + snippet
  }
  
  if (end < plainContent.length) {
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

export const NoteCard = memo(function NoteCard({ note, searchQuery }: NoteCardProps) {
  const { t } = useTranslation()
  const { setSelectedNote, setModalOpen, isSyncing, togglePin, deleteNote, duplicateNote } = useNotesStore()
  
  const isModalOpen = useNotesStore(state => state.isModalOpen)
  const selectedNoteId = useNotesStore(state => state.selectedNoteId)
  const isThisNoteSelected = selectedNoteId === note.id
  const [isAnimating, setIsAnimating] = useState(false)
  const isResizing = useResizeGuard()
  
  useEffect(() => {
    if (isThisNoteSelected && isModalOpen) {
      setIsAnimating(true)
    } else if (!isModalOpen && isAnimating) {
      const timer = setTimeout(() => setIsAnimating(false), 400)
      return () => clearTimeout(timer)
    }
  }, [isModalOpen, isThisNoteSelected, isAnimating])

  const handleClick = () => {
    setSelectedNote(note.id)
    setModalOpen(true)
  }

  const plainContent = useMemo(() => getPlainText(note.content), [note.content])
  const preview = useMemo(() => getSmartPreview(plainContent, searchQuery), [plainContent, searchQuery])
  const title = note.title || t('notes.newNote')
  const backgroundStyle = useMemo(() => getNoteBackgroundStyle(note.style), [note.style])
  const hasCustomBg = note.style?.backgroundColor || note.style?.backgroundImage
  const layoutId = (isResizing || isModalOpen) ? undefined : `note-card-${note.id}`

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <motion.div
          layout
          layoutId={layoutId}
          initial={ENTER_ANIMATION}
          animate={{ opacity: 1, scale: 1 }}
          exit={EXIT_ANIMATION}
          transition={{ layout: LAYOUT_SPRING, opacity: { duration: 0.15 } }}
          style={{ 
            ...backgroundStyle,
            zIndex: isAnimating ? 40 : 'auto',
            position: isAnimating ? 'relative' : undefined
          }}
          onClick={handleClick}
          className={cn(
            "cursor-pointer rounded-[16px] border border-neutral-200 p-4 transition-shadow hover:shadow-md hover:border-neutral-300 dark:border-neutral-700 dark:hover:border-neutral-600 relative overflow-hidden",
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
              {note.isPinned && <Pin className="w-4 h-4 text-neutral-400" />}
              {note.isShared && <Users className="w-4 h-4 text-neutral-400" />}
              <SyncIcon status={note.syncStatus} isSyncing={isSyncing} />
            </div>
          </div>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 line-clamp-2 min-h-[2.5rem] relative z-10">
            {preview ? (searchQuery ? <Highlight text={preview} query={searchQuery} /> : preview) : <span className="text-neutral-300 dark:text-neutral-600">&nbsp;</span>}
          </p>
          <p className="mt-3 text-xs text-neutral-400 dark:text-neutral-500 relative z-10">
            {formatDate(note.updatedAt)}
          </p>
        </motion.div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => togglePin(note.id)}>
          {note.isPinned ? <PinOff className="w-4 h-4 mr-2" /> : <Pin className="w-4 h-4 mr-2" />}
          {note.isPinned ? t('contextMenu.unpin') : t('contextMenu.pin')}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => duplicateNote(note.id)}>
          <Copy className="w-4 h-4 mr-2" />
          {t('contextMenu.duplicate')}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => deleteNote(note.id)}>
          <Trash2 className="w-4 h-4 mr-2" />
          {t('trash.moveToTrash')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
})


// Draggable version of NoteCard
export const DraggableNoteCard = memo(function DraggableNoteCard({ note, searchQuery }: NoteCardProps) {
  const { t } = useTranslation()
  const { setSelectedNote, setModalOpen, isSyncing, isModalOpen, selectedNoteId, togglePin, deleteNote, duplicateNote } = useNotesStore()
  
  const isThisNoteSelected = selectedNoteId === note.id
  const [isAnimating, setIsAnimating] = useState(false)
  const isResizing = useResizeGuard()
  
  useEffect(() => {
    if (isThisNoteSelected && isModalOpen) {
      setIsAnimating(true)
    } else if (isThisNoteSelected && !isModalOpen && isAnimating) {
      const timer = setTimeout(() => setIsAnimating(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isModalOpen, isThisNoteSelected, isAnimating])
  
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: note.id })
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: note.id })

  const handleClick = () => {
    if (!isDragging) {
      setSelectedNote(note.id)
      setModalOpen(true)
    }
  }

  const plainContent = useMemo(() => getPlainText(note.content), [note.content])
  const preview = useMemo(() => getSmartPreview(plainContent, searchQuery), [plainContent, searchQuery])
  const title = note.title || t('notes.newNote')
  const backgroundStyle = useMemo(() => getNoteBackgroundStyle(note.style), [note.style])
  const hasCustomBg = note.style?.backgroundColor || note.style?.backgroundImage

  if (isDragging) {
    return (
      <div ref={(node) => { setDragRef(node); setDropRef(node) }} className="opacity-0" />
    )
  }

  const isThisNoteOpen = isModalOpen && isThisNoteSelected
  const layoutId = (isResizing || isModalOpen) ? undefined : `note-card-${note.id}`

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div ref={(node) => { setDragRef(node); setDropRef(node) }} {...listeners} {...attributes}>
          <motion.div
            layout
            layoutId={layoutId}
            initial={ENTER_ANIMATION}
            animate={{ opacity: isThisNoteOpen ? 0 : 1, scale: 1 }}
            exit={EXIT_ANIMATION}
            onClick={handleClick}
            transition={{ layout: LAYOUT_SPRING, opacity: { duration: 0.15 } }}
            style={{ 
              zIndex: isAnimating ? 40 : 'auto',
              position: isAnimating ? 'relative' : undefined,
              ...backgroundStyle
            }}
            className={cn(
              "cursor-pointer rounded-[16px] border border-neutral-200 p-4 transition-shadow hover:shadow-md hover:border-neutral-300 dark:border-neutral-700 dark:hover:border-neutral-600 touch-none relative overflow-hidden",
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
                {note.isPinned && <Pin className="w-4 h-4 text-neutral-400" />}
                {note.isShared && <Users className="w-4 h-4 text-neutral-400" />}
                <SyncIcon status={note.syncStatus} isSyncing={isSyncing} />
              </div>
            </div>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 line-clamp-2 min-h-[2.5rem] relative z-10">
              {preview ? (searchQuery ? <Highlight text={preview} query={searchQuery} /> : preview) : <span className="text-neutral-300 dark:text-neutral-600">&nbsp;</span>}
            </p>
            <p className="mt-3 text-xs text-neutral-400 dark:text-neutral-500 relative z-10">
              {formatDate(note.updatedAt)}
            </p>
          </motion.div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => togglePin(note.id)}>
          {note.isPinned ? <PinOff className="w-4 h-4 mr-2" /> : <Pin className="w-4 h-4 mr-2" />}
          {note.isPinned ? t('contextMenu.unpin') : t('contextMenu.pin')}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => duplicateNote(note.id)}>
          <Copy className="w-4 h-4 mr-2" />
          {t('contextMenu.duplicate')}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => deleteNote(note.id)}>
          <Trash2 className="w-4 h-4 mr-2" />
          {t('trash.moveToTrash')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
})

function SyncIcon({ status, isSyncing }: { status: Note['syncStatus'], isSyncing: boolean }) {
  if (isSyncing && status === 'pending') {
    return <Loader2 className="w-4 h-4 text-neutral-400 animate-spin" />
  }

  switch (status) {
    case 'synced':
      return <CloudCheck className="w-4 h-4 text-neutral-400" />
    case 'pending':
      return <div className="w-2 h-2 rounded-full bg-amber-400" />
    case 'error':
      return <AlertCircle className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
  }
}
