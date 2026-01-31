import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { 
  FileText, 
  Loader2, 
  X,
  WifiOff
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useNotesStore } from '@/stores/notesStore'
import { useAppStore } from '@/stores/appStore'
import { 
  searchDocuments, 
  type DriveSearchResult 
} from '@/lib/driveSearch'

interface DriveSearchResultsProps {
  query: string
  onClose?: () => void
}

// Extract note ID from filename like "note-abc123.json"
function extractNoteId(filename: string): string | null {
  const match = filename.match(/^note-(.+)\.json$/)
  return match ? match[1] : null
}

// Check if file is a system file (should be hidden from results)
function isSystemFile(filename: string): boolean {
  const systemFiles = ['notes-index.json', 'notes-data.json']
  return systemFiles.includes(filename)
}

export function DriveSearchResults({ query, onClose }: DriveSearchResultsProps) {
  const { t } = useTranslation()
  const user = useAuthStore(state => state.user)
  const notes = useNotesStore(state => state.notes)
  const setSelectedNote = useNotesStore(state => state.setSelectedNote)
  const setModalOpen = useNotesStore(state => state.setModalOpen)
  const isOnline = useAppStore(state => state.isOnline)
  
  const [results, setResults] = useState<DriveSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const performSearch = useCallback(async () => {
    if (!query.trim() || !user?.accessToken) {
      setResults([])
      return
    }

    // Don't search if offline
    if (!isOnline) {
      setError(t('offline.networkRequired'))
      setResults([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const searchResults = await searchDocuments(user.accessToken, query, 20)
      
      // Get note IDs that are in trash
      const trashedNoteIds = new Set(notes.filter(n => n.isDeleted).map(n => n.id))
      
      // Filter: exclude system files, exclude trashed notes, deduplicate
      const seenNoteIds = new Set<string>()
      const filteredResults = searchResults.filter(r => {
        if (isSystemFile(r.name)) return false
        
        const noteId = extractNoteId(r.name)
        if (!noteId) return false
        
        // Exclude notes that are in trash
        if (trashedNoteIds.has(noteId)) return false
        
        // Deduplicate by note ID
        if (seenNoteIds.has(noteId)) return false
        seenNoteIds.add(noteId)
        
        return true
      })
      setResults(filteredResults)
    } catch (err) {
      console.error('Drive search error:', err)
      setError(t('driveSearch.error'))
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [query, user?.accessToken, isOnline, t, notes])

  useEffect(() => {
    const debounceTimer = setTimeout(performSearch, 300)
    return () => clearTimeout(debounceTimer)
  }, [performSearch])

  // Get note info from local store
  const getNoteInfo = (result: DriveSearchResult) => {
    const noteId = extractNoteId(result.name)
    if (!noteId) return null
    
    const note = notes.find(n => n.id === noteId)
    return note ? { note, noteId } : { noteId, note: null }
  }

  // Handle click on a result
  const handleResultClick = (result: DriveSearchResult) => {
    const info = getNoteInfo(result)
    
    if (info?.note) {
      // Open note in app
      setSelectedNote(info.noteId)
      setModalOpen(true)
      onClose?.()
    }
  }

  if (!query.trim()) {
    return null
  }

  // Filter to only show note files (hide any non-note files that might slip through)
  const noteResults = results.filter(r => extractNoteId(r.name) !== null)
  const displayCount = noteResults.length

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-lg overflow-hidden max-w-[calc(100vw-2rem)] sm:max-w-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 bg-neutral-50 dark:bg-neutral-800/50">
        <div className="flex items-center gap-2">
          <img src="/drive-color-svgrepo-com.svg" alt="Drive" className="w-4 h-4" />
          <span className="text-xs sm:text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t('driveSearch.title')}
          </span>
          {!isLoading && displayCount > 0 && (
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              ({displayCount})
            </span>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            <X className="w-4 h-4 text-neutral-500" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="max-h-[250px] sm:max-h-[300px] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-6 sm:py-8">
            <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-neutral-400" />
            <span className="ml-2 text-xs sm:text-sm text-neutral-500">{t('driveSearch.searching')}</span>
          </div>
        ) : error ? (
          <div className="py-4 sm:py-6 px-3 sm:px-4 text-center">
            {!isOnline ? (
              <>
                <WifiOff className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-amber-500" />
                <p className="text-xs sm:text-sm text-amber-600 dark:text-amber-400">{t('offline.networkRequired')}</p>
                <p className="text-[10px] sm:text-xs text-neutral-400 mt-1">{t('offline.featureRequiresNetwork', { feature: t('driveSearch.title') })}</p>
              </>
            ) : (
              <p className="text-xs sm:text-sm text-red-500">{error}</p>
            )}
          </div>
        ) : displayCount === 0 ? (
          <div className="py-4 sm:py-6 px-3 sm:px-4 text-center">
            <img src="/drive-color-svgrepo-com.svg" alt="Drive" className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs sm:text-sm text-neutral-500">{t('driveSearch.noResults')}</p>
            <p className="text-[10px] sm:text-xs text-neutral-400 mt-1">{t('driveSearch.noResultsHint')}</p>
          </div>
        ) : (
          <div>
            {noteResults.map((result) => {
              const info = getNoteInfo(result)
              const noteTitle = info?.note?.title
              
              return (
                <div
                  key={result.id}
                  onClick={() => handleResultClick(result)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleResultClick(result)}
                  className="w-full flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors group text-left cursor-pointer"
                >
                  {/* File icon */}
                  <div className="flex-shrink-0">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-500 dark:text-neutral-400" />
                  </div>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium truncate text-neutral-900 dark:text-white">
                      {noteTitle || t('publicNote.untitled')}
                    </p>
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5">
                      <span className="text-[10px] sm:text-xs text-neutral-500 dark:text-neutral-400">
                        {t('app.name')}
                      </span>
                      {result.modifiedTime && (
                        <>
                          <span className="text-neutral-300 dark:text-neutral-600">•</span>
                          <span className="text-[10px] sm:text-xs text-neutral-400">
                            {new Date(result.modifiedTime).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer hint */}
      {displayCount > 0 && (
        <div className="px-3 sm:px-4 py-1.5 sm:py-2 bg-neutral-50/50 dark:bg-neutral-800/30">
          <p className="text-[10px] sm:text-xs text-neutral-400 text-center">
            {t('driveSearch.hint')}
          </p>
        </div>
      )}
    </div>
  )
}
