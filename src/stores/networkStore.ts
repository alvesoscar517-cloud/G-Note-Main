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
  
  // Actions
  setOnline: (online: boolean) => void
  initialize: () => () => void // Returns cleanup function
}

export const useNetworkStore = create<NetworkState>()(
  subscribeWithSelector((set, get) => ({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    wasOffline: false,
    lastOnlineTime: null,
    lastOfflineTime: null,

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
    }
  }))
)

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
