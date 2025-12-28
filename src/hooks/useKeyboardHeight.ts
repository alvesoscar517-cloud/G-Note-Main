import { useState, useEffect, useCallback } from 'react'
import { isTouchDevice } from './useIsTouchDevice'

/**
 * Hook to detect virtual keyboard height on mobile devices
 * Uses visualViewport API to calculate keyboard height
 * Returns 0 on desktop or when keyboard is not visible
 */
export function useKeyboardHeight(): number {
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  const updateKeyboardHeight = useCallback(() => {
    // Only apply on touch devices
    if (!isTouchDevice()) {
      setKeyboardHeight(0)
      return
    }

    const viewport = window.visualViewport
    if (!viewport) {
      setKeyboardHeight(0)
      return
    }

    // Calculate keyboard height from viewport difference
    // window.innerHeight is the full viewport, viewport.height is visible area
    const heightDiff = window.innerHeight - viewport.height
    
    // Use threshold to avoid false positives from browser chrome changes
    // Keyboard is typically > 200px on mobile
    const newKeyboardHeight = heightDiff > 150 ? heightDiff : 0
    
    setKeyboardHeight(newKeyboardHeight)
  }, [])

  useEffect(() => {
    // Skip on non-touch devices
    if (!isTouchDevice()) return

    const viewport = window.visualViewport
    if (!viewport) return

    // Initial check
    updateKeyboardHeight()

    // Listen to viewport resize (keyboard open/close)
    viewport.addEventListener('resize', updateKeyboardHeight)
    viewport.addEventListener('scroll', updateKeyboardHeight)

    // Also listen to focus events on inputs
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('[contenteditable="true"]')
      ) {
        // Delay to allow keyboard to fully open
        setTimeout(updateKeyboardHeight, 100)
        setTimeout(updateKeyboardHeight, 300)
      }
    }

    const handleBlur = () => {
      // Delay to allow keyboard to fully close
      setTimeout(updateKeyboardHeight, 100)
    }

    document.addEventListener('focusin', handleFocus, { passive: true })
    document.addEventListener('focusout', handleBlur, { passive: true })

    return () => {
      viewport.removeEventListener('resize', updateKeyboardHeight)
      viewport.removeEventListener('scroll', updateKeyboardHeight)
      document.removeEventListener('focusin', handleFocus)
      document.removeEventListener('focusout', handleBlur)
    }
  }, [updateKeyboardHeight])

  return keyboardHeight
}

/**
 * Hook that returns whether keyboard is currently visible
 */
export function useIsKeyboardVisible(): boolean {
  const keyboardHeight = useKeyboardHeight()
  return keyboardHeight > 0
}
