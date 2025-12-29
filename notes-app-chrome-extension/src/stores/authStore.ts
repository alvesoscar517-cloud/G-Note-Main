import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'
import { clearAllData } from '@/lib/offlineDb'
import { chromeGoogleLogout, isChromeExtension } from '@/lib/chromeAuth'

interface AuthState {
  user: User | null
  isLoading: boolean
  isLoginTransition: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  setLoginTransition: (isTransition: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, _get) => ({
      user: null,
      isLoading: false,
      isLoginTransition: false,
      setUser: (user) => set({ user }),
      setLoading: (isLoading) => set({ isLoading }),
      setLoginTransition: (isLoginTransition) => set({ isLoginTransition }),
      logout: async () => {
        // Logout from Chrome Identity API if in extension context
        if (isChromeExtension()) {
          await chromeGoogleLogout()
        }
        
        // Clear ALL local data - IndexedDB
        await clearAllData().catch(console.error)
        
        // Clear localStorage
        try {
          localStorage.removeItem('notes-storage')
        } catch (e) {
          console.error('[AuthStore] Failed to clear notes-storage:', e)
        }
        
        // Reset notes store state in memory
        const { useNotesStore } = await import('./notesStore')
        useNotesStore.getState().resetForNewUser()
        
        set({ user: null })
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user })
    }
  )
)
