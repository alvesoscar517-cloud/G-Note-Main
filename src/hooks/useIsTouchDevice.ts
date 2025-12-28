import { useState, useEffect } from 'react'

// Track the last input type globally
let lastInputType: 'touch' | 'mouse' | 'unknown' = 'unknown'
let inputTypeListenersAttached = false

function attachInputTypeListeners() {
  if (inputTypeListenersAttached || typeof window === 'undefined') return
  inputTypeListenersAttached = true

  // Detect touch usage
  window.addEventListener('touchstart', () => {
    lastInputType = 'touch'
  }, { passive: true, capture: true })

  // Detect mouse usage (mousemove is more reliable than click for detecting mouse)
  window.addEventListener('mousemove', (e) => {
    // Ignore if this is a simulated mouse event from touch
    // Touch events trigger mousemove with movementX/Y = 0 on some browsers
    if (e.movementX !== 0 || e.movementY !== 0) {
      lastInputType = 'mouse'
    }
  }, { passive: true, capture: true })

  // Also detect mouse via mousedown with button info
  window.addEventListener('mousedown', (e) => {
    // Real mouse clicks have specific button values
    if (e.button === 0 || e.button === 2) {
      lastInputType = 'mouse'
    }
  }, { passive: true, capture: true })
}

/**
 * Check if device has touch capability (hardware check)
 */
function hasTouchCapability(): boolean {
  if (typeof window === 'undefined') return false
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-expect-error - msMaxTouchPoints is IE specific
    navigator.msMaxTouchPoints > 0
  )
}

/**
 * Check if device is primarily a touch device (mobile/tablet)
 * Uses pointer media query which is the most reliable method
 */
function isPrimaryTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  
  // If no touch capability, definitely not a touch device
  if (!hasTouchCapability()) return false
  
  // Use pointer media query - most reliable for detecting primary input
  const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches
  const hasFinePointer = window.matchMedia('(pointer: fine)').matches
  const hasAnyFinePointer = window.matchMedia('(any-pointer: fine)').matches
  
  // If device has fine pointer (mouse/trackpad) available, prefer mouse mode
  // This handles laptops with touchscreen - they have both fine and coarse pointers
  if (hasFinePointer || hasAnyFinePointer) {
    return false
  }
  
  // If only coarse pointer (touch), it's a mobile/tablet
  if (hasCoarsePointer) {
    return true
  }
  
  // Fallback: check screen size for older browsers
  return window.innerWidth <= 768
}

/**
 * Hook to detect if the user is currently using touch input
 * For hybrid devices (laptops with touchscreen), this will return true only when
 * the user is actively using touch, not when using mouse/trackpad
 */
export function useIsTouchDevice(): boolean {
  const [isUsingTouch, setIsUsingTouch] = useState(() => isPrimaryTouchDevice())

  useEffect(() => {
    attachInputTypeListeners()
    
    // For non-touch-capable devices, always return false
    if (!hasTouchCapability()) {
      setIsUsingTouch(false)
      return
    }

    // For primary touch devices (mobile/tablet without mouse), always return true
    if (isPrimaryTouchDevice()) {
      setIsUsingTouch(true)
      return
    }

    // For hybrid devices (desktop/laptop with touchscreen), start with mouse mode
    // and only switch to touch when user actually touches
    setIsUsingTouch(false)

    const handleTouchStart = () => {
      setIsUsingTouch(true)
    }

    const handleMouseMove = (e: MouseEvent) => {
      // Only switch to mouse mode if there's actual movement
      if (e.movementX !== 0 || e.movementY !== 0) {
        setIsUsingTouch(false)
      }
    }

    const handleMouseDown = () => {
      setIsUsingTouch(false)
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('mousedown', handleMouseDown, { passive: true })

    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mousedown', handleMouseDown)
    }
  }, [])

  return isUsingTouch
}

/**
 * Static function to check if currently using touch input
 * For hybrid devices, this checks the last known input type
 * Use this when you need a one-time check without reactivity
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  
  // Ensure listeners are attached
  attachInputTypeListeners()
  
  // If no touch capability, definitely not touch
  if (!hasTouchCapability()) return false
  
  // If we know the last input type, use it
  if (lastInputType === 'mouse') return false
  if (lastInputType === 'touch') return true
  
  // Unknown - fall back to primary device detection
  return isPrimaryTouchDevice()
}

/**
 * Check if device has touch capability (regardless of current input method)
 * Use this when you need to know if touch is possible, not if it's being used
 */
export function hasTouchSupport(): boolean {
  return hasTouchCapability()
}
