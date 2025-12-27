/**
 * Offline utility hooks
 * Provides easy access to offline functionality across the app
 */
import { useCallback, useEffect, useState } from 'react'
import { useNetworkStore, NetworkRequiredError } from '@/stores/networkStore'
import { 
  addToSyncQueue, 
  getSyncQueueCount, 
  getSyncQueue, 
  type SyncQueueItem 
} from '@/lib/offlineDb'
import type { Note, Collection } from '@/types'

/**
 * Hook to check network status and handle offline scenarios
 */
export function useOffline() {
  const isOnline = useNetworkStore(state => state.isOnline)
  const wasOffline = useNetworkStore(state => state.wasOffline)
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
   */
  const executeOrQueue = useCallback(async <T>(
    fn: () => Promise<T>,
    queueData?: { 
      type: 'create' | 'update' | 'delete'
      entityType: 'note' | 'collection'
      entityId: string
      data?: Note | Collection
    }
  ): Promise<T | null> => {
    if (isOnline) {
      return fn()
    }
    
    // Queue for later if data provided
    if (queueData) {
      await addToSyncQueue(queueData)
    }
    
    return null
  }, [isOnline])

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

  return {
    isOnline,
    wasOffline,
    pendingCount,
    pendingItems,
    requireNetwork,
    executeOrQueue,
    getPendingCount,
    refreshPending
  }
}

/**
 * Hook for features that require network
 * Shows appropriate UI when offline
 */
export function useNetworkFeature(featureName: string) {
  const isOnline = useNetworkStore(state => state.isOnline)

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
  const isOnline = useNetworkStore(state => state.isOnline)
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

export { NetworkRequiredError }
