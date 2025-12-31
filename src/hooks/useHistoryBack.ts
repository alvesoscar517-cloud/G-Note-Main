import { useEffect, useRef, useCallback } from 'react'

interface UseHistoryBackOptions {
  /** Whether the modal/view is currently open */
  isOpen: boolean
  /** Callback when user triggers back (via system gesture or browser back) */
  onBack: () => void
  /** Unique identifier for this history state */
  stateKey?: string
}

// Global stack to track which modals are open (in order)
// This ensures only the topmost modal responds to back gesture
let modalStack: string[] = []

// Flag to prevent cascading popstate events when closing programmatically
let isClosingProgrammatically = false

/**
 * Hook to integrate with browser history for back gesture support on PWA.
 * When modal opens, pushes a state to history.
 * When user swipes back (Android) or uses browser back, triggers onBack callback.
 * 
 * Uses a stack-based approach to handle nested modals correctly:
 * - Only the topmost modal responds to back gesture
 * - Closing a modal removes it from stack without affecting others
 */
export function useHistoryBack({ isOpen, onBack, stateKey = 'modal' }: UseHistoryBackOptions) {
  const hasAddedState = useRef(false)
  const onBackRef = useRef(onBack)
  const stateKeyRef = useRef(stateKey)
  
  // Keep refs updated
  useEffect(() => {
    onBackRef.current = onBack
    stateKeyRef.current = stateKey
  }, [onBack, stateKey])

  // Handle popstate event
  const handlePopState = useCallback(() => {
    // Ignore if we're closing programmatically (to prevent cascade)
    if (isClosingProgrammatically) {
      return
    }
    
    // Only respond if this modal is on top of the stack
    const topModal = modalStack[modalStack.length - 1]
    
    if (hasAddedState.current && topModal === stateKeyRef.current) {
      // Remove from stack
      modalStack = modalStack.filter(key => key !== stateKeyRef.current)
      hasAddedState.current = false
      onBackRef.current()
    }
  }, [])

  useEffect(() => {
    if (!isOpen) {
      // Remove from stack when closed (if not already removed)
      if (hasAddedState.current) {
        modalStack = modalStack.filter(key => key !== stateKeyRef.current)
        
        // Go back to remove our pushed state
        // Use flag to prevent other modals from responding
        isClosingProgrammatically = true
        window.history.back()
        
        // Reset flag after a short delay to allow history.back() to complete
        setTimeout(() => {
          isClosingProgrammatically = false
        }, 50)
        
        hasAddedState.current = false
      }
      return
    }

    // Push state when modal opens (only once)
    if (!hasAddedState.current) {
      window.history.pushState({ modal: stateKeyRef.current }, '')
      modalStack.push(stateKeyRef.current)
      hasAddedState.current = true
    }

    window.addEventListener('popstate', handlePopState)
    
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [isOpen, handlePopState])
}
