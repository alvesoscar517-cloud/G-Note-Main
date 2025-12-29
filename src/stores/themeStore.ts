import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Theme } from '@/types'

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  initTheme: () => void
}

// Theme colors for different screens
const THEME_COLORS = {
  // Main app colors
  app: {
    light: '#fafafa',
    dark: '#0a0a0a'
  },
  // Login screen - matches Vanta Clouds sky color
  login: {
    light: '#68b8d7', // Vanta clouds default sky blue
    dark: '#23153c'   // Vanta clouds default dark purple
  }
}

// Update theme-color meta tag for status bar
export function updateStatusBarColor(screen: 'app' | 'login' = 'app') {
  if (typeof document === 'undefined') return
  
  const isDark = document.documentElement.classList.contains('dark')
  const colors = THEME_COLORS[screen]
  const themeColor = isDark ? colors.dark : colors.light
  
  const metaTheme = document.querySelector('meta[name="theme-color"]')
  if (metaTheme) {
    metaTheme.setAttribute('content', themeColor)
  }
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
  
  // Update ALL meta theme-color tags for mobile browsers (Android status bar)
  // This ensures status bar color matches app background perfectly
  const themeColor = isDark ? THEME_COLORS.app.dark : THEME_COLORS.app.light
  
  // Update all theme-color meta tags
  const metaThemes = document.querySelectorAll('meta[name="theme-color"]')
  metaThemes.forEach(meta => {
    meta.setAttribute('content', themeColor)
    // Remove media attribute to ensure this color is always used
    meta.removeAttribute('media')
  })
  
  // If no theme-color meta exists, create one
  if (metaThemes.length === 0) {
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    meta.content = themeColor
    document.head.appendChild(meta)
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
