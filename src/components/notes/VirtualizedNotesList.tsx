import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { EmptyState } from './EmptyState'
import { NotesListSkeleton } from '@/components/ui/Skeleton'
import { NoteCard } from './NoteCard'
import { useNotesStore } from '@/stores/notesStore'
import type { Note } from '@/types'

// Constants for virtualization
const CARD_HEIGHT = 140 // Approximate height of a NoteCard
const GAP = 16 // Gap between cards (gap-4 = 16px)
const OVERSCAN = 5 // Number of items to render outside visible area

// Grid item types for virtualization
type GridItem = { type: 'note'; note: Note }

export function VirtualizedNotesList() {
  const listRef = useRef<HTMLDivElement>(null)
  const { 
    notes,
    getSearchResults, 
    searchQuery,
    isModalOpen
  } = useNotesStore()
  
  // Get sync states
  const isSyncing = useNotesStore(state => state.isSyncing)
  const isInitialSync = useNotesStore(state => state.isInitialSync)
  const isNewUser = useNotesStore(state => state.isNewUser)
  const isCheckingDriveData = useNotesStore(state => state.isCheckingDriveData)
  const driveHasData = useNotesStore(state => state.driveHasData)
  
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

  const searchResults = getSearchResults()
  const allNotes = searchResults.map(r => r.note)
  const currentQuery = searchResults[0]?.query || ''

  // Build flat list of grid items for virtualization
  const gridItems = useMemo((): GridItem[] => {
    return allNotes.map(note => ({ type: 'note' as const, note }))
  }, [allNotes])

  // Group items into rows for grid layout
  const rows = useMemo(() => {
    const result: GridItem[][] = []
    let currentRow: GridItem[] = []
    
    gridItems.forEach(item => {
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
  const getRowHeight = useCallback(() => {
    return CARD_HEIGHT + GAP
  }, [])

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: getRowHeight,
    overscan: OVERSCAN,
    scrollMargin: listRef.current?.offsetTop ?? 0,
  })

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

  // Simple virtualized grid
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
                <AnimatePresence mode="popLayout">
                  {row.map(item => {
                    if (item.type === 'note') {
                      return <NoteCard key={item.note.id} note={item.note} searchQuery={currentQuery} />
                    }
                    return null
                  })}
                </AnimatePresence>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Re-export for backward compatibility
export { VirtualizedNotesList as NotesList }
