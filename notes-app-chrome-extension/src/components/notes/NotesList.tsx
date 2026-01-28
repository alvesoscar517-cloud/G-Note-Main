import { EmptyState } from './EmptyState'
import { NotesListSkeleton } from '@/components/ui/Skeleton'
import { NoteCard } from './NoteCard'
import { useNotesStore } from '@/stores/notesStore'

export function NotesList() {
  const { 
    notes,
    getSearchResults, 
    searchQuery
  } = useNotesStore()
  
  // Get sync states
  const isSyncing = useNotesStore(state => state.isSyncing)
  const isInitialSync = useNotesStore(state => state.isInitialSync)
  const isNewUser = useNotesStore(state => state.isNewUser)
  const isCheckingDriveData = useNotesStore(state => state.isCheckingDriveData)
  const driveHasData = useNotesStore(state => state.driveHasData)

  const searchResults = getSearchResults()
  const allNotes = searchResults.map(r => r.note)
  const currentQuery = searchResults[0]?.query || ''

  // Show skeleton when:
  // 1. Initial sync is in progress and no local notes yet (but NOT for new users)
  // 2. Checking Drive data and Drive has data (or unknown)
  // 3. Syncing and Drive confirmed to have data
  // Skip skeleton for new users - show welcome animation instead
  const activeNotes = notes.filter(n => !n.isDeleted)
  const showSkeleton = activeNotes.length === 0 && !isNewUser && (
    (isInitialSync && isSyncing) ||
    isCheckingDriveData ||
    (driveHasData === true && isSyncing)
  )
  
  if (showSkeleton) {
    return <NotesListSkeleton />
  }

  // Empty state: distinguish between no notes vs no search results
  if (allNotes.length === 0) {
    // Check if user has any non-deleted notes
    if (activeNotes.length === 0) {
      return <EmptyState type="no-notes" />
    }
    return <EmptyState type="no-results" searchQuery={searchQuery} />
  }

  // Simple flat list of all notes
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {allNotes.map((note) => (
        <NoteCard key={note.id} note={note} searchQuery={currentQuery} />
      ))}
    </div>
  )
}