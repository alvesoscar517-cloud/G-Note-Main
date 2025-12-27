import { useRef, useCallback, useState } from 'react'

interface SwipeConfig {
  onSwipeDown?: () => void
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  threshold?: number // minimum distance to trigger swipe
  enabled?: boolean
}

interface SwipeState {
  offsetY: number
  offsetX: number
  isDragging: boolean
}

export function useSwipeGesture({
  onSwipeDown,
  onSwipeLeft,
  onSwipeRight,
  threshold = 100,
  enabled = true
}: SwipeConfig) {
  const startPos = useRef<{ x: number; y: number } | null>(null)
  const currentPos = useRef<{ x: number; y: number } | null>(null)
  const [swipeState, setSwipeState] = useState<SwipeState>({
    offsetY: 0,
    offsetX: 0,
    isDragging: false
  })

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return
    
    const touch = e.touches[0]
    startPos.current = { x: touch.clientX, y: touch.clientY }
    currentPos.current = { x: touch.clientX, y: touch.clientY }
    setSwipeState(prev => ({ ...prev, isDragging: true }))
  }, [enabled])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enabled || !startPos.current) return
    
    const touch = e.touches[0]
    currentPos.current = { x: touch.clientX, y: touch.clientY }
    
    const deltaX = touch.clientX - startPos.current.x
    const deltaY = touch.clientY - startPos.current.y
    
    // Only track vertical swipe for swipe-down (close modal)
    // Only allow positive deltaY (swipe down)
    if (onSwipeDown && deltaY > 0 && Math.abs(deltaY) > Math.abs(deltaX)) {
      setSwipeState({
        offsetY: deltaY,
        offsetX: 0,
        isDragging: true
      })
    }
    
    // Horizontal swipe
    if ((onSwipeLeft || onSwipeRight) && Math.abs(deltaX) > Math.abs(deltaY)) {
      setSwipeState({
        offsetY: 0,
        offsetX: deltaX,
        isDragging: true
      })
    }
  }, [enabled, onSwipeDown, onSwipeLeft, onSwipeRight])

  const handleTouchEnd = useCallback(() => {
    if (!enabled || !startPos.current || !currentPos.current) {
      setSwipeState({ offsetY: 0, offsetX: 0, isDragging: false })
      return
    }
    
    const deltaX = currentPos.current.x - startPos.current.x
    const deltaY = currentPos.current.y - startPos.current.y
    
    // Check swipe direction and trigger callback
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      // Vertical swipe
      if (deltaY > threshold && onSwipeDown) {
        onSwipeDown()
      }
    } else {
      // Horizontal swipe
      if (deltaX < -threshold && onSwipeLeft) {
        onSwipeLeft()
      } else if (deltaX > threshold && onSwipeRight) {
        onSwipeRight()
      }
    }
    
    // Reset
    startPos.current = null
    currentPos.current = null
    setSwipeState({ offsetY: 0, offsetX: 0, isDragging: false })
  }, [enabled, threshold, onSwipeDown, onSwipeLeft, onSwipeRight])

  const handleTouchCancel = useCallback(() => {
    startPos.current = null
    currentPos.current = null
    setSwipeState({ offsetY: 0, offsetX: 0, isDragging: false })
  }, [])

  return {
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchCancel
    },
    swipeState,
    // Style to apply for visual feedback during swipe
    swipeStyle: swipeState.isDragging ? {
      transform: `translateY(${swipeState.offsetY}px)`,
      transition: 'none',
      opacity: Math.max(0.5, 1 - swipeState.offsetY / 300)
    } : {
      transform: 'translateY(0)',
      transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
      opacity: 1
    }
  }
}
