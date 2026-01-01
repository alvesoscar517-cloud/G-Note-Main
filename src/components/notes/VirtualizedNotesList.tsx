import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, MoreHorizontal, Pencil, Trash2, Plus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import * as Popover from '@radix-ui/react-popover'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { EmptyState } from './EmptyState'
import { NotesListSkeleton } from '@/components/ui/Skeleton'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { NoteCard, DraggableNoteCard } from './NoteCard'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/ContextMenu'
import { ConfirmDialog } from '@/components/ui/Dialog'

import { useNotesStore } from '@/stores/notesStore'
import { useIsTouchDevice } from '@/hooks/useIsTouchDevice'
import type { Note, Collection } from '@/types'
import { cn } from '@/lib/utils'
import { getPlainText, formatDate } from '@/lib/utils'

// Constants for virtualization
const CARD_HEIGHT = 140 // Approximate height of a NoteCard
const GAP = 16 // Gap between cards (gap-4 = 16px)
const OVERSCAN = 5 // Number of items to render outside visible area

// Grid item types for virtualization
type GridItem = 
  | { type: 'note'; note: Note; collectionId?: string; isInExpandedCollection?: boolean }
  | { type: 'collection-collapsed'; collection: Collection; notes: Note[] }
  | { type: 'collection-header'; collection: Collection; notes: Note[] }

