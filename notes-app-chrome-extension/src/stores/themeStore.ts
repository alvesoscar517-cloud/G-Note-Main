import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Theme } from '@/types'

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  initTheme: () => void
}

// Theme colors
const THEME_COLORS = {
  light: '#fafafa',
  dark: '#0a0a0a'
}

// Computed modal theme colors (blend with overlay)
const MODAL_THEME_COLORS = {
  light: '#7d7d7d', // Approximation of #fafafa with 50% black overlay
  dark: '#050505'   // Approximation of #0a0a0a with 50% black overlay
}

// Track modal open count for nested modals
let modalOpenCount = 0

function getSystemTheme(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

// Update meta theme-color for mobile browsers
export function updateStatusBarColor(forModal = false) {
  if (typeof document === 'undefined') return
  
  const isDark = document.documentElement.classList.contains('dark')
  
  // Use modal colors when any modal is open
  const themeColor = forModal || modalOpenCount > 0
    ? (isDark ? MODAL_THEME_COLORS.dark : MODAL_THEME_COLORS.light)
    : (isDark ? THEME_COLORS.dark : THEME_COLORS.light)
  
  const metaTheme = document.querySelector('meta[name="theme-color"]')
  if (metaTheme) {
    metaTheme.setAttribute('content', themeColor)
  }
}

// Call when modal opens
export function onModalOpen() {
  modalOpenCount++
  updateStatusBarColor(true)
}

// Call when modal closes
export function onModalClose() {
  modalOpenCount = Math.max(0, modalOpenCount - 1)
  // Small delay to sync with modal close animation
  setTimeout(() => {
    updateStatusBarColor(modalOpenCount > 0)
  }, 50)
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
  
  // Listen for orientation changes to update status bar color
  // Some devices need a refresh of theme-color when orientation changes
  window.addEventListener('orientationchange', () => {
    // Small delay to ensure orientation has fully changed
    setTimeout(() => {
      updateStatusBarColor()
    }, 100)
  })
}
