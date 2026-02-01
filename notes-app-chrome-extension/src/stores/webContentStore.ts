import { create } from 'zustand'

// Extension-specific import (local)
import { isChromeExtension } from '../lib/chromeAuth'

export interface PendingWebContent {
  html: string
  text: string
  sourceUrl: string
  sourceTitle: string
  timestamp: number
}

interface WebContentState {
  pendingContent: PendingWebContent | null
  isLoading: boolean
  
  // Actions
  checkPendingContent: () => Promise<PendingWebContent | null>
  clearPendingContent: () => Promise<void>
  setPendingContent: (content: PendingWebContent | null) => void
}

export const useWebContentStore = create<WebContentState>((set) => ({
  pendingContent: null,
  isLoading: false,
  
  checkPendingContent: async () => {
    if (!isChromeExtension()) return null
    
    set({ isLoading: true })
    
    try {
      const result = await chrome.storage.local.get('pendingWebContent')
      const content = result.pendingWebContent as PendingWebContent | undefined
      
      // Only use content if it's recent (within last 5 minutes)
      if (content && Date.now() - content.timestamp < 5 * 60 * 1000) {
        set({ pendingContent: content, isLoading: false })
        return content
      }
      
      set({ pendingContent: null, isLoading: false })
      return null
    } catch (error) {
      console.error('Error checking pending content:', error)
      set({ isLoading: false })
      return null
    }
  },
  
  clearPendingContent: async () => {
    if (!isChromeExtension()) return
    
    try {
      await chrome.storage.local.remove('pendingWebContent')
      set({ pendingContent: null })
    } catch (error) {
      console.error('Error clearing pending content:', error)
    }
  },
  
  setPendingContent: (content) => {
    set({ pendingContent: content })
  }
}))
