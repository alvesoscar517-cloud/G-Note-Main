/**
 * Offline utility hooks
 * Provides easy access to offline functionality across the app
 */
import { useCallback, useEffect, useState } from 'react'
import { useAppStore, NetworkRequiredError, onBackOnline } from '@/stores/appStore'
import { 
  addToSyncQueue, 
  getSyncQueueCount, 
  getSyncQueue, 
  type SyncQueueItem 
} from '@/lib/db/syncQueueRepository'
import type { Note } from '@/types'

/**
 * Hook to check network status and handle offline scenarios
 */
export function useOffline() {
  const isOnline = useAppStore(state => state.isOnline)
  const wasOffline = useAppStore(state => state.wasOffline)
  const addToRetryQueue = useAppStore(state => state.addToRetryQueue)
  const [pendingCount, setPendingCount] = useState(0)
  const [pendingItems, setPendingItems] = useState<SyncQueueItem[]>([])

  // Update pending count when online status changes
  useEffect(() => {
    const updatePending = async () => {
      const count = await getSyncQueueCount()
      setPendingCount(count)
      if (count > 0) {
        const items = await getSyncQueue()
        setPendingItems(items)
      } else {
        setPendingItems([])
      }
    }
    updatePending()
  }, [isOnline])

  /**
   * Check if online, throw error if not
   */
  const requireNetwork = useCallback((featureName?: string) => {
    if (!isOnline) {
      throw new NetworkRequiredError(
        featureName 
          ? `${featureName} requires an internet connection`
          : 'This feature requires an internet connection'
      )
    }
    return true
  }, [isOnline])

  /**
   * Execute a function only if online, otherwise queue for later
   * Now supports automatic retry when back online
   */
  const executeOrQueue = useCallback(async <T>(
    fn: () => Promise<T>,
    queueData?: { 
      type: 'create' | 'update' | 'delete'
      entityType: 'note' | 'collection'
      entityId: string
      data?: Note
    },
    options?: {
      retryOnReconnect?: boolean
      retryId?: string
    }
  ): Promise<T | null> => {
    if (isOnline) {
      try {
        return await fn()
      } catch (error) {
        // If failed due to network, queue for retry
        if (options?.retryOnReconnect && options?.retryId) {
          addToRetryQueue(options.retryId, async () => { await fn() })
        }
        throw error
      }
    }
    
    // Queue for later if data provided
    if (queueData) {
      await addToSyncQueue(queueData)
    }
    
    // Add to retry queue if requested
    if (options?.retryOnReconnect && options?.retryId) {
      addToRetryQueue(options.retryId, async () => { await fn() })
    }
    
    return null
  }, [isOnline, addToRetryQueue])

  /**
   * Get pending sync count
   */
  const getPendingCount = useCallback(async () => {
    return getSyncQueueCount()
  }, [])

  /**
   * Refresh pending items
   */
  const refreshPending = useCallback(async () => {
    const count = await getSyncQueueCount()
    setPendingCount(count)
    if (count > 0) {
      const items = await getSyncQueue()
      setPendingItems(items)
    } else {
      setPendingItems([])
    }
  }, [])

  /**
   * Register a callback to run when coming back online
   */
  const onReconnect = useCallback((callback: () => void) => {
    return onBackOnline(callback)
  }, [])

  return {
    isOnline,
    wasOffline,
    pendingCount,
    pendingItems,
    requireNetwork,
    executeOrQueue,
    getPendingCount,
    refreshPending,
    onReconnect
  }
}

/**
 * Hook for features that require network
 * Shows appropriate UI when offline
 */
export function useNetworkFeature(featureName: string) {
  const isOnline = useAppStore(state => state.isOnline)

  const checkAndExecute = useCallback(async <T>(
    fn: () => Promise<T>,
    onOffline?: () => void
  ): Promise<T | null> => {
    if (!isOnline) {
      onOffline?.()
      return null
    }
    return fn()
  }, [isOnline])

  return {
    isOnline,
    isDisabled: !isOnline,
    featureName,
    checkAndExecute
  }
}

/**
 * Hook to handle graceful degradation when token expired + offline
 * Allows user to continue editing offline even with expired token
 */
export function useOfflineGraceful() {
  const isOnline = useAppStore(state => state.isOnline)
  const [canEditOffline, setCanEditOffline] = useState(true)

  // When offline, always allow editing (will sync when back online)
  useEffect(() => {
    if (!isOnline) {
      setCanEditOffline(true)
    }
  }, [isOnline])

  return {
    isOnline,
    canEditOffline,
    // User can always edit locally, sync will happen when online + token valid
    allowLocalEdit: true
  }
}

/**
 * Hook to automatically sync when coming back online
 */
export function useAutoSyncOnReconnect(syncFn: () => Promise<void>) {
  const isOnline = useAppStore(state => state.isOnline)
  const wasOffline = useAppStore(state => state.wasOffline)

  useEffect(() => {
    // When coming back online after being offline, trigger sync
    if (isOnline && wasOffline) {
      console.log('[useAutoSyncOnReconnect] Back online, triggering sync')
      syncFn().catch(err => {
        console.error('[useAutoSyncOnReconnect] Sync failed:', err)
      })
    }
  }, [isOnline, wasOffline, syncFn])
}

export { NetworkRequiredError }
