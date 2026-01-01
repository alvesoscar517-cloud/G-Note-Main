import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, RotateCcw, X, CheckSquare, Square, AlertTriangle, Search, Loader2 } from 'lucide-react'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Dialog, DialogHeader, DialogContent, DialogFooter } from '@/components/ui/Dialog'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/Tooltip'
import { useNotesStore } from '@/stores/notesStore'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { cn, getPlainText, formatDate } from '@/lib/utils'
import { NoteBackground, getNoteBackgroundStyle } from './NoteStylePicker'
import { Highlight } from '@/components/ui/Highlight'
import { searchDocuments, type DriveSearchResult } from '@/lib/driveSearch'
import { useEdgeSwipeBack, EdgeSwipeIndicator } from '@/hooks/useEdgeSwipeBack'
import type { Note } from '@/types'

// Virtualization constants
const CARD_HEIGHT = 140
const GAP = 16
const OVERSCAN = 5

/**
 * Generate smart preview that shows context around search match
 */
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

interface TrashViewProps {
  open: boolean
  onClose: () => void
}

export function TrashView({ open, onClose }: TrashViewProps) {
  const { t } = useTranslation()
  const listRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const notes = useNotesStore(state => state.notes)
  const restoreFromTrash = useNotesStore(state => state.restoreFromTrash)
  const permanentlyDelete = useNotesStore(state => state.permanentlyDelete)
  const emptyTrash = useNotesStore(state => state.emptyTrash)
  const restoreMultiple = useNotesStore(state => state.restoreMultiple)
  const permanentlyDeleteMultiple = useNotesStore(state => state.permanentlyDeleteMultiple)
  const user = useAuthStore(state => state.user)
  const theme = useThemeStore(state => state.theme)
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [driveSearchEnabled, setDriveSearchEnabled] = useState(false)
  const [driveResults, setDriveResults] = useState<DriveSearchResult[]>([])
  const [isDriveSearching, setIsDriveSearching] = useState(false)
  const [columnCount, setColumnCount] = useState(3)
  
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  
  // Detect column count based on container width
  useEffect(() => {
    const updateColumnCount = () => {
      if (!listRef.current) return
      const width = listRef.current.offsetWidth
      if (width < 640) setColumnCount(1)
      else if (width < 1024) setColumnCount(2)
      else setColumnCount(3)
    }
    
    if (open) {
      setTimeout(updateColumnCount, 50)
      const observer = new ResizeObserver(updateColumnCount)
      if (listRef.current) observer.observe(listRef.current)
      return () => observer.disconnect()
    }
  }, [open])
  
  // Edge swipe back gesture
  const { 
    handlers: edgeSwipeHandlers, 
    swipeStyle: edgeSwipeStyle,
    swipeState: edgeSwipeState,
    progress: edgeSwipeProgress 
  } = useEdgeSwipeBack({
    onSwipeBack: onClose,
    edgeWidth: 25,
    threshold: 100,
    enabled: open
  })
  
  const trashNotes = useMemo(() => {
    return notes
      .filter(n => n.isDeleted)
      .sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0))
  }, [notes])

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return trashNotes
    const query = searchQuery.toLowerCase()
    return trashNotes.filter(note => {
      const title = note.title.toLowerCase()
      const content = getPlainText(note.content).toLowerCase()
      return title.includes(query) || content.includes(query)
    })
  }, [trashNotes, searchQuery])

  // Group notes into rows for virtualization
  const rows = useMemo(() => {
    const result: Note[][] = []
    for (let i = 0; i < filteredNotes.length; i += columnCount) {
      result.push(filteredNotes.slice(i, i + columnCount))
    }
    return result
  }, [filteredNotes, columnCount])

  // Virtualizer for trash notes
  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => CARD_HEIGHT + GAP,
    overscan: OVERSCAN,
    scrollMargin: listRef.current?.offsetTop ?? 0,
  })

  // Drive search for trash - only show notes that are in trash
  const performDriveSearch = useCallback(async () => {
    if (!searchQuery.trim() || !user?.accessToken || !driveSearchEnabled) {
      setDriveResults([])
      return
    }

    setIsDriveSearching(true)
    try {
      const results = await searchDocuments(user.accessToken, searchQuery, 20)
      // Filter to only show notes that are in trash and deduplicate by note ID
      const trashNoteIds = new Set(trashNotes.map(n => n.id))
      const seenNoteIds = new Set<string>()
      const filteredResults = results.filter(r => {
        const match = r.name.match(/^note-(.+)\.json$/)
        if (match && trashNoteIds.has(match[1])) {
          // Deduplicate - only keep first occurrence of each note ID
          if (seenNoteIds.has(match[1])) {
            return false
          }
          seenNoteIds.add(match[1])
          return true
        }
        return false
      })
      setDriveResults(filteredResults)
    } catch (err) {
      console.error('Drive search error:', err)
      setDriveResults([])
    } finally {
      setIsDriveSearching(false)
    }
  }, [searchQuery, user?.accessToken, driveSearchEnabled, trashNotes])

  useEffect(() => {
    if (driveSearchEnabled) {
      const timer = setTimeout(performDriveSearch, 300)
      return () => clearTimeout(timer)
    }
  }, [performDriveSearch, driveSearchEnabled])

  // Get note from drive result
  const getNoteFromDriveResult = (result: DriveSearchResult): Note | undefined => {
    const match = result.name.match(/^note-(.+)\.json$/)
    if (match) {
      return trashNotes.find(n => n.id === match[1])
    }
    return undefined
  }

  // Get notes from drive results for virtualization
  const driveNotesFiltered = useMemo(() => {
    return driveResults
      .map(getNoteFromDriveResult)
      .filter((n): n is Note => n !== undefined)
  }, [driveResults, trashNotes])

  // Rows for drive search results
  const driveRows = useMemo(() => {
    const result: Note[][] = []
    for (let i = 0; i < driveNotesFiltered.length; i += columnCount) {
      result.push(driveNotesFiltered.slice(i, i + columnCount))
    }
    return result
  }, [driveNotesFiltered, columnCount])

  // Virtualizer for drive results
  const driveVirtualizer = useWindowVirtualizer({
    count: driveRows.length,
    estimateSize: () => CARD_HEIGHT + GAP,
    overscan: OVERSCAN,
    scrollMargin: listRef.current?.offsetTop ?? 0,
  })

  const isAllSelected = filteredNotes.length > 0 && selectedIds.size === filteredNotes.length
  const hasSelection = selectedIds.size > 0

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (isAllSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(filteredNotes.map(n => n.id)))
  }

  const handleRestoreSelected = () => {
    restoreMultiple(Array.from(selectedIds))
    setSelectedIds(new Set())
  }

  const handleDeleteSelected = () => {
    permanentlyDeleteMultiple(Array.from(selectedIds))
    setSelectedIds(new Set())
    setShowDeleteConfirm(false)
  }

  const handleEmptyTrash = () => {
    emptyTrash()
    setSelectedIds(new Set())
    setShowEmptyConfirm(false)
  }

  const handleClose = () => {
    setSelectedIds(new Set())
    setSearchQuery('')
    setDriveSearchEnabled(false)
    setDriveResults([])
    onClose()
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop to cover home page content */}
      <div className="fixed inset-0 z-[89] bg-neutral-50 dark:bg-neutral-950" />
      
      <div 
        ref={scrollContainerRef}
        className="fixed inset-0 z-[90] overflow-y-auto bg-neutral-50 dark:bg-neutral-950"
        style={edgeSwipeState.isDragging ? edgeSwipeStyle : undefined}
        {...edgeSwipeHandlers}
      >
        {/* Edge swipe indicator */}
        <EdgeSwipeIndicator 
          progress={edgeSwipeProgress} 
          isActive={edgeSwipeState.isDragging && edgeSwipeState.startedFromEdge} 
        />
        
        {/* Header */}
        <div className="px-3 sm:px-4 pt-3">
          <div className="max-w-6xl mx-auto bg-white/80 dark:bg-neutral-900/80 backdrop-blur-lg border border-neutral-200 dark:border-neutral-800 rounded-[16px] px-3 sm:px-4 py-2.5 sm:py-3">
            <div className="flex items-center justify-between gap-2 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <Button variant="ghost" size="icon" onClick={handleClose} className="rounded-full flex-shrink-0">
                  <X className="w-5 h-5" />
                </Button>
                <div className="flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-neutral-500 hidden sm:block" />
                  <h1 className="text-base sm:text-lg font-semibold">{t('trash.title')}</h1>
                  {trashNotes.length > 0 && (
                    <span className="text-sm text-neutral-500">({trashNotes.length})</span>
                  )}
                </div>
              </div>
              
              {trashNotes.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowEmptyConfirm(true)}
                  className="flex-shrink-0 text-xs sm:text-sm"
                >
                  {t('trash.emptyTrash')}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Selection toolbar / Search bar */}
        {trashNotes.length > 0 && (
          <div className="px-3 sm:px-4 pt-2 sm:pt-3">
            <div className="max-w-6xl mx-auto flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-lg">
              {hasSelection ? (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="gap-1.5 flex-shrink-0 px-2 sm:px-3">
                    <X className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('common.cancel')}</span>
                  </Button>
                  <span className="text-sm text-neutral-500 flex-shrink-0">
                    {selectedIds.size} {t('trash.selectedCount')}
                  </span>
                  <div className="flex-1" />
                  <Button variant="ghost" size="sm" onClick={handleRestoreSelected} className="gap-1.5 px-2 sm:px-3">
                    <RotateCcw className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('trash.restore')}</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(true)} className="gap-1.5 px-2 sm:px-3 text-neutral-700 dark:text-neutral-300">
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('trash.delete')}</span>
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="sm" onClick={toggleSelectAll} className="gap-1.5 flex-shrink-0 px-2 sm:px-3">
                    <Square className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('trash.selectAll')}</span>
                  </Button>
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={driveSearchEnabled ? t('driveSearch.toggle') : t('trash.searchPlaceholder')}
                      className="pl-9 pr-9 h-8 text-sm"
                    />
                    {/* Drive Search Toggle */}
                    <button
                      onClick={() => setDriveSearchEnabled(!driveSearchEnabled)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-md transition-colors"
                      title={t('driveSearch.toggleHint')}
                    >
                      {driveSearchEnabled ? (
                        <img src="/drive-color-svgrepo-com.svg" alt="Drive" className="w-4 h-4" />
                      ) : (
                        <img 
                          src="/drive-google-svgrepo-com.svg" 
                          alt="Drive" 
                          className="w-4 h-4 opacity-50"
                          style={{ filter: isDark ? 'invert(1)' : 'none' }}
                        />
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div 
          ref={listRef}
          className="px-3 sm:px-4 py-3 sm:py-4"
        >
          <div className="max-w-6xl mx-auto">
            {trashNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[60vh] text-neutral-500">
                <Trash2 className="w-12 sm:w-16 h-12 sm:h-16 mb-4 opacity-20" />
                <p className="text-base sm:text-lg font-medium">{t('trash.empty')}</p>
                <p className="text-sm text-center px-4">{t('trash.emptyDescription')}</p>
              </div>
            ) : driveSearchEnabled && searchQuery.trim() ? (
              // Drive search results with virtualization
              isDriveSearching ? (
                <div className="flex flex-col items-center justify-center h-[60vh] text-neutral-500">
                  <Loader2 className="w-8 h-8 animate-spin mb-4" />
                  <p className="text-sm">{t('driveSearch.searching')}</p>
                </div>
              ) : driveNotesFiltered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[60vh] text-neutral-500">
                  <img src="/drive-color-svgrepo-com.svg" alt="Drive" className="w-12 h-12 mb-4 opacity-50" />
                  <p className="text-base sm:text-lg font-medium">{t('driveSearch.noResults')}</p>
                  <p className="text-sm text-center px-4">{t('driveSearch.noResultsHint')}</p>
                </div>
              ) : (
                <div
                  style={{
                    height: `${driveVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {driveVirtualizer.getVirtualItems().map(virtualRow => {
                    const row = driveRows[virtualRow.index]
                    return (
                      <div
                        key={virtualRow.key}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start - driveVirtualizer.options.scrollMargin}px)`,
                        }}
                      >
                        <div 
                          className="grid gap-4"
                          style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
                        >
                          {row.map(note => (
                            <TrashNoteCard
                              key={note.id}
                              note={note}
                              isSelected={selectedIds.has(note.id)}
                              hasSelection={hasSelection}
                              onToggleSelect={() => toggleSelect(note.id)}
                              onRestore={() => restoreFromTrash(note.id)}
                              onDelete={() => permanentlyDelete(note.id)}
                              searchQuery={searchQuery}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            ) : filteredNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[60vh] text-neutral-500">
                <Search className="w-12 sm:w-16 h-12 sm:h-16 mb-4 opacity-20" />
                <p className="text-base sm:text-lg font-medium">{t('trash.noResults')}</p>
                <p className="text-sm text-center px-4">{t('trash.noResultsDescription')}</p>
              </div>
            ) : (
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
                      <div 
                        className="grid gap-4"
                        style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
                      >
                        {row.map(note => (
                          <TrashNoteCard
                            key={note.id}
                            note={note}
                            isSelected={selectedIds.has(note.id)}
                            hasSelection={hasSelection}
                            onToggleSelect={() => toggleSelect(note.id)}
                            onRestore={() => restoreFromTrash(note.id)}
                            onDelete={() => permanentlyDelete(note.id)}
                            searchQuery={searchQuery}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Empty trash confirmation */}
      <Dialog open={showEmptyConfirm} onClose={() => setShowEmptyConfirm(false)}>
        <DialogHeader>{t('trash.emptyTrashConfirmTitle')}</DialogHeader>
        <DialogContent>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p>{t('trash.emptyTrashConfirm', { count: trashNotes.length })}</p>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setShowEmptyConfirm(false)}>{t('common.cancel')}</Button>
          <Button variant="destructive" onClick={handleEmptyTrash}>{t('trash.emptyTrash')}</Button>
        </DialogFooter>
      </Dialog>

      {/* Delete selected confirmation */}
      <Dialog open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)}>
        <DialogHeader>{t('trash.deleteConfirmTitle')}</DialogHeader>
        <DialogContent>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p>{t('trash.deleteConfirm', { count: selectedIds.size })}</p>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>{t('common.cancel')}</Button>
          <Button variant="destructive" onClick={handleDeleteSelected}>{t('trash.deletePermanently')}</Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}

interface TrashNoteCardProps {
  note: Note
  isSelected: boolean
  hasSelection: boolean
  onToggleSelect: () => void
  onRestore: () => void
  onDelete: () => void
  searchQuery?: string
}

function TrashNoteCard({ note, isSelected, hasSelection, onToggleSelect, onRestore, onDelete, searchQuery }: TrashNoteCardProps) {
  const { t } = useTranslation()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  const plainContent = getPlainText(note.content)
  const preview = getSmartPreview(plainContent, searchQuery)
  const title = note.title || t('notes.newNote')
  
  const deletedTimeAgo = useMemo(() => {
    if (!note.deletedAt) return ''
    return formatDate(note.deletedAt)
  }, [note.deletedAt])

  const backgroundStyle = getNoteBackgroundStyle(note.style)
  const hasCustomBg = note.style?.backgroundColor || note.style?.backgroundImage

  return (
    <>
      <div
        style={backgroundStyle}
        className={cn(
          'relative group rounded-[16px] border p-4 cursor-pointer transition-shadow overflow-hidden',
          note.style?.backgroundImage ? 'bg-white dark:bg-neutral-900' : (!hasCustomBg && 'bg-white dark:bg-neutral-900'),
          isSelected 
            ? 'border-neutral-900 dark:border-white ring-2 ring-neutral-900/20 dark:ring-white/20' 
            : 'border-neutral-200 dark:border-neutral-800 hover:shadow-md hover:border-neutral-300 dark:hover:border-neutral-700'
        )}
        onClick={onToggleSelect}
      >
        <NoteBackground style={note.style} />

        {/* Header - same layout as NoteCard */}
        <div className="flex items-start justify-between gap-2 relative z-10">
          <h3 className="font-semibold text-neutral-900 dark:text-white line-clamp-1 min-w-0 flex-1">
            <Highlight text={title} query={searchQuery} />
          </h3>
          
          {/* Right side: checkbox or action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Checkbox - show on hover or when in selection mode */}
            <div className={cn(
              'transition-opacity duration-200',
              hasSelection || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            )}>
              {isSelected ? (
                <CheckSquare className="w-5 h-5 text-neutral-900 dark:text-white" />
              ) : (
                <Square className="w-5 h-5 text-neutral-400" />
              )}
            </div>
          </div>
        </div>

        {/* Preview content - fixed 2 line height for consistent card size */}
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 line-clamp-2 min-h-[2.5rem] relative z-10">
          {preview ? (
            <Highlight text={preview} query={searchQuery} />
          ) : (
            <span className="text-neutral-300 dark:text-neutral-600">&nbsp;</span>
          )}
        </p>

        {/* Deleted time */}
        <p className="mt-3 text-xs text-neutral-400 dark:text-neutral-500 relative z-10">
          {t('trash.deleted')} {deletedTimeAgo}
        </p>

        {/* Action buttons - show on hover when not in selection mode */}
        {!hasSelection && (
          <div className={cn(
            'absolute bottom-3 right-3 flex items-center gap-1 transition-opacity z-10',
            'opacity-0 group-hover:opacity-100'
          )}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={(e) => { e.stopPropagation(); onRestore() }}
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('trash.restore')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true) }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('trash.deletePermanently')}</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>

      <Dialog open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)}>
        <DialogHeader>{t('trash.deleteConfirmTitle')}</DialogHeader>
        <DialogContent>{t('trash.deleteOneConfirm')}</DialogContent>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>{t('common.cancel')}</Button>
          <Button variant="destructive" onClick={() => { onDelete(); setShowDeleteConfirm(false) }}>{t('trash.deletePermanently')}</Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}
