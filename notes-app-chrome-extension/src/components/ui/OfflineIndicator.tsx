/**
 * Offline indicator component
 * Shows network status and pending sync items
 */
import { useState, useEffect, useCallback } from 'react'
import { WifiOff, Cloud, RefreshCw } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { useNotesStore } from '@/stores/notesStore'
import { getSyncQueueCount } from '@/lib/db/syncQueueRepository'
import { processSyncQueue } from '@/lib/offlineSync'
import { cn } from '@/lib/utils'

interface OfflineIndicatorProps {
  className?: string
  showDetails?: boolean
}

export function OfflineIndicator({ className, showDetails = false }: OfflineIndicatorProps) {
  const isOnline = useAppStore(state => state.isOnline)
  const notes = useNotesStore(state => state.notes)
  const [queueCount, setQueueCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)

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

  const handleManualSync = useCallback(async () => {
    if (!isOnline || isSyncing) return
    
    setIsSyncing(true)
    try {
      await processSyncQueue()
    } finally {
      setIsSyncing(false)
      const count = await getSyncQueueCount()
      setQueueCount(count)
    }
  }, [isOnline, isSyncing])

  // Don't show anything if online and no pending items
  if (isOnline && totalPending === 0 && !showDetails) {
    return null
  }

  return (
    <div className={cn('flex items-center', className)}>
      {!isOnline ? (
        <div className="flex items-center gap-1 px-1.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
          <WifiOff className="w-3.5 h-3.5" />
          {totalPending > 0 && (
            <span className="text-xs font-medium">{totalPending}</span>
          )}
        </div>
      ) : totalPending > 0 ? (
        <button
          onClick={handleManualSync}
          disabled={isSyncing}
          className="flex items-center gap-1 px-1.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
        >
          {isSyncing ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Cloud className="w-3.5 h-3.5" />
          )}
          <span className="text-xs font-medium">{totalPending}</span>
        </button>
      ) : null}
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
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl p-6 border border-neutral-200 dark:border-neutral-700">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
            <WifiOff className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
            Network Required
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
            {feature 
              ? `"${feature}" requires an internet connection.`
              : 'This action requires an internet connection.'
            }
          </p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            OK
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
  const isOnline = useAppStore(state => state.isOnline)

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
