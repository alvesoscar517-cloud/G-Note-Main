import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'
import { clearAllData as clearOfflineData } from '@/lib/offlineDb'
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