export function VirtualizedNotesList() {
  const { t } = useTranslation()
  const isTouchDevice = useIsTouchDevice()
  const listRef = useRef<HTMLDivElement>(null)
  const { 
    notes,
    getSearchResults, 
    collections, 
    getNotesInCollection,
    toggleCollectionExpanded,
    mergeNotesIntoCollection,
    removeNoteFromCollection,
    updateCollection,
    deleteCollection,
    addNote,
    searchQuery,
    isModalOpen
  } = useNotesStore()
  
  // Get sync states
  const isSyncing = useNotesStore(state => state.isSyncing)
  const isInitialSync = useNotesStore(state => state.isInitialSync)
  const isNewUser = useNotesStore(state => state.isNewUser)
  const isCheckingDriveData = useNotesStore(state => state.isCheckingDriveData)
  const driveHasData = useNotesStore(state => state.driveHasData)
  
  const [activeNote, setActiveNote] = useState<Note | null>(null)
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [columnCount, setColumnCount] = useState(3)
  
  // Store scroll position for restoration
  const scrollPositionRef = useRef(0)
  const wasModalOpenRef = useRef(false)

  // Detect column count based on container width
  useEffect(() => {
    const updateColumnCount = () => {
      if (!listRef.current) return
      const width = listRef.current.offsetWidth
      if (width < 640) setColumnCount(1) // sm breakpoint
      else if (width < 1024) setColumnCount(2) // lg breakpoint
      else setColumnCount(3)
    }
    
    updateColumnCount()
    const observer = new ResizeObserver(updateColumnCount)
    if (listRef.current) observer.observe(listRef.current)
    return () => observer.disconnect()
  }, [])

  // Restore scroll position when modal closes
  useEffect(() => {
    if (wasModalOpenRef.current && !isModalOpen) {
      window.scrollTo(0, scrollPositionRef.current)
    }
    wasModalOpenRef.current = isModalOpen
  }, [isModalOpen])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const searchResults = getSearchResults()
  const allNotes = searchResults.map(r => r.note)
  const currentQuery = searchResults[0]?.query || ''
  const uncollectedNotes = allNotes.filter(n => !n.collectionId)
  const isSearching = searchQuery.trim().length > 0

  // Build flat list of grid items for virtualization
  const gridItems = useMemo((): GridItem[] => {
    if (isSearching) {
      return allNotes.map(note => ({ type: 'note' as const, note }))
    }

    const items: GridItem[] = []
    
    // Add collections
    collections.forEach(collection => {
      const collectionNotes = getNotesInCollection(collection.id)
      if (collectionNotes.length === 0) return
      
      if (collection.isExpanded) {
        // Add header (takes full row)
        items.push({ type: 'collection-header', collection, notes: collectionNotes })
        // Add notes in collection (marked as in expanded collection for indent)
        collectionNotes.forEach(note => {
          items.push({ type: 'note', note, collectionId: collection.id, isInExpandedCollection: true })
        })
      } else {
        // Collapsed collection as single item
        items.push({ type: 'collection-collapsed', collection, notes: collectionNotes })
      }
    })
    
    // Add uncollected notes
    uncollectedNotes.forEach(note => {
      items.push({ type: 'note', note })
    })
    
    return items
  }, [allNotes, collections, getNotesInCollection, uncollectedNotes, isSearching])

  // Group items into rows for grid layout
  const rows = useMemo(() => {
    const result: GridItem[][] = []
    let currentRow: GridItem[] = []
    
    gridItems.forEach(item => {
      // Collection headers and expanded collections take full row
      if (item.type === 'collection-header') {
        if (currentRow.length > 0) {
          result.push(currentRow)
          currentRow = []
        }
        result.push([item])
        return
      }
      
      currentRow.push(item)
      if (currentRow.length === columnCount) {
        result.push(currentRow)
        currentRow = []
      }
    })
    
    if (currentRow.length > 0) {
      result.push(currentRow)
    }
    
    return result
  }, [gridItems, columnCount])

  // Calculate row heights
  const getRowHeight = useCallback((index: number) => {
    const row = rows[index]
    if (!row || row.length === 0) return CARD_HEIGHT + GAP
    
    // Collection header row
    if (row[0].type === 'collection-header') {
      return 48 + GAP // Header height
    }
    
    return CARD_HEIGHT + GAP
  }, [rows])

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: getRowHeight,
    overscan: OVERSCAN,
    scrollMargin: listRef.current?.offsetTop ?? 0,
  })

  const handleDragStart = (event: DragStartEvent) => {
    const note = allNotes.find(n => n.id === event.active.id)
    if (note) setActiveNote(note)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveNote(null)

    const sourceNoteId = active.id as string
    const sourceNote = allNotes.find(n => n.id === sourceNoteId)

    if (!over) {
      if (sourceNote?.collectionId) {
        removeNoteFromCollection(sourceNoteId)
      }
      return
    }

    const targetId = over.id as string

    if (targetId.startsWith('collection-drop-') || targetId.startsWith('outside-collection-')) {
      if (sourceNote?.collectionId) {
        removeNoteFromCollection(sourceNoteId)
      }
      return
    }

    if (active.id === over.id) return

    const targetNote = allNotes.find(n => n.id === targetId)
    if (targetNote) {
      if (sourceNote?.collectionId && sourceNote.collectionId === targetNote.collectionId) {
        return
      }
      mergeNotesIntoCollection(sourceNoteId, targetId)
    }
  }

  const handleStartEditCollection = (collection: Collection) => {
    setEditingCollectionId(collection.id)
    setEditingName(collection.name)
  }

  const handleSaveCollectionName = () => {
    if (editingCollectionId && editingName.trim()) {
      updateCollection(editingCollectionId, { name: editingName.trim() })
    }
    setEditingCollectionId(null)
    setEditingName('')
  }

  const handleScroll = () => {
    if (!isModalOpen) {
      scrollPositionRef.current = window.scrollY
    }
  }

  // Add scroll listener for window
  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isModalOpen])

  // Show skeleton
  const activeNotes = notes.filter(n => !n.isDeleted)
  const showSkeleton = activeNotes.length === 0 && !isNewUser && (
    (isInitialSync && isSyncing) ||
    isCheckingDriveData ||
    (driveHasData === true && isSyncing)
  )
  
  if (showSkeleton) {
    return <NotesListSkeleton />
  }

  if (allNotes.length === 0) {
    if (activeNotes.length === 0) {
      return <EmptyState type="no-notes" />
    }
    return <EmptyState type="no-results" searchQuery={searchQuery} />
  }

  // Search mode - simple virtualized grid without drag
  if (isSearching) {
    return (
      <div 
        ref={listRef} 
        className="relative"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map(virtualRow => {
            const row = rows[virtualRow.index]
            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
                }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 py-1 px-1">
                  {row.map(item => {
                    if (item.type === 'note') {
                      return <NoteCard key={item.note.id} note={item.note} searchQuery={currentQuery} />
                    }
                    return null
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Touch device - no drag
  if (isTouchDevice) {
    return (
      <div 
        ref={listRef} 
        className="relative"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map(virtualRow => {
            const row = rows[virtualRow.index]
            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
                }}
              >
                <VirtualRow
                  row={row}
                  columnCount={columnCount}
                  editingCollectionId={editingCollectionId}
                  editingName={editingName}
                  activeNote={activeNote}
                  onToggleExpand={toggleCollectionExpanded}
                  onStartEdit={handleStartEditCollection}
                  onSaveName={handleSaveCollectionName}
                  onChangeName={setEditingName}
                  onDelete={deleteCollection}
                  onAddNote={addNote}
                  t={t}
                  disableDrag={true}
                />
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Desktop with drag & drop
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div 
        ref={listRef} 
        className="relative"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map(virtualRow => {
            const row = rows[virtualRow.index]
            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
                }}
              >
                <VirtualRow
                  row={row}
                  columnCount={columnCount}
                  editingCollectionId={editingCollectionId}
                  editingName={editingName}
                  activeNote={activeNote}
                  onToggleExpand={toggleCollectionExpanded}
                  onStartEdit={handleStartEditCollection}
                  onSaveName={handleSaveCollectionName}
                  onChangeName={setEditingName}
                  onDelete={deleteCollection}
                  onAddNote={addNote}
                  t={t}
                  disableDrag={false}
                />
              </div>
            )
          })}
        </div>
      </div>

      {activeNote?.collectionId && (
        <OutsideDropZone collectionId={activeNote.collectionId} />
      )}

      <DragOverlay dropAnimation={null}>
        {activeNote ? <NoteCard note={activeNote} /> : null}
      </DragOverlay>
    </DndContext>
  )
}


// Virtual row renderer
interface VirtualRowProps {
  row: GridItem[]
  columnCount: number
  editingCollectionId: string | null
  editingName: string
  activeNote: Note | null
  onToggleExpand: (id: string) => void
  onStartEdit: (collection: Collection) => void
  onSaveName: () => void
  onChangeName: (name: string) => void
  onDelete: (id: string) => void
  onAddNote: (collectionId?: string) => void
  t: (key: string) => string
  disableDrag: boolean
}

function VirtualRow({
  row,
  columnCount,
  editingCollectionId,
  editingName,
  activeNote,
  onToggleExpand,
  onStartEdit,
  onSaveName,
  onChangeName,
  onDelete,
  onAddNote,
  t,
  disableDrag
}: VirtualRowProps) {
  // Collection header row
  if (row.length === 1 && row[0].type === 'collection-header') {
    const { collection, notes } = row[0]
    return (
      <CollectionHeader
        collection={collection}
        notes={notes}
        isEditing={editingCollectionId === collection.id}
        editingName={editingName}
        onToggleExpand={() => onToggleExpand(collection.id)}
        onStartEdit={() => onStartEdit(collection)}
        onSaveName={onSaveName}
        onChangeName={onChangeName}
        onDelete={() => onDelete(collection.id)}
        onAddNote={() => onAddNote(collection.id)}
        t={t}
      />
    )
  }

  // Regular grid row
  // Check if this row contains notes from expanded collection (need indent)
  const isExpandedCollectionRow = row.some(item => item.type === 'note' && item.isInExpandedCollection)
  
  return (
    <div 
      className={cn("grid gap-4 py-1 px-1", isExpandedCollectionRow && "pl-6")}
      style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
    >
      <AnimatePresence mode="popLayout">
        {row.map(item => {
          if (item.type === 'collection-collapsed') {
            const isDraggingFromThis = activeNote?.collectionId === item.collection.id
            return (
              <CollapsedCollection
                key={item.collection.id}
                collection={item.collection}
                notes={item.notes}
                isEditing={editingCollectionId === item.collection.id}
                editingName={editingName}
                isDraggingFromThis={isDraggingFromThis}
                onToggleExpand={() => onToggleExpand(item.collection.id)}
                onStartEdit={() => onStartEdit(item.collection)}
                onSaveName={onSaveName}
                onChangeName={onChangeName}
                onDelete={() => onDelete(item.collection.id)}
                onAddNote={() => onAddNote(item.collection.id)}
                t={t}
              />
            )
          }
          
          if (item.type === 'note') {
            return disableDrag ? (
              <NoteCard key={item.note.id} note={item.note} />
            ) : (
              <DraggableNoteCard key={item.note.id} note={item.note} />
            )
          }
          
          return null
        })}
      </AnimatePresence>
    </div>
  )
}

// Invisible drop zone
function OutsideDropZone({ collectionId }: { collectionId: string }) {
  const { setNodeRef } = useDroppable({
    id: `outside-collection-${collectionId}`,
  })

  return <div ref={setNodeRef} className="fixed inset-0 z-[-1]" />
}

// Collection header for expanded collections
interface CollectionHeaderProps {
  collection: Collection
  notes: Note[]
  isEditing: boolean
  editingName: string
  onToggleExpand: () => void
  onStartEdit: () => void
  onSaveName: () => void
  onChangeName: (name: string) => void
  onDelete: () => void
  onAddNote: () => void
  t: (key: string) => string
}

function CollectionHeader({
  collection,
  notes,
  isEditing,
  editingName,
  onToggleExpand,
  onStartEdit,
  onSaveName,
  onChangeName,
  onDelete,
  onAddNote,
  t
}: CollectionHeaderProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  return (
    <>
      <ConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={() => { onDelete(); setShowDeleteDialog(false) }}
        title={t('notes.delete')}
        description={t('notes.deleteConfirm')}
        confirmText={t('notes.delete')}
        cancelText={t('notes.cancel')}
      />
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleExpand}
              className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: collection.color }}
              />
            </button>

            {isEditing ? (
              <input
                type="text"
                value={editingName}
                onChange={(e) => onChangeName(e.target.value)}
                onBlur={onSaveName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') onSaveName()
                }}
                className="flex-1 px-2 py-1 text-sm font-medium bg-transparent border border-neutral-300 dark:border-neutral-600 rounded-lg outline-none"
                autoFocus
              />
            ) : (
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 cursor-default">
                {collection.name}
              </span>
            )}

            <span className="text-xs text-neutral-400">{notes.length}</span>

            <Popover.Root>
              <Popover.Trigger asChild>
                <button
                  className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 ml-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="w-4 h-4 text-neutral-400" />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="z-50 min-w-[8rem] overflow-hidden rounded-xl border p-1 shadow-lg border-neutral-200 bg-white text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 animate-in fade-in-0 zoom-in-95"
                  sideOffset={5}
                  align="end"
                >
                  <button
                    className="relative flex w-full cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    onClick={onAddNote}
                  >
                    <Plus className="w-4 h-4" />
                    {t('notes.addNote')}
                  </button>
                  <button
                    className="relative flex w-full cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    onClick={onStartEdit}
                  >
                    <Pencil className="w-4 h-4" />
                    {t('contextMenu.rename')}
                  </button>
                  <button
                    className="relative flex w-full cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="w-4 h-4" />
                    {t('contextMenu.delete')}
                  </button>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={onAddNote}>
            <Plus className="w-4 h-4 mr-2" />
            {t('notes.addNote')}
          </ContextMenuItem>
          <ContextMenuItem onClick={onStartEdit}>
            <Pencil className="w-4 h-4 mr-2" />
            {t('contextMenu.rename')}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="w-4 h-4 mr-2" />
            {t('contextMenu.delete')}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </>
  )
}

