import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Check, Trash2, Mail, User, Clock, Loader2 } from 'lucide-react'
import { useNotesStore } from '@/stores/notesStore'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import type { Locale } from 'date-fns'
import { vi, enUS, zhCN, zhTW, ja, ko, es, fr, de, it, ptBR, nl, pl, tr, ar, hi, th, id } from 'date-fns/locale'

const localeMap: Record<string, Locale> = {
  vi, en: enUS, 'zh-CN': zhCN, 'zh-TW': zhTW, ja, ko, es, fr, de, it, 'pt-BR': ptBR, nl, pl, tr, ar, hi, th, id
}

interface SharedNotesPanelProps {
  open: boolean
  onClose: () => void
}

export function SharedNotesPanel({ open, onClose }: SharedNotesPanelProps) {
  const { t, i18n } = useTranslation()
  const sharedNotes = useNotesStore(state => state.sharedNotes)
  const acceptSharedNote = useNotesStore(state => state.acceptSharedNote)
  const declineSharedNote = useNotesStore(state => state.declineSharedNote)
  
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())

  const handleAccept = async (shareId: string) => {
    setProcessingIds(prev => new Set(prev).add(shareId))
    try {
      await acceptSharedNote(shareId)
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev)
        next.delete(shareId)
        return next
      })
    }
  }

  const handleDecline = async (shareId: string) => {
    setProcessingIds(prev => new Set(prev).add(shareId))
    try {
      await declineSharedNote(shareId)
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev)
        next.delete(shareId)
        return next
      })
    }
  }

  const formatTime = (timestamp: number) => {
    const locale = localeMap[i18n.language] || enUS
    return formatDistanceToNow(timestamp, { addSuffix: true, locale })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 safe-x">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md max-h-[80vh] overflow-hidden bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-700">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-neutral-500" />
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
              {t('sharedNotes.title')}
            </h2>
            {sharedNotes.length > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-full">
                {sharedNotes.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(80vh-60px)]">
          {sharedNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Mail className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mb-3" />
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {t('sharedNotes.empty')}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {sharedNotes.map((note) => {
                const isProcessing = processingIds.has(note.shareId)
                
                return (
                  <div 
                    key={note.shareId}
                    className={cn(
                      "p-4 transition-colors",
                      isProcessing && "opacity-50 pointer-events-none"
                    )}
                  >
                    {/* Note preview */}
                    <div className="mb-3">
                      <h3 className="font-medium text-neutral-900 dark:text-white line-clamp-1">
                        {note.title || t('notes.untitled')}
                      </h3>
                      {note.content && (
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 line-clamp-2 mt-1">
                          {note.content.replace(/<[^>]*>/g, '').slice(0, 100)}
                        </p>
                      )}
                    </div>

                    {/* Sender info */}
                    <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400 mb-3">
                      <div className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        <span>{note.sharedByName || note.sharedBy}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatTime(note.sharedAt)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAccept(note.shareId)}
                        disabled={isProcessing}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-900 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-100 text-white dark:text-neutral-900 text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            {t('sharedNotes.accept')}
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleDecline(note.shareId)}
                        disabled={isProcessing}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        {t('sharedNotes.decline')}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Badge component to show in header
export function SharedNotesBadge({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()
  const sharedNotes = useNotesStore(state => state.sharedNotes)
  
  if (sharedNotes.length === 0) return null

  return (
    <button
      onClick={onClick}
      className="relative p-2 rounded-full text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors touch-manipulation"
      title={t('sharedNotes.title')}
    >
      <Mail className="w-5 h-5" />
      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full">
        {sharedNotes.length > 99 ? '99+' : sharedNotes.length}
      </span>
    </button>
  )
}
