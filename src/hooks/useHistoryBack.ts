import { useEffect, useRef } from 'react'

interface UseHistoryBackOptions {
  /** Whether the modal/view is currently open */
  isOpen: boolean
  /** Callback when user triggers back (via system gesture or browser back) */
  onBack: () => void
  /** Unique identifier for this history state */
  stateKey?: string
}

/**
 * Hook to integrate with browser history for back gesture support on PWA.
 * When modal opens, pushes a state to history.
 * When user swipes back (Android) or uses browser back, triggers onBack callback.
 */
export function useHistoryBack({ isOpen, onBack, stateKey = 'modal' }: UseHistoryBackOptions) {
  const hasAddedState = useRef(false)
  const onBackRef = useRef(onBack)
  
  // Keep callback ref updated
  useEffect(() => {
    onBackRef.current = onBack
  }, [onBack])

  useEffect(() => {
    if (!isOpen) {
      hasAddedState.current = false
      return
    }

    // Push state when modal opens
    if (!hasAddedState.current) {
      window.history.pushState({ [stateKey]: true }, '')
      hasAddedState.current = true
    }

    // Handle popstate (back gesture/button)
    const handlePopState = () => {
      // Check if this is our state being popped
      if (hasAddedState.current) {
        hasAddedState.current = false
        onBackRef.current()
      }
    }

    window.addEventListener('popstate', handlePopState)
    
    return () => {
      window.removeEventListener('popstate', handlePopState)
      
      // Clean up history state if modal closes programmatically (not via back)
      if (hasAddedState.current) {
        // Go back to remove our pushed state
        window.history.back()
        hasAddedState.current = false
      }
    }
  }, [isOpen, stateKey])
}
