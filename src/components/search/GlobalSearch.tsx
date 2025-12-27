import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { 
  Search, 
  HardDrive, 
  FileText, 
  X, 
  Loader2,
  ExternalLink,
  StickyNote
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { useNotesStore } from '@/stores/notesStore'
import { searchDocuments, getMimeTypeLabel, type DriveSearchResult } from '@/lib/driveSearch'
import { searchNotes, type SearchResult } from '@/lib/search'

interface GlobalSearchProps {
  open: boolean
  onClose: () => void
  onSelectNote?: (noteId: string) => void
}

type SearchTab = 'notes' | 'drive'

export function GlobalSearch({ open, onClose, onSelectNote }: GlobalSearchProps) {
  const { t } = useTranslation()
  const user = useAuthStore(state => state.user)
  const notes = useNotesStore(state => state.notes)
  const setSelectedNote = useNotesStore(state => state.setSelectedNote)
  const setModalOpen = useNotesStore(state => state.setModalOpen)
  
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<SearchTab>('notes')
  const [noteResults, setNoteResults] = useState<SearchResult[]>([])
  const [driveResults, setDriveResults] = useState<DriveSearchResult[]>([])
  const [isSearchingDrive, setIsSearchingDrive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  // Search notes locally
  useEffect(() => {
    if (query.trim()) {
      const activeNotes = notes.filter(n => !n.isDeleted)
      const results = searchNotes(activeNotes, query)
      setNoteResults(results)
    } else {
      setNoteResults([])
    }
  }, [query, notes])

  // Search Drive with debounce
  const searchDriveDebounced = useCallback(async () => {
    if (!query.trim() || !user?.accessToken || activeTab !== 'drive') {
      setDriveResults([])
      return
    }

    setIsSearchingDrive(true)
    try {
      const results = await searchDocuments(user.accessToken, query, 10)
      setDriveResults(results)
    } catch (err) {
      console.error('Drive search error:', err)
      setDriveResults([])
    } finally {
      setIsSearchingDrive(false)
    }
  }, [query, user?.accessToken, activeTab])

  useEffect(() => {
    const timer = setTimeout(searchDriveDebounced, 300)
    return () => clearTimeout(timer)
  }, [searchDriveDebounced])

  const handleSelectNote = (noteId: string) => {
    setSelectedNote(noteId)
    setModalOpen(true)
    onSelectNote?.(noteId)
    onClose()
  }

  const handleOpenInDrive = (webViewLink?: string) => {
    if (webViewLink) {
      window.open(webViewLink, '_blank', 'noopener,noreferrer')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      
      {/* Search Modal */}
      <div className="relative w-full max-w-xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden animate-in fade-in-0 zoom-in-95">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
          <Search className="w-5 h-5 text-neutral-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('header.search')}
            className="flex-1 bg-transparent border-0 outline-none text-neutral-900 dark:text-white placeholder:text-neutral-400"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <X className="w-4 h-4 text-neutral-400" />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-700">
          <button
            onClick={() => setActiveTab('notes')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === 'notes'
                ? "text-neutral-900 dark:text-white border-b-2 border-neutral-900 dark:border-white"
                : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            )}
          >
            <StickyNote className="w-4 h-4" />
            {t('app.name')}
            {noteResults.length > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-neutral-200 dark:bg-neutral-700 rounded-full">
                {noteResults.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('drive')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === 'drive'
                ? "text-neutral-900 dark:text-white border-b-2 border-neutral-900 dark:border-white"
                : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            )}
          >
            <HardDrive className="w-4 h-4" />
            {t('driveSearch.title')}
            {driveResults.length > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-neutral-200 dark:bg-neutral-700 rounded-full">
                {driveResults.length}
              </span>
            )}
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {activeTab === 'notes' ? (
            // Notes Results
            query.trim() ? (
              noteResults.length > 0 ? (
                <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {noteResults.map(({ note }) => (
                    <button
                      key={note.id}
                      onClick={() => handleSelectNote(note.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors text-left"
                    >
                      <FileText className="w-5 h-5 text-neutral-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                          {note.title || t('publicNote.untitled')}
                        </p>
                        <p className="text-xs text-neutral-500 truncate">
                          {new Date(note.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-sm text-neutral-500">{t('emptyState.noResults')}</p>
                </div>
              )
            ) : (
              <div className="py-8 text-center">
                <Search className="w-8 h-8 mx-auto text-neutral-300 dark:text-neutral-600 mb-2" />
                <p className="text-sm text-neutral-500">{t('header.search')}</p>
              </div>
            )
          ) : (
            // Drive Results
            isSearchingDrive ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                <span className="ml-2 text-sm text-neutral-500">{t('driveSearch.searching')}</span>
              </div>
            ) : query.trim() ? (
              driveResults.length > 0 ? (
                <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {driveResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleOpenInDrive(result.webViewLink)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors text-left group"
                    >
                      {result.iconLink ? (
                        <img src={result.iconLink} alt="" className="w-5 h-5" />
                      ) : (
                        <FileText className="w-5 h-5 text-neutral-400" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                          {result.name}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {getMimeTypeLabel(result.mimeType)}
                          {result.modifiedTime && ` • ${new Date(result.modifiedTime).toLocaleDateString()}`}
                        </p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <HardDrive className="w-8 h-8 mx-auto text-neutral-300 dark:text-neutral-600 mb-2" />
                  <p className="text-sm text-neutral-500">{t('driveSearch.noResults')}</p>
                  <p className="text-xs text-neutral-400 mt-1">{t('driveSearch.noResultsHint')}</p>
                </div>
              )
            ) : (
              <div className="py-8 text-center">
                <HardDrive className="w-8 h-8 mx-auto text-neutral-300 dark:text-neutral-600 mb-2" />
                <p className="text-sm text-neutral-500">{t('driveSearch.hint')}</p>
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
          <p className="text-xs text-neutral-400 text-center">
            {activeTab === 'drive' ? t('driveSearch.hint') : t('emptyState.tryDifferent')}
          </p>
        </div>
      </div>
    </div>
  )
}
