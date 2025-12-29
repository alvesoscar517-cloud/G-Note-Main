import { useState, useEffect, useCallback, useRef } from 'react'
import { isTouchDevice } from './useIsTouchDevice'

/**
 * Hook to detect virtual keyboard height on mobile devices
 * Uses visualViewport API to calculate keyboard height
 * Returns 0 on desktop or when keyboard is not visible
 * 
 * Key insight: On iOS with viewport-fit=cover, we need to account for:
 * 1. The visual viewport offset (scrolling when keyboard opens)
 * 2. Safe area insets
 * 3. The actual keyboard height vs viewport changes
 */
export function useKeyboardHeight(): number {
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  // Store the initial viewport height when no keyboard is shown
  const initialViewportHeightRef = useRef<number>(0)
  // Track if we've captured the initial height
  const hasInitialHeightRef = useRef(false)

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

    // Capture initial viewport height on first run (when keyboard is likely closed)
    // This gives us a baseline to compare against
    if (!hasInitialHeightRef.current) {
      initialViewportHeightRef.current = viewport.height
      hasInitialHeightRef.current = true
    }

    // Calculate keyboard height using multiple methods for accuracy
    // Method 1: Compare current viewport height to initial height
    const heightFromInitial = initialViewportHeightRef.current - viewport.height
    
    // Method 2: Use viewport offset (how much the viewport has scrolled up)
    // This is more reliable on iOS when content scrolls
    const viewportOffset = viewport.offsetTop
    
    // Method 3: Traditional method - compare to window.innerHeight
    // Note: On iOS with viewport-fit=cover, innerHeight includes safe areas
    const heightFromWindow = window.innerHeight - viewport.height - viewportOffset
    
    // Use the most reliable calculation:
    // - If viewport has scrolled (offsetTop > 0), keyboard is definitely open
    // - The keyboard height is approximately the offset + any remaining difference
    let calculatedHeight = 0
    
    if (viewportOffset > 50) {
      // Viewport has scrolled up significantly - keyboard is open
      // The keyboard height is the offset plus any additional viewport reduction
      calculatedHeight = viewportOffset + Math.max(0, heightFromInitial - viewportOffset)
    } else if (heightFromInitial > 150) {
      // Viewport height reduced significantly without scrolling
      calculatedHeight = heightFromInitial
    } else if (heightFromWindow > 150) {
      // Fallback to window comparison
      calculatedHeight = heightFromWindow
    }
    
    // Use threshold to avoid false positives from browser chrome changes
    // Keyboard is typically > 200px on mobile
    const newKeyboardHeight = calculatedHeight > 150 ? Math.round(calculatedHeight) : 0
    
    // Update initial height if keyboard closed (viewport returned to full size)
    if (newKeyboardHeight === 0 && viewport.height > initialViewportHeightRef.current) {
      initialViewportHeightRef.current = viewport.height
    }
    
    setKeyboardHeight(newKeyboardHeight)
  }, [])

  useEffect(() => {
    // Skip on non-touch devices
    if (!isTouchDevice()) return

    const viewport = window.visualViewport
    if (!viewport) return

    // Reset initial height tracking when effect runs
    hasInitialHeightRef.current = false

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
        // Multiple checks to catch the keyboard at different stages
        setTimeout(updateKeyboardHeight, 50)
        setTimeout(updateKeyboardHeight, 150)
        setTimeout(updateKeyboardHeight, 300)
        setTimeout(updateKeyboardHeight, 500)
      }
    }

    const handleBlur = () => {
      // Delay to allow keyboard to fully close
      setTimeout(updateKeyboardHeight, 100)
      setTimeout(updateKeyboardHeight, 300)
    }
    
    // Listen to window resize as backup
    const handleWindowResize = () => {
      // Reset initial height on orientation change
      if (Math.abs(window.innerWidth - window.innerHeight) > 100) {
        hasInitialHeightRef.current = false
      }
      updateKeyboardHeight()
    }

    document.addEventListener('focusin', handleFocus, { passive: true })
    document.addEventListener('focusout', handleBlur, { passive: true })
    window.addEventListener('resize', handleWindowResize, { passive: true })

    return () => {
      viewport.removeEventListener('resize', updateKeyboardHeight)
      viewport.removeEventListener('scroll', updateKeyboardHeight)
      document.removeEventListener('focusin', handleFocus)
      document.removeEventListener('focusout', handleBlur)
      window.removeEventListener('resize', handleWindowResize)
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
