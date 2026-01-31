/**
 * Free Note View - Local-only note editor
 * Strategy: Use local state only - NO store injection to avoid sync
 * Note is saved to localStorage and only transferred to store when user clicks Save
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { languages } from '@/locales'
import { Save, Lock, ArrowRight } from 'lucide-react'
import { NoteEditor } from './NoteEditor'
import { FreeNoteSEOHead } from '../FreeNoteSEOHead'
import type { Note, NoteStyle } from '@/types'

const FREE_NOTE_STORAGE_KEY = 'g-note-free-note'
const PENDING_NOTE_KEY = 'g-note-pending-from-free'
const FREE_NOTE_ID = 'free-note-temp-id'

interface FreeNoteData {
  title: string
  content: string
  style?: NoteStyle
  updatedAt: number
}

// Locked feature modal
function LockedFeatureModal({ open, onClose, feature }: { open: boolean; onClose: () => void; feature: string }) {
  const { t } = useTranslation()
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 max-w-sm w-full shadow-xl border border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 border border-neutral-200 dark:border-neutral-700 rounded-full">
          <Lock className="w-6 h-6 text-neutral-600 dark:text-neutral-400" />
        </div>
        <h3 className="text-lg font-semibold text-center text-neutral-900 dark:text-white mb-2">
          {t('freeNote.featureLocked')}
        </h3>
        <p className="text-sm text-center text-neutral-500 dark:text-neutral-400 mb-6">
          {t('freeNote.featureLockedDescription', { feature })}
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
            {t('common.cancel')}
          </button>
          <button onClick={() => window.location.href = '/'} className="flex-1 px-4 py-2.5 text-sm font-medium border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center justify-center gap-1.5">
            {t('freeNote.goToAppShort')}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function FreeNoteView() {
  const { t, i18n } = useTranslation()
  const [searchParams] = useSearchParams()
  const [isSaving, setIsSaving] = useState(false)
  const [showLockedModal, setShowLockedModal] = useState(false)
  const [lockedFeature, setLockedFeature] = useState('')
  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  // Use LOCAL state instead of store - this prevents sync to Drive
  const [freeNote, setFreeNote] = useState<Note | null>(null)

  // Handle locked feature click
  const handleLockedFeatureClick = useCallback((featureName: string) => {
    setLockedFeature(featureName)
    setShowLockedModal(true)
  }, [])

  // Handle ?lang= URL parameter
  useEffect(() => {
    const lang = searchParams.get('lang')
    if (lang && languages.some(l => l.code === lang) && lang !== i18n.language) {
      i18n.changeLanguage(lang)
    }
  }, [searchParams, i18n])

  // Initialize free note from localStorage - runs once on mount
  useEffect(() => {
    let noteData: Note
    try {
      const saved = localStorage.getItem(FREE_NOTE_STORAGE_KEY)
      if (saved) {
        const data: FreeNoteData = JSON.parse(saved)
        noteData = {
          id: FREE_NOTE_ID,
          title: data.title || '',
          content: data.content || '',
          style: data.style,
          createdAt: Date.now(),
          updatedAt: data.updatedAt || Date.now(),
          isPinned: false,
          version: 1,
          syncStatus: 'synced' // This doesn't matter since we don't use store
        }
      } else {
        noteData = {
          id: FREE_NOTE_ID,
          title: '',
          content: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isPinned: false,
          version: 1,
          syncStatus: 'synced'
        }
      }
    } catch (e) {
      console.error('Failed to load free note:', e)
      noteData = {
        id: FREE_NOTE_ID,
        title: '',
        content: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isPinned: false,
        version: 1,
        syncStatus: 'synced'
      }
    }

    setFreeNote(noteData)
  }, []) // Only run once on mount

  // Custom update handler for NoteEditor - updates local state instead of store
  const handleNoteUpdate = useCallback((updates: Partial<Note>) => {
    setFreeNote(prev => {
      if (!prev) return null
      return {
        ...prev,
        ...updates,
        updatedAt: Date.now()
      }
    })
  }, [])

  // Auto-save to localStorage when note changes
  useEffect(() => {
    if (!freeNote) return

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)

    saveTimeoutRef.current = setTimeout(() => {
      const data: FreeNoteData = {
        title: freeNote.title,
        content: freeNote.content,
        style: freeNote.style,
        updatedAt: Date.now()
      }
      try {
        localStorage.setItem(FREE_NOTE_STORAGE_KEY, JSON.stringify(data))
      } catch (e) {
        console.error('Failed to save:', e)
      }
    }, 1000)

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [freeNote])

  // Handle save permanently - redirect to main app
  const handleSave = useCallback(() => {
    if (!freeNote) return

    setIsSaving(true)
    const pendingNote = {
      title: freeNote.title || t('freeNote.untitledNote'),
      content: freeNote.content,
      style: freeNote.style,
      source: 'free-note',
      timestamp: Date.now()
    }
    localStorage.setItem(PENDING_NOTE_KEY, JSON.stringify(pendingNote))
    window.location.href = '/?from=free-note'
  }, [freeNote, t])

  // Show loading while initializing
  if (!freeNote) {
    return (
      <div className="h-screen flex flex-col bg-neutral-50 dark:bg-neutral-950 overflow-hidden fixed inset-0 status-bar-bg">
        <FreeNoteSEOHead />

        {/* Header skeleton */}
        <header className="flex-shrink-0 px-3 sm:px-4 pt-3 sm:pt-4 safe-top safe-x z-50">
          <div className="max-w-4xl mx-auto bg-white/80 dark:bg-neutral-900/80 backdrop-blur-lg border border-neutral-200 dark:border-neutral-800 rounded-[12px] sm:rounded-[16px] px-3 sm:px-4 py-2.5 sm:py-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-3">
                <img src="/g-note.svg" alt="G-Note" className="w-7 h-7 sm:w-8 sm:h-8 dark:hidden" />
                <img src="/g-note-dark.svg" alt="G-Note" className="w-7 h-7 sm:w-8 sm:h-8 hidden dark:block" />
                <span className="font-semibold text-neutral-900 dark:text-white text-sm sm:text-base">G-Note</span>
                <span className="hidden sm:inline text-xs px-2 py-0.5 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-full">
                  {t('freeNote.freeMode')}
                </span>
              </div>
              <div className="w-8 h-8 bg-neutral-200 dark:bg-neutral-800 rounded-[8px] animate-pulse" />
            </div>
          </div>
        </header>

        {/* Loading content */}
        <main className="flex-1 overflow-hidden px-3 sm:px-4 pt-3 sm:pt-4 pb-3 sm:pb-4 safe-x safe-bottom">
          <div className="h-full max-w-4xl mx-auto bg-white dark:bg-neutral-900 rounded-[12px] sm:rounded-[16px] border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden flex items-center justify-center">
            <div className="text-neutral-400 dark:text-neutral-600 text-sm">Loading...</div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-neutral-50 dark:bg-neutral-950 overflow-hidden fixed inset-0 status-bar-bg">
      <FreeNoteSEOHead />

      {/* Custom Header with Save Button */}
      <header className="flex-shrink-0 px-3 sm:px-4 pt-3 sm:pt-4 safe-top safe-x z-50">
        <div className="max-w-4xl mx-auto bg-white/80 dark:bg-neutral-900/80 backdrop-blur-lg border border-neutral-200 dark:border-neutral-800 rounded-[12px] sm:rounded-[16px] px-3 sm:px-4 py-2.5 sm:py-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <a href="/" className="flex items-center gap-2 sm:gap-3">
                <img src="/g-note.svg" alt="G-Note" className="w-7 h-7 sm:w-8 sm:h-8 dark:hidden" />
                <img src="/g-note-dark.svg" alt="G-Note" className="w-7 h-7 sm:w-8 sm:h-8 hidden dark:block" />
                <span className="font-semibold text-neutral-900 dark:text-white text-sm sm:text-base">G-Note</span>
              </a>
              <span className="hidden sm:inline text-xs px-2 py-0.5 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-full">
                {t('freeNote.freeMode')}
              </span>
            </div>
            <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 text-xs sm:text-sm border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-[8px] sm:rounded-[10px] font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50">
              <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Editor Container - Same width as header, full height below */}
      <main className="flex-1 overflow-hidden px-3 sm:px-4 pt-3 sm:pt-4 pb-3 sm:pb-4 safe-x safe-bottom">
        <div
          className="h-full max-w-4xl mx-auto rounded-[12px] sm:rounded-[16px] border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden relative"
          style={freeNote?.style?.backgroundColor ? { backgroundColor: freeNote.style.backgroundColor } : {}}
        >
          {/* Background image layer if present */}
          {freeNote?.style?.backgroundImage && (
            <>
              {/* Solid base layer */}
              <div className="absolute inset-0 pointer-events-none bg-white dark:bg-neutral-900 rounded-[12px] sm:rounded-[16px]" />
              {/* Image layer */}
              <div
                className="absolute inset-0 pointer-events-none rounded-[12px] sm:rounded-[16px]"
                style={{ opacity: freeNote.style.backgroundOpacity ?? 1 }}
              >
                <img
                  src={freeNote.style.backgroundImage}
                  alt=""
                  className="w-full h-full object-cover rounded-[12px] sm:rounded-[16px]"
                  style={{
                    filter: freeNote.style.backgroundFilter
                      ? (() => {
                        const filters = [
                          { value: 'clarendon', css: 'contrast(1.2) saturate(1.35)' },
                          { value: 'gingham', css: 'brightness(1.05) hue-rotate(-10deg)' },
                          { value: 'moon', css: 'grayscale(1) contrast(1.1) brightness(1.1)' },
                          { value: 'lark', css: 'contrast(0.9) saturate(1.2) brightness(1.1)' },
                          { value: 'reyes', css: 'sepia(0.22) brightness(1.1) contrast(0.85) saturate(0.75)' },
                          { value: 'juno', css: 'sepia(0.35) contrast(1.15) brightness(1.15) saturate(1.8)' },
                          { value: 'slumber', css: 'saturate(0.66) brightness(1.05) sepia(0.1)' },
                          { value: 'crema', css: 'sepia(0.5) contrast(0.9) brightness(1.1) saturate(0.9)' },
                          { value: 'ludwig', css: 'saturate(0.8) contrast(1.05) brightness(1.05)' },
                          { value: 'aden', css: 'hue-rotate(-20deg) contrast(0.9) saturate(0.85) brightness(1.2)' },
                          { value: 'perpetua', css: 'contrast(1.1) brightness(1.25) saturate(1.1)' },
                        ];
                        return filters.find(f => f.value === freeNote.style?.backgroundFilter)?.css || '';
                      })()
                      : undefined
                  }}
                />
              </div>
            </>
          )}

          {/* Default background if no custom style */}
          {!freeNote?.style?.backgroundColor && !freeNote?.style?.backgroundImage && (
            <div className="absolute inset-0 pointer-events-none bg-white dark:bg-neutral-900 rounded-[12px] sm:rounded-[16px]" />
          )}

          {/* Render NoteEditor directly without modal */}
          {freeNote && (
            <div className="relative z-10 h-full">
              <NoteEditor
                note={freeNote}
                onClose={() => { }} // No-op
                onTogglePin={() => { }} // No-op
                isPinned={false}
                isFullscreen={false}
                canToggleFullscreen={false}
                isFreeMode={true}
                onLockedFeatureClick={handleLockedFeatureClick}
                customUpdateHandler={handleNoteUpdate}
              />
            </div>
          )}
        </div>
      </main>

      {/* Locked Feature Modal */}
      <LockedFeatureModal
        open={showLockedModal}
        onClose={() => setShowLockedModal(false)}
        feature={lockedFeature}
      />
    </div>
  )
}
