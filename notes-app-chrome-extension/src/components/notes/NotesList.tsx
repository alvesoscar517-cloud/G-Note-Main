import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, MoreHorizontal, Pencil, Trash2, Plus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import * as Popover from '@radix-ui/react-popover'
import { EmptyState } from './EmptyState'
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
import type { Note, Collection } from '@/types'
import { cn } from '@/lib/utils'
import { getPlainText, formatDate } from '@/lib/utils'

export function NotesList() {
  const { t } = useTranslation()
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
    searchQuery
  } = useNotesStore()
  
  const [activeNote, setActiveNote] = useState<Note | null>(null)
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const searchResults = getSearchResults()
  const allNotes = searchResults.map(r => r.note)
  const currentQuery = searchResults[0]?.query || ''
  
  const uncollectedNotes = allNotes.filter(n => !n.collectionId)
  const isSearching = searchQuery.trim().length > 0

  const handleDragStart = (event: DragStartEvent) => {
    const note = allNotes.find(n => n.id === event.active.id)
    if (note) setActiveNote(note)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveNote(null)

    const sourceNoteId = active.id as string
    const sourceNote = allNotes.find(n => n.id === sourceNoteId)

    // If dropped outside any target, remove from collection
    if (!over) {
      if (sourceNote?.collectionId) {
        removeNoteFromCollection(sourceNoteId)
      }
      return
    }

    const targetId = over.id as string

    // If dropped on collection-drop-zone (outside collection), remove from collection
    if (targetId.startsWith('collection-drop-') || targetId.startsWith('outside-collection-')) {
      if (sourceNote?.collectionId) {
        removeNoteFromCollection(sourceNoteId)
      }
      return
    }

    if (active.id === over.id) return

    // Dropping on another note
    const targetNote = allNotes.find(n => n.id === targetId)
    if (targetNote) {
      // Don't merge if both are in the same collection
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

  // Empty state: distinguish between no notes vs no search results
  if (allNotes.length === 0) {
    if (notes.length === 0) {
      return <EmptyState type="no-notes" />
    }
    return <EmptyState type="no-results" searchQuery={searchQuery} />
  }

  // When searching, show flat list without drag
  if (isSearching) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {allNotes.map((note) => (
          <NoteCard key={note.id} note={note} searchQuery={currentQuery} />
        ))}
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Single grid for all items */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {/* Collapsed collections as stacked cards */}
          {collections.map((collection) => {
            const collectionNotes = getNotesInCollection(collection.id)
            if (collectionNotes.length === 0) return null
            
            const isDraggingFromThis = activeNote?.collectionId === collection.id

            // If expanded, render header + notes separately
            if (collection.isExpanded) {
              return (
                <ExpandedCollection
                  key={collection.id}
                  collection={collection}
                  notes={collectionNotes}
                  isEditing={editingCollectionId === collection.id}
                  editingName={editingName}
                  isDraggingFromThis={isDraggingFromThis}
                  onToggleExpand={() => toggleCollectionExpanded(collection.id)}
                  onStartEdit={() => handleStartEditCollection(collection)}
                  onSaveName={handleSaveCollectionName}
                  onChangeName={setEditingName}
                  onDelete={() => deleteCollection(collection.id)}
                  onAddNote={() => addNote(collection.id)}
                  t={t}
                />
              )
            }

            // Collapsed - render as single stacked card
            return (
              <CollapsedCollection
                key={collection.id}
                collection={collection}
                notes={collectionNotes}
                isEditing={editingCollectionId === collection.id}
                editingName={editingName}
                isDraggingFromThis={isDraggingFromThis}
                onToggleExpand={() => toggleCollectionExpanded(collection.id)}
              onStartEdit={() => handleStartEditCollection(collection)}
              onSaveName={handleSaveCollectionName}
              onChangeName={setEditingName}
              onDelete={() => deleteCollection(collection.id)}
              onAddNote={() => addNote(collection.id)}
              t={t}
            />
          )
        })}
        </AnimatePresence>

        {/* Uncollected notes */}
        {uncollectedNotes.map((note) => (
          <DraggableNoteCard key={note.id} note={note} />
        ))}
      </div>

      {/* Global drop zone - appears when dragging from collection */}
      {activeNote?.collectionId && (
        <OutsideDropZone collectionId={activeNote.collectionId} />
      )}

      <DragOverlay>
        {activeNote ? (
          <div className="opacity-90 rotate-2 scale-105 shadow-2xl">
            <NoteCard note={activeNote} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

// Invisible drop zone that covers the whole page when dragging from collection
function OutsideDropZone({ collectionId }: { collectionId: string }) {
  const { setNodeRef } = useDroppable({
    id: `outside-collection-${collectionId}`,
  })

  return (
    <div 
      ref={setNodeRef}
      className="fixed inset-0 z-[-1]"
    />
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

// Collapsed collection - stacked cards style, fits in grid
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

  const handleDeleteClick = () => {
    setShowDeleteDialog(true)
  }

  const handleConfirmDelete = () => {
    onDelete()
    setShowDeleteDialog(false)
  }

  return (
    <>
      <ConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleConfirmDelete}
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
            {/* Stacked cards container */}
            <div 
              onClick={onToggleExpand}
              className="relative cursor-pointer"
            >
              {/* Layer 3 (bottom) - smaller, offset more */}
              <div className="absolute top-2 left-1 right-0 bottom-0 translate-x-1 translate-y-1 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700" />
              
              {/* Layer 2 (middle) - slightly smaller */}
              <div className="absolute top-1 left-0.5 right-0 bottom-0 translate-x-0.5 translate-y-0.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700" />
              
              {/* Top card - smaller padding to fit within same total size as NoteCard */}
              <div className="relative px-3 py-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm hover:shadow-md transition-shadow">
                {/* Title row with collection badge */}
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

                {/* Collection name as subtitle */}
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {collection.name}
                </p>
                
                {/* Preview */}
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
          <ContextMenuItem onClick={handleDeleteClick}>
            <Trash2 className="w-4 h-4 mr-2" />
            {t('contextMenu.delete')}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </>
  )
}

// Expanded collection - takes full width, shows all notes
function ExpandedCollection({
  collection,
  notes,
  isEditing,
  editingName,
  isDraggingFromThis,
  onToggleExpand,
  onStartEdit,
  onSaveName,
  onChangeName,
  onDelete,
  onAddNote,
  t
}: CollectionProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const handleDeleteClick = () => {
    setShowDeleteDialog(true)
  }

  const handleConfirmDelete = () => {
    onDelete()
    setShowDeleteDialog(false)
  }

  return (
    <>
      <ConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleConfirmDelete}
        title={t('notes.delete')}
        description={t('notes.deleteConfirm')}
        confirmText={t('notes.delete')}
        cancelText={t('notes.cancel')}
      />
      <motion.div 
        layout="position"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className={cn(
          "col-span-full rounded-xl",
          isDraggingFromThis && "border border-dashed border-neutral-400 dark:border-neutral-500 p-3"
        )}
      >
        <div className="space-y-3">
          {/* Collection Header */}
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
                      if (e.key === 'Enter') onSaveName()
                      if (e.key === 'Escape') onSaveName()
                    }}
                    className="flex-1 px-2 py-1 text-sm font-medium bg-transparent border border-neutral-300 dark:border-neutral-600 rounded-lg outline-none"
                    autoFocus
                  />
                ) : (
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 cursor-default">
                    {collection.name}
                  </span>
                )}

                <span className="text-xs text-neutral-400">
                  {notes.length}
                </span>

                {/* More button with dropdown menu */}
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
                        onClick={() => onAddNote()}
                      >
                        <Plus className="w-4 h-4" />
                        {t('notes.addNote')}
                      </button>
                      <button
                        className="relative flex w-full cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        onClick={() => onStartEdit()}
                      >
                        <Pencil className="w-4 h-4" />
                        {t('contextMenu.rename')}
                      </button>
                      <button
                        className="relative flex w-full cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        onClick={() => handleDeleteClick()}
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
              <ContextMenuItem onClick={handleDeleteClick}>
                <Trash2 className="w-4 h-4 mr-2" />
                {t('contextMenu.delete')}
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>

          {/* Collection Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pl-6">
            {notes.map((note) => (
              <DraggableNoteCard key={note.id} note={note} />
            ))}
          </div>
        </div>
      </motion.div>
    </>
  )
}
