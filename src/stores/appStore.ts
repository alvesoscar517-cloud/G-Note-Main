/**
 * App Store - Unified store for theme, UI, and network state
 * Merges themeStore, uiStore, and networkStore into one
 */
import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import type { Theme } from '@/types'

export type ModalSize = 'default' | 'large' | 'xlarge' | 'fullscreen'

interface AppState {
  // Theme state
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  initTheme: () => void
  
  // UI state
  modalSize: ModalSize
  setModalSize: (size: ModalSize) => void
  
  // Network state
  isOnline: boolean
  wasOffline: boolean
  lastOnlineTime: number | null
  lastOfflineTime: number | null
  retryQueue: Array<{
    id: string
    fn: () => Promise<void>
    retryCount: number
    maxRetries: number
  }>
  setOnline: (online: boolean) => void
  initialize: () => () => void
  addToRetryQueue: (id: string, fn: () => Promise<void>, maxRetries?: number) => void
  removeFromRetryQueue: (id: string) => void
  processRetryQueue: () => Promise<void>
}

// Theme colors
const THEME_COLORS = {
  light: '#fafafa',
  dark: '#0a0a0a'
}

// Computed modal theme colors (blend with overlay)
const MODAL_THEME_COLORS = {
  light: '#7d7d7d',
  dark: '#050505'
}

// Track modal open count for nested modals
let modalOpenCount = 0

// Callbacks to run when coming back online
const onlineCallbacks: Set<() => void> = new Set()

// Update theme-color meta tags for status bar
export function updateStatusBarColor(forModal = false) {
  if (typeof document === 'undefined') return
  
  const isDark = document.documentElement.classList.contains('dark')
  
  const themeColor = forModal || modalOpenCount > 0
    ? (isDark ? MODAL_THEME_COLORS.dark : MODAL_THEME_COLORS.light)
    : (isDark ? THEME_COLORS.dark : THEME_COLORS.light)
  
  const metaTags = document.querySelectorAll('meta[name="theme-color"]')
  metaTags.forEach(meta => {
    meta.setAttribute('content', themeColor)
  })
}

// Call when modal opens
export function onModalOpen() {
  modalOpenCount++
  updateStatusBarColor(true)
}

// Call when modal closes
export function onModalClose() {
  modalOpenCount = Math.max(0, modalOpenCount - 1)
  setTimeout(() => {
    updateStatusBarColor(modalOpenCount > 0)
  }, 50)
}

function getSystemTheme(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  
  const root = document.documentElement
  const isDark = theme === 'dark' || (theme === 'system' && getSystemTheme())
  
  if (isDark) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
  
  updateStatusBarColor()
}

export const useAppStore = create<AppState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Theme state
        theme: 'system',
        
        setTheme: (theme) => {
          set({ theme })
          applyTheme(theme)
        },
        
        toggleTheme: () => {
          const current = get().theme
          if (current === 'system') {
            const next = getSystemTheme() ? 'light' : 'dark'
            set({ theme: next })
            applyTheme(next)
          } else {
            const next = current === 'dark' ? 'light' : 'dark'
            set({ theme: next })
            applyTheme(next)
          }
        },
        
        initTheme: () => {
          const { theme } = get()
          applyTheme(theme)
        },
        
        // UI state
        modalSize: 'default',
        setModalSize: (modalSize) => set({ modalSize }),
        
        // Network state
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

          if (wasOnline !== online) {
            console.log(`[Network] Status changed: ${online ? 'online' : 'offline'}`)
            
            if (online && !wasOnline) {
              console.log('[Network] Back online - triggering sync callbacks')
              onlineCallbacks.forEach(cb => {
                try {
                  cb()
                } catch (e) {
                  console.error('[Network] Callback error:', e)
                }
              })
              
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

          set({ isOnline: navigator.onLine })

          return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
          }
        },

        addToRetryQueue: (id: string, fn: () => Promise<void>, maxRetries = 3) => {
          set(state => {
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
      }),
      {
        name: 'app-storage',
        partialize: (state) => ({
          theme: state.theme,
          modalSize: state.modalSize
        })
      }
    )
  )
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
 */
export function useNetworkRequired() {
  const isOnline = useAppStore(state => state.isOnline)
  
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
    const { isOnline } = useAppStore.getState()
    if (!isOnline) {
      throw new NetworkRequiredError(errorMessage)
    }
    return fn(...args)
  }) as T
}

// Listen for system theme changes
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const { theme } = useAppStore.getState()
    if (theme === 'system') {
      applyTheme('system')
    }
  })
  
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      updateStatusBarColor()
    }, 100)
  })
}
