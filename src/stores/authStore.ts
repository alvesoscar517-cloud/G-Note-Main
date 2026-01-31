import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'
import { logoutFromBackend } from '@/lib/tokenRefresh'


interface AuthState {
  user: User | null
  isLoading: boolean
  isLoginTransition: boolean
  isLoggingOut: boolean
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
      isLoggingOut: false,
      setUser: (user) => set({ user }),
      setLoading: (isLoading) => set({ isLoading }),
      setLoginTransition: (isLoginTransition) => set({ isLoginTransition }),
      logout: async () => {
        set({ isLoggingOut: true })
        try {
          const user = get().user
          if (user?.id) {
            // Remove refresh token from backend
            logoutFromBackend(user.id)
          }


          // We NO LONGER clear all local data (IndexedDB) on logout
          // This allows for "smart" persistence where notes remain cached
          // but keyed by user ID, so future logins are instant.
          // await clearAllData().catch(console.error)

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
        } finally {
          set({ isLoggingOut: false })
        }
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user })
    }
  )
)
