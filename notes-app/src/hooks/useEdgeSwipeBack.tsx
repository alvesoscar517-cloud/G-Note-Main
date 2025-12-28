import { useRef, useState, useEffect, RefObject } from 'react'
import { isTouchDevice } from './useIsTouchDevice'

interface EdgeSwipeConfig {
  onSwipeBack: () => void
  /** Width of the edge zone that triggers swipe (default: 20px) */
  edgeWidth?: number
  /** Minimum distance to trigger swipe (default: 80px) */
  threshold?: number
  /** Enable/disable the gesture */
  enabled?: boolean
  /** Ref to the element to attach listeners to */
  containerRef?: RefObject<HTMLElement>
}

interface EdgeSwipeState {
  offsetX: number
  isDragging: boolean
  startedFromEdge: boolean
}

/**
 * Hook for iOS/Android-style edge swipe back gesture
 * Swipe from left edge to go back (like native apps)
 * Uses native event listeners with { passive: false } to allow preventDefault
 */
export function useEdgeSwipeBack({
  onSwipeBack,
  edgeWidth = 20,
  threshold = 80,
  enabled = true,
  containerRef
}: EdgeSwipeConfig) {
  const startPos = useRef<{ x: number; y: number } | null>(null)
  const startedFromEdge = useRef(false)
  const [swipeState, setSwipeState] = useState<EdgeSwipeState>({
    offsetX: 0,
    isDragging: false,
    startedFromEdge: false
  })
  
  // Store latest values in refs to avoid stale closures
  const swipeStateRef = useRef(swipeState)
  swipeStateRef.current = swipeState
  const onSwipeBackRef = useRef(onSwipeBack)
  onSwipeBackRef.current = onSwipeBack

  // Only enable on touch devices
  const isTouch = isTouchDevice()
  const isEnabled = enabled && isTouch

  // Use native event listeners with { passive: false } to allow preventDefault
  useEffect(() => {
    if (!isEnabled) return
    
    const element = containerRef?.current || document
    
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      const startX = touch.clientX
      
      // Check if touch started from left edge
      const isFromEdge = startX <= edgeWidth
      startedFromEdge.current = isFromEdge
      
      if (isFromEdge) {
        startPos.current = { x: startX, y: touch.clientY }
        setSwipeState({
          offsetX: 0,
          isDragging: true,
          startedFromEdge: true
        })
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!startPos.current || !startedFromEdge.current) return
      
      const touch = e.touches[0]
      const deltaX = touch.clientX - startPos.current.x
      const deltaY = touch.clientY - startPos.current.y
      
      // Only track horizontal swipe (ignore if mostly vertical)
      if (Math.abs(deltaY) > Math.abs(deltaX) * 1.5) {
        // User is scrolling vertically, cancel edge swipe
        startedFromEdge.current = false
        setSwipeState({ offsetX: 0, isDragging: false, startedFromEdge: false })
        return
      }
      
      // Only allow positive deltaX (swipe right)
      if (deltaX > 0) {
        // Prevent default to avoid scrolling while swiping
        e.preventDefault()
        
        setSwipeState({
          offsetX: deltaX,
          isDragging: true,
          startedFromEdge: true
        })
      }
    }

    const handleTouchEnd = () => {
      if (!startedFromEdge.current) {
        setSwipeState({ offsetX: 0, isDragging: false, startedFromEdge: false })
        return
      }
      
      const { offsetX } = swipeStateRef.current
      
      // Trigger callback if threshold reached
      if (offsetX >= threshold) {
        onSwipeBackRef.current()
      }
      
      // Reset
      startPos.current = null
      startedFromEdge.current = false
      setSwipeState({ offsetX: 0, isDragging: false, startedFromEdge: false })
    }

    const handleTouchCancel = () => {
      startPos.current = null
      startedFromEdge.current = false
      setSwipeState({ offsetX: 0, isDragging: false, startedFromEdge: false })
    }

    // Add listeners with { passive: false } to allow preventDefault
    element.addEventListener('touchstart', handleTouchStart as EventListener, { passive: true })
    element.addEventListener('touchmove', handleTouchMove as EventListener, { passive: false })
    element.addEventListener('touchend', handleTouchEnd as EventListener, { passive: true })
    element.addEventListener('touchcancel', handleTouchCancel as EventListener, { passive: true })

    return () => {
      element.removeEventListener('touchstart', handleTouchStart as EventListener)
      element.removeEventListener('touchmove', handleTouchMove as EventListener)
      element.removeEventListener('touchend', handleTouchEnd as EventListener)
      element.removeEventListener('touchcancel', handleTouchCancel as EventListener)
    }
  }, [isEnabled, edgeWidth, threshold, containerRef])

  // Calculate visual feedback
  const progress = Math.min(swipeState.offsetX / threshold, 1)
  
  return {
    // Empty handlers - events are handled via native listeners
    handlers: {},
    swipeState,
    progress,
    // Style to apply for visual feedback during swipe
    swipeStyle: swipeState.isDragging && swipeState.startedFromEdge ? {
      transform: `translateX(${Math.min(swipeState.offsetX * 0.3, 100)}px)`,
      transition: 'none',
      opacity: Math.max(0.7, 1 - progress * 0.3)
    } : {
      transform: 'translateX(0)',
      transition: 'transform 0.25s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.25s ease-out',
      opacity: 1
    }
  }
}

/**
 * Edge swipe indicator component
 * Shows a visual hint when user starts swiping from edge
 */
export function EdgeSwipeIndicator({ 
  progress, 
  isActive 
}: { 
  progress: number
  isActive: boolean 
}) {
  if (!isActive) return null
  
  return (
    <div 
      className="fixed left-0 top-0 bottom-0 w-1 z-[60] pointer-events-none"
      style={{
        background: `linear-gradient(to right, rgba(0,0,0,${0.1 + progress * 0.2}), transparent)`,
        transform: `scaleX(${1 + progress * 10})`,
        transformOrigin: 'left',
        transition: 'none'
      }}
    />
  )
}
