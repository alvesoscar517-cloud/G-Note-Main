import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'
import { logoutFromBackend } from '@/lib/tokenRefresh'
import { clearAllData as clearOfflineData } from '@/lib/offlineDb'

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
        // Clear offline data (IndexedDB)
        await clearOfflineData().catch(console.error)
        set({ user: null })
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user })
    }
  )
)
