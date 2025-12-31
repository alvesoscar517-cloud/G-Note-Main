import { useTranslation } from 'react-i18next'
import { LogOut, Cloud, CloudOff, RefreshCw } from 'lucide-react'
import { useNotesStore } from '@/stores/notesStore'
import { useNetworkStore } from '@/stores/networkStore'
import { cn, formatDate } from '@/lib/utils'

interface LogoutConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
}

export function LogoutConfirmDialog({ open, onClose, onConfirm }: LogoutConfirmDialogProps) {
  const { t } = useTranslation()
  const notes = useNotesStore(state => state.notes)
  const collections = useNotesStore(state => state.collections)
  const lastSyncTime = useNotesStore(state => state.lastSyncTime)
  const isSyncing = useNotesStore(state => state.isSyncing)
  const isOnline = useNetworkStore(state => state.isOnline)
  
  // Calculate sync status
  const pendingNotes = notes.filter(n => n.syncStatus === 'pending' && !n.isDeleted)
  const pendingCollections = collections.filter(c => c.syncStatus === 'pending')
  const totalPending = pendingNotes.length + pendingCollections.length
  const hasUnsyncedData = totalPending > 0
  const hasAnyData = notes.filter(n => !n.isDeleted).length > 0
  
  // Determine warning level
  const isHighRisk = !isOnline && hasUnsyncedData
  const isMediumRisk = hasUnsyncedData && isOnline
  
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl p-6 animate-in fade-in-0 zoom-in-95 border border-neutral-200 dark:border-neutral-700">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
            <LogOut className="w-6 h-6 text-neutral-600 dark:text-neutral-400" />
          </div>
        </div>
        
        {/* Title */}
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2 text-center">
          {t('settings.logoutConfirmTitle')}
        </h3>
        
        {/* Sync status indicator */}
        <div className="mb-4 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center gap-2 mb-1">
            {isSyncing ? (
              <RefreshCw className="w-4 h-4 text-neutral-500 dark:text-neutral-400 animate-spin" />
            ) : isOnline ? (
              <Cloud className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
            ) : (
              <CloudOff className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
            )}
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {isSyncing 
                ? t('settings.syncingInProgress')
                : isOnline 
                ? t('offline.online') 
                : t('offline.offline')
              }
            </span>
          </div>
          
          {isSyncing ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {t('settings.waitForSync')}
            </p>
          ) : hasUnsyncedData ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {t('settings.unsyncedWarning', { count: totalPending })}
            </p>
          ) : hasAnyData ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {t('settings.allSynced')}
              {lastSyncTime && (
                <span className="text-neutral-500 dark:text-neutral-500 ml-1">
                  ({t('settings.lastSync', { time: formatRelativeTime(lastSyncTime) })})
                </span>
              )}
            </p>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {t('settings.noDataToSync')}
            </p>
          )}
        </div>
        
        {/* Warning message */}
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6 text-center">
          {isSyncing
            ? t('settings.logoutWarningSyncing')
            : isHighRisk 
            ? t('settings.logoutWarningOffline')
            : isMediumRisk
            ? t('settings.logoutWarningUnsynced')
            : t('settings.logoutWarningNormal')
          }
        </p>
        
        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={isSyncing}
            className={cn(
              "flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors border border-neutral-200 dark:border-neutral-700",
              isSyncing
                ? "text-neutral-400 dark:text-neutral-500 cursor-not-allowed"
                : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            )}
          >
            {t('settings.logout')}
          </button>
        </div>
      </div>
    </div>
  )
}

// Helper function to format relative time - uses date-fns via formatDate
function formatRelativeTime(timestamp: number): string {
  return formatDate(timestamp)
}
