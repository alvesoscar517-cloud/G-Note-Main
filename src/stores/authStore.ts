import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'
import { logoutFromBackend } from '@/lib/tokenRefresh'
import { clearAllData } from '@/lib/db/utils'

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
    (set, get) => ({
      user: null,
      isLoading: false,
      isLoginTransition: false,
      setUser: (user) => set({ user }),
      setLoading: (isLoading) => set({ isLoading }),
      setLoginTransition: (isLoginTransition) => set({ isLoginTransition }),
      logout: async () => {
        const user = get().user
        if (user?.id) {
          // Remove refresh token from backend
          logoutFromBackend(user.id)
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
