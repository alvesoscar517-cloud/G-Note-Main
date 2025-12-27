import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Theme } from '@/types'

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  initTheme: () => void
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
  
  // Update meta theme-color for mobile browsers
  const metaTheme = document.querySelector('meta[name="theme-color"]')
  if (metaTheme) {
    metaTheme.setAttribute('content', isDark ? '#0a0a0a' : '#fafafa')
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      
      setTheme: (theme) => {
        set({ theme })
        applyTheme(theme)
      },
      
      toggleTheme: () => {
        const current = get().theme
        // If system, check current appearance and toggle to opposite
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
      }
    }),
    {
      name: 'theme-storage'
    }
  )
)

// Listen for system theme changes
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const { theme } = useThemeStore.getState()
    if (theme === 'system') {
      applyTheme('system')
    }
  })
}
