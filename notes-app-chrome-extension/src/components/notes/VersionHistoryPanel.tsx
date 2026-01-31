import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { History, Loader2, FileText, RotateCcw, WifiOff, X } from 'lucide-react'
import { Dialog, DialogHeader } from '@/components/ui/Dialog'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuShortcut,
} from '@/components/ui/ContextMenu'
import { driveVersions, type NoteVersion } from '@/lib/driveVersions'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import { cn } from '@/lib/utils'

interface VersionHistoryPanelProps {
  open: boolean
  onClose: () => void
  driveFileId?: string
  onRestore: (content: string, title: string) => void
}

export function VersionHistoryPanel({
  open,
  onClose,
  driveFileId,
  onRestore
}: VersionHistoryPanelProps) {
  const { t, i18n } = useTranslation()
  const { user } = useAuthStore()
  const isOnline = useAppStore(state => state.isOnline)
  const [versions, setVersions] = useState<NoteVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)

  useEffect(() => {
    if (open && driveFileId && user?.accessToken && isOnline) {
      loadVersions()
    }
  }, [open, driveFileId, user?.accessToken, isOnline])

  const loadVersions = async () => {
    if (!driveFileId || !user?.accessToken) return
    setLoading(true)
    try {
      driveVersions.setAccessToken(user.accessToken)
      const list = await driveVersions.listVersions(driveFileId)
      setVersions(list)
    } catch (err) {
      console.error('Failed to load versions:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = async (version: NoteVersion) => {
    if (!driveFileId || !user?.accessToken) return
    setRestoring(version.id)
    try {
      driveVersions.setAccessToken(user.accessToken)
      const content = await driveVersions.getVersionContent(driveFileId, version.id)
      if (content?.note) {
        onRestore(content.note.content, content.note.title)
        onClose()
      }
    } catch (err) {
      console.error('Failed to restore:', err)
    } finally {
      setRestoring(null)
    }
  }

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString(i18n.language, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Empty state - no Drive sync
  if (!driveFileId) {
    return (
      <Dialog open={open} onClose={onClose}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5" />
              {t('versionHistory.title')}
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </DialogHeader>
        <div className="flex flex-col items-center py-8 text-center px-4 safe-bottom">
          <History className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mb-3" />
          <p className="text-neutral-500">{t('versionHistory.noHistory')}</p>
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5" />
            {t('versionHistory.title')}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </DialogHeader>

      <div className="max-h-[400px] overflow-y-auto px-4 pt-2 pb-4 safe-bottom">
        {/* Offline Warning */}
        {!isOnline && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <WifiOff className="w-4 h-4" />
              <span className="text-sm font-medium">{t('offline.networkRequired')}</span>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
              {t('offline.featureRequiresNetwork', { feature: t('versionHistory.title') })}
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <History className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mb-3" />
            <p className="text-neutral-500">{t('versionHistory.noHistory')}</p>
          </div>
        ) : (
          <div className="space-y-3 pb-2">
            {(() => {
              const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0
              const cmdKey = isMac ? '⌘' : 'Ctrl+'

              return versions.map((version, index) => (
                <ContextMenu key={version.id}>
                  <ContextMenuTrigger asChild>
                    <div
                      className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 cursor-default"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-neutral-400" />
                          <span className="text-sm font-medium text-neutral-900 dark:text-white">
                            {formatDateTime(version.modifiedTime)}
                          </span>
                        </div>
                        {index > 0 && (
                          <button
                            onClick={() => handleRestore(version)}
                            disabled={restoring === version.id}
                            className={cn(
                              "text-sm font-medium text-blue-500 hover:text-blue-600 disabled:opacity-50",
                              restoring === version.id && "cursor-wait"
                            )}
                          >
                            {restoring === version.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              t('versionHistory.restore')
                            )}
                          </button>
                        )}
                      </div>
                      <div className="mt-1 ml-6 text-xs text-neutral-500">
                        {index === 0 && <span>{t('versionHistory.currentVersion')}</span>}
                        {index === 0 && version.modifiedBy && <span> · </span>}
                        {version.modifiedBy && <span>{version.modifiedBy}</span>}
                      </div>
                    </div>
                  </ContextMenuTrigger>
                  {index > 0 && (
                    <ContextMenuContent className="w-48">
                      <ContextMenuItem
                        onClick={() => handleRestore(version)}
                        disabled={restoring === version.id}
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        {t('versionHistory.restore')}
                        <ContextMenuShortcut>{cmdKey}R</ContextMenuShortcut>
                      </ContextMenuItem>
                    </ContextMenuContent>
                  )}
                </ContextMenu>
              ))
            })()}
          </div>
        )}
      </div>
    </Dialog>
  )
}
