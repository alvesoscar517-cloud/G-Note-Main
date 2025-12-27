/**
 * Offline indicator component
 * Shows network status and pending sync items
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { WifiOff, Cloud, CloudOff, RefreshCw, X, CheckCircle } from 'lucide-react'
import { useNetworkStore } from '@/stores/networkStore'
import { useNotesStore } from '@/stores/notesStore'
import { getSyncQueueCount } from '@/lib/offlineDb'
import { processSyncQueue } from '@/lib/offlineSync'
import { cn } from '@/lib/utils'

interface OfflineIndicatorProps {
  className?: string
  showDetails?: boolean
}

export function OfflineIndicator({ className, showDetails = false }: OfflineIndicatorProps) {
  const { t } = useTranslation()
  const isOnline = useNetworkStore(state => state.isOnline)
  const notes = useNotesStore(state => state.notes)
  const [queueCount, setQueueCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState<'offline' | 'online' | 'success'>('offline')

  // Count pending notes from store
  const pendingNotesCount = notes.filter(n => n.syncStatus === 'pending').length

  // Update queue count periodically
  useEffect(() => {
    const updateCount = async () => {
      const count = await getSyncQueueCount()
      setQueueCount(count)
    }

    updateCount()
    const interval = setInterval(updateCount, 5000)
    return () => clearInterval(interval)
  }, [])

  // Total pending = queue items + pending notes (when offline)
  const totalPending = isOnline ? queueCount : Math.max(queueCount, pendingNotesCount)

  // Show toast when going offline/online
  useEffect(() => {
    if (!isOnline) {
      setToastMessage(t('offline.nowOffline'))
      setToastType('offline')
      setShowToast(true)
    } else if (totalPending > 0) {
      setToastMessage(t('offline.backOnline'))
      setToastType('online')
      setShowToast(true)
      // Auto-hide after 3 seconds
      const timer = setTimeout(() => setShowToast(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [isOnline, t])

  const handleManualSync = useCallback(async () => {
    if (!isOnline || isSyncing) return
    
    setIsSyncing(true)
    try {
      const result = await processSyncQueue()
      if (result.success > 0) {
        setToastMessage(t('offline.syncSuccess', { count: result.success }))
        setToastType('success')
        setShowToast(true)
        setTimeout(() => setShowToast(false), 3000)
      }
    } finally {
      setIsSyncing(false)
      const count = await getSyncQueueCount()
      setQueueCount(count)
    }
  }, [isOnline, isSyncing, t])

  // Don't show anything if online and no pending items
  if (isOnline && totalPending === 0 && !showDetails) {
    return null
  }

  return (
    <>
      {/* Compact indicator */}
      <div className={cn('flex items-center gap-1.5', className)}>
        {!isOnline ? (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
            <WifiOff className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">{t('offline.offline')}</span>
            {totalPending > 0 && (
              <span className="text-xs opacity-75">({totalPending})</span>
            )}
          </div>
        ) : totalPending > 0 ? (
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            {isSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Cloud className="w-3.5 h-3.5" />
            )}
            <span className="text-xs font-medium hidden sm:inline">
              {isSyncing ? t('offline.syncing') : t('offline.pending', { count: totalPending })}
            </span>
            <span className="text-xs font-medium sm:hidden">
              {totalPending}
            </span>
          </button>
        ) : null}
      </div>

      {/* Toast notification */}
      {showToast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className={cn(
            'flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border',
            toastType === 'offline' 
              ? 'bg-amber-50 dark:bg-amber-900/90 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
              : toastType === 'success'
              ? 'bg-green-50 dark:bg-green-900/90 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
              : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200'
          )}>
            {toastType === 'offline' ? (
              <CloudOff className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            ) : toastType === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            ) : (
              <Cloud className="w-5 h-5 text-green-600 dark:text-green-400" />
            )}
            <span className="text-sm font-medium">{toastMessage}</span>
            <button
              onClick={() => setShowToast(false)}
              className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * Offline banner - shows at top of screen when offline
 */
export function OfflineBanner() {
  const { t } = useTranslation()
  const isOnline = useNetworkStore(state => state.isOnline)
  const [dismissed, setDismissed] = useState(false)

  // Reset dismissed state when going back online then offline again
  useEffect(() => {
    if (isOnline) {
      setDismissed(false)
    }
  }, [isOnline])

  if (isOnline || dismissed) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 dark:bg-amber-600 text-white px-4 py-2 safe-top">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <WifiOff className="w-4 h-4" />
          <span className="text-sm font-medium">{t('offline.offlineBanner')}</span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded-full hover:bg-white/20 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

/**
 * Network required overlay - shows when trying to use network-only features offline
 */
interface NetworkRequiredOverlayProps {
  open: boolean
  onClose: () => void
  feature?: string
}

export function NetworkRequiredOverlay({ open, onClose, feature }: NetworkRequiredOverlayProps) {
  const { t } = useTranslation()

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl p-6 animate-in fade-in-0 zoom-in-95">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
            <WifiOff className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
            {t('offline.networkRequired')}
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
            {feature 
              ? t('offline.featureRequiresNetwork', { feature })
              : t('offline.networkRequiredDescription')
            }
          </p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium hover:opacity-90 transition-opacity"
          >
            {t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Hook to show network required overlay
 */
export function useNetworkRequiredOverlay() {
  const [isOpen, setIsOpen] = useState(false)
  const [feature, setFeature] = useState<string | undefined>()
  const isOnline = useNetworkStore(state => state.isOnline)

  const showOverlay = (featureName?: string) => {
    if (!isOnline) {
      setFeature(featureName)
      setIsOpen(true)
      return true // Indicates offline
    }
    return false // Indicates online
  }

  const hideOverlay = () => {
    setIsOpen(false)
    setFeature(undefined)
  }

  return {
    isOpen,
    feature,
    showOverlay,
    hideOverlay,
    isOnline,
    OverlayComponent: () => (
      <NetworkRequiredOverlay open={isOpen} onClose={hideOverlay} feature={feature} />
    )
  }
}
