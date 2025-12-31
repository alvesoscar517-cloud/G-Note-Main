/**
 * Network status store
 * Manages online/offline state and provides utilities for network-aware operations
 */
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

interface NetworkState {
  isOnline: boolean
  wasOffline: boolean // Track if we were offline (for sync trigger)
  lastOnlineTime: number | null
  lastOfflineTime: number | null
  
  // Retry queue for failed operations
  retryQueue: Array<{
    id: string
    fn: () => Promise<void>
    retryCount: number
    maxRetries: number
  }>
  
  // Actions
  setOnline: (online: boolean) => void
  initialize: () => () => void // Returns cleanup function
  addToRetryQueue: (id: string, fn: () => Promise<void>, maxRetries?: number) => void
  removeFromRetryQueue: (id: string) => void
  processRetryQueue: () => Promise<void>
}

// Callbacks to run when coming back online
const onlineCallbacks: Set<() => void> = new Set()

export const useNetworkStore = create<NetworkState>()(
  subscribeWithSelector((set, get) => ({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    wasOffline: false,
    lastOnlineTime: null,
    lastOfflineTime: null,
    retryQueue: [],

    setOnline: (online: boolean) => {
      const { isOnline: wasOnline } = get()
      
      set({
        isOnline: online,
        wasOffline: !online ? true : get().wasOffline,
        lastOnlineTime: online ? Date.now() : get().lastOnlineTime,
        lastOfflineTime: !online ? Date.now() : get().lastOfflineTime
      })

      // Log status change
      if (wasOnline !== online) {
        console.log(`[Network] Status changed: ${online ? 'online' : 'offline'}`)
        
        // When coming back online, trigger callbacks and process retry queue
        if (online && !wasOnline) {
          console.log('[Network] Back online - triggering sync callbacks')
          onlineCallbacks.forEach(cb => {
            try {
              cb()
            } catch (e) {
              console.error('[Network] Callback error:', e)
            }
          })
          
          // Process retry queue with delay to allow network to stabilize
          setTimeout(() => {
            get().processRetryQueue()
          }, 1000)
        }
      }
    },

    initialize: () => {
      const handleOnline = () => get().setOnline(true)
      const handleOffline = () => get().setOnline(false)

      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)

      // Set initial state
      set({ isOnline: navigator.onLine })

      // Return cleanup function
      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    },

    addToRetryQueue: (id: string, fn: () => Promise<void>, maxRetries = 3) => {
      set(state => {
        // Don't add duplicates
        if (state.retryQueue.some(item => item.id === id)) {
          return state
        }
        return {
          retryQueue: [...state.retryQueue, { id, fn, retryCount: 0, maxRetries }]
        }
      })
    },

    removeFromRetryQueue: (id: string) => {
      set(state => ({
        retryQueue: state.retryQueue.filter(item => item.id !== id)
      }))
    },

    processRetryQueue: async () => {
      const { retryQueue, isOnline, removeFromRetryQueue } = get()
      
      if (!isOnline || retryQueue.length === 0) return
      
      console.log(`[Network] Processing ${retryQueue.length} items in retry queue`)
      
      for (const item of retryQueue) {
        try {
          await item.fn()
          removeFromRetryQueue(item.id)
          console.log(`[Network] Retry successful: ${item.id}`)
        } catch (error) {
          console.error(`[Network] Retry failed: ${item.id}`, error)
          
          // Update retry count
          set(state => ({
            retryQueue: state.retryQueue.map(i => 
              i.id === item.id 
                ? { ...i, retryCount: i.retryCount + 1 }
                : i
            ).filter(i => i.retryCount < i.maxRetries)
          }))
        }
      }
    }
  }))
)

/**
 * Register a callback to run when coming back online
 */
export function onBackOnline(callback: () => void): () => void {
  onlineCallbacks.add(callback)
  return () => onlineCallbacks.delete(callback)
}

/**
 * Hook to check if a feature requires network
 * Returns a function that can be called before network operations
 */
export function useNetworkRequired() {
  const isOnline = useNetworkStore(state => state.isOnline)
  
  return {
    isOnline,
    checkNetwork: () => {
      if (!isOnline) {
        throw new NetworkRequiredError('This feature requires an internet connection')
      }
      return true
    }
  }
}

/**
 * Custom error for network-required operations
 */
export class NetworkRequiredError extends Error {
  constructor(message: string = 'Network connection required') {
    super(message)
    this.name = 'NetworkRequiredError'
  }
}

/**
 * Utility to wrap async functions with network check
 */
export function withNetworkCheck<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  errorMessage?: string
): T {
  return (async (...args: Parameters<T>) => {
    const { isOnline } = useNetworkStore.getState()
    if (!isOnline) {
      throw new NetworkRequiredError(errorMessage)
    }
    return fn(...args)
  }) as T
}
