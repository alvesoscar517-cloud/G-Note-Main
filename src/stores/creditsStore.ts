import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const API_URL = import.meta.env.VITE_API_URL || ''

// Cache duration: 30 seconds
const CACHE_DURATION = 30 * 1000

interface CreditsState {
  credits: number
  isLoading: boolean
  lastFetched: number | null
  
  setCredits: (credits: number) => void
  fetchCredits: (userId: string, force?: boolean) => Promise<void>
  refreshCredits: (userId: string) => Promise<void>
  updateCreditsFromResponse: (creditsInfo: { used: number; remaining: number }) => void
  openCheckout: (packageId: string, userId: string) => Promise<void>
}

export const useCreditsStore = create<CreditsState>()(
  persist(
    (set, get) => ({
      credits: 0,
      isLoading: false,
      lastFetched: null,
      
      setCredits: (credits) => set({ credits }),
      
      // Smart fetch with cache - won't refetch if recently fetched
      fetchCredits: async (userId: string, force = false) => {
        if (!API_URL || !userId) return
        
        const { lastFetched, isLoading } = get()
        
        // Skip if already loading
        if (isLoading) return
        
        // Skip if recently fetched (within cache duration) and not forced
        if (!force && lastFetched && Date.now() - lastFetched < CACHE_DURATION) {
          return
        }
        
        set({ isLoading: true })
        try {
          const response = await fetch(`${API_URL}/ai/credits`, {
            headers: { 'x-user-id': userId }
          })
          
          if (response.ok) {
            const data = await response.json()
            set({ 
              credits: data.credits || 0,
              lastFetched: Date.now()
            })
          }
        } catch (error) {
          console.error('Failed to fetch credits:', error)
        } finally {
          set({ isLoading: false })
        }
      },
      
      // Force refresh - always fetches fresh data
      refreshCredits: async (userId: string) => {
        const { fetchCredits } = get()
        await fetchCredits(userId, true)
      },
      
      updateCreditsFromResponse: (creditsInfo) => {
        if (creditsInfo && typeof creditsInfo.remaining === 'number') {
          set({ credits: creditsInfo.remaining })
        }
      },
      
      // Fetch checkout URL on-demand when user clicks a package
      openCheckout: async (packageId: string, userId: string) => {
        if (!API_URL || !userId) return
        
        try {
          const response = await fetch(`${API_URL}/ai/checkout-url?packageId=${packageId}&userId=${userId}`)
          
          if (response.ok) {
            const data = await response.json()
            if (data.url) {
              window.open(data.url, '_blank')
            }
          } else {
            console.error('Failed to get checkout URL')
          }
        } catch (error) {
          console.error('Failed to open checkout:', error)
        }
      }
    }),
    {
      name: 'credits-storage',
      partialize: (state) => ({ credits: state.credits })
    }
  )
)