interface CollectionProps {
  collection: Collection
  notes: Note[]
  isEditing: boolean
  editingName: string
  isDraggingFromThis: boolean
  onToggleExpand: () => void
  onStartEdit: () => void
  onSaveName: () => void
  onChangeName: (name: string) => void
  onDelete: () => void
  onAddNote: () => void
  t: (key: string) => string
}

// Collapsed collection - stacked cards style
function CollapsedCollection({
  collection,
  notes,
  isDraggingFromThis,
  onToggleExpand,
  onStartEdit,
  onDelete,
  onAddNote,
  t,
}: CollectionProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const topNote = notes[0]
  const plainContent = topNote ? getPlainText(topNote.content) : ''
  const preview = plainContent.slice(0, 80) + (plainContent.length > 80 ? '...' : '')

  return (
    <>
      <ConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={() => { onDelete(); setShowDeleteDialog(false) }}
        title={t('notes.delete')}
        description={t('notes.deleteConfirm')}
        confirmText={t('notes.delete')}
        cancelText={t('notes.cancel')}
      />
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <motion.div 
            layout="position"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "relative",
              isDraggingFromThis && "ring-1 ring-dashed ring-neutral-400 dark:ring-neutral-500 rounded-2xl"
            )}
          >
            <div onClick={onToggleExpand} className="relative cursor-pointer">
              <div className="absolute top-2 left-1 right-0 bottom-0 translate-x-1 translate-y-1 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700" />
              <div className="absolute top-1 left-0.5 right-0 bottom-0 translate-x-0.5 translate-y-0.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700" />
              <div className="relative px-3 py-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div 
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: collection.color }}
                    />
                    <h3 className="font-semibold text-neutral-900 dark:text-white line-clamp-1">
                      {topNote?.title || t('notes.newNote')}
                    </h3>
                  </div>
                  <span className="text-xs text-neutral-400 shrink-0">{notes.length}</span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {collection.name}
                </p>
                {preview && (
                  <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400 line-clamp-2">
                    {preview}
                  </p>
                )}
                <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
                  {topNote && formatDate(topNote.updatedAt)}
                </p>
              </div>
            </div>
          </motion.div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={onAddNote}>
            <Plus className="w-4 h-4 mr-2" />
            {t('notes.addNote')}
          </ContextMenuItem>
          <ContextMenuItem onClick={onStartEdit}>
            <Pencil className="w-4 h-4 mr-2" />
            {t('contextMenu.rename')}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="w-4 h-4 mr-2" />
            {t('contextMenu.delete')}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </>
  )
}

// Re-export for backward compatibility
export { VirtualizedNotesList as NotesList }
