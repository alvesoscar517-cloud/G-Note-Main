import { useState, useCallback, useMemo, useRef } from 'react'
import { useDrag } from '@use-gesture/react'
import { useSpring, useMotionValue, useTransform } from 'framer-motion'

interface SwipeConfig {
  onSwipeDown?: () => void
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  threshold?: number // minimum distance to trigger swipe
  velocityThreshold?: number // velocity threshold for quick swipes
  enabled?: boolean
}

interface SwipeState {
  offsetY: number
  offsetX: number
  isDragging: boolean
  velocity: [number, number]
  direction: 'none' | 'up' | 'down' | 'left' | 'right'
}

// Spring config for smooth animations (iOS-like feel)
const SPRING_CONFIG = { stiffness: 400, damping: 30, mass: 0.8 }

/**
 * Enhanced swipe gesture hook using @use-gesture/react + Framer Motion
 * Features:
 * - Velocity-based swipe detection (quick swipes trigger earlier)
 * - Smooth spring physics via Framer Motion
 * - Better touch prediction with momentum
 * - Rubber-band effect for over-scroll
 */
export function useSwipeGesture({
  onSwipeDown,
  onSwipeLeft,
  onSwipeRight,
  threshold = 100,
  velocityThreshold = 0.5, // pixels per millisecond
  enabled = true
}: SwipeConfig) {
  const [swipeState, setSwipeState] = useState<SwipeState>({
    offsetY: 0,
    offsetX: 0,
    isDragging: false,
    velocity: [0, 0],
    direction: 'none'
  })

  // Framer Motion values for smooth spring animations
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  
  // Spring-animated values for smooth return-to-rest
  const springX = useSpring(x, SPRING_CONFIG)
  const springY = useSpring(y, SPRING_CONFIG)
  
  // Track last velocity for momentum-based predictions
  const lastVelocityRef = useRef<[number, number]>([0, 0])
  const directionLockedRef = useRef<'horizontal' | 'vertical' | null>(null)

  // Memoize callbacks to prevent unnecessary re-renders
  const handleSwipeDown = useCallback(() => {
    onSwipeDown?.()
  }, [onSwipeDown])

  const handleSwipeLeft = useCallback(() => {
    onSwipeLeft?.()
  }, [onSwipeLeft])

  const handleSwipeRight = useCallback(() => {
    onSwipeRight?.()
  }, [onSwipeRight])

  // Rubber-band effect for over-threshold drags
  const rubberBand = useCallback((value: number, limit: number) => {
    if (Math.abs(value) < limit) return value
    const sign = value > 0 ? 1 : -1
    const excess = Math.abs(value) - limit
    // Logarithmic resistance for natural feel
    return sign * (limit + Math.log10(1 + excess / limit) * limit * 0.5)
  }, [])

  const bind = useDrag(
    ({ active, movement: [mx, my], velocity: [vx, vy], first, cancel }) => {
      if (!enabled) {
        cancel()
        return
      }

      // Lock direction on first significant movement
      if (first) {
        directionLockedRef.current = null
      }

      const absX = Math.abs(mx)
      const absY = Math.abs(my)

      // Lock direction after 10px of movement
      if (!directionLockedRef.current && (absX > 10 || absY > 10)) {
        directionLockedRef.current = absY > absX ? 'vertical' : 'horizontal'
      }

      const isVertical = directionLockedRef.current === 'vertical'
      const isHorizontal = directionLockedRef.current === 'horizontal'

      // Store velocity for momentum calculations
      lastVelocityRef.current = [vx, vy]

      if (active) {
        // Determine swipe direction
        let direction: SwipeState['direction'] = 'none'
        if (isVertical) {
          direction = my > 0 ? 'down' : 'up'
        } else if (isHorizontal) {
          direction = mx > 0 ? 'right' : 'left'
        }

        // During drag - update motion values for visual feedback
        if (onSwipeDown && isVertical && my > 0) {
          // Swipe down - apply rubber-band effect
          const rubberY = rubberBand(my, threshold * 1.5)
          y.set(rubberY)
          x.set(0)
          setSwipeState({
            offsetY: my,
            offsetX: 0,
            isDragging: true,
            velocity: [vx, vy],
            direction
          })
        } else if ((onSwipeLeft || onSwipeRight) && isHorizontal) {
          // Horizontal swipe - apply rubber-band effect
          const rubberX = rubberBand(mx, threshold * 1.5)
          x.set(rubberX)
          y.set(0)
          setSwipeState({
            offsetY: 0,
            offsetX: mx,
            isDragging: true,
            velocity: [vx, vy],
            direction
          })
        } else {
          x.set(0)
          y.set(0)
          setSwipeState({
            offsetY: 0,
            offsetX: 0,
            isDragging: true,
            velocity: [vx, vy],
            direction: 'none'
          })
        }
      } else {
        // Drag ended - check if swipe should trigger
        // Use velocity OR distance threshold (whichever is met first)
        // Velocity-based: quick swipes trigger even with less distance
        const velocityMultiplier = 1 + Math.max(Math.abs(vx), Math.abs(vy)) * 0.5

        if (isVertical && my > 0) {
          // Swipe down - check with velocity boost
          const effectiveThreshold = threshold / velocityMultiplier
          if ((my > effectiveThreshold || vy > velocityThreshold) && onSwipeDown) {
            handleSwipeDown()
          }
        } else if (isHorizontal) {
          // Horizontal swipes - check with velocity boost
          const effectiveThreshold = threshold / velocityMultiplier
          if (mx < 0 && (absX > effectiveThreshold || vx < -velocityThreshold) && onSwipeLeft) {
            handleSwipeLeft()
          } else if (mx > 0 && (absX > effectiveThreshold || vx > velocityThreshold) && onSwipeRight) {
            handleSwipeRight()
          }
        }

        // Reset motion values (spring will animate back)
        x.set(0)
        y.set(0)
        directionLockedRef.current = null
        
        // Reset state
        setSwipeState({
          offsetY: 0,
          offsetX: 0,
          isDragging: false,
          velocity: [0, 0],
          direction: 'none'
        })
      }
    },
    {
      enabled,
      filterTaps: true,
      pointer: { touch: true },
      // Prevent browser gestures from interfering
      preventScrollAxis: 'y',
    }
  )

  // Calculate progress for animations (0 to 1)
  const progress = useMemo(() => {
    if (swipeState.offsetY > 0) {
      return Math.min(swipeState.offsetY / threshold, 1)
    }
    return Math.min(Math.abs(swipeState.offsetX) / threshold, 1)
  }, [swipeState.offsetY, swipeState.offsetX, threshold])

  // Opacity transform based on progress
  const opacity = useTransform(
    swipeState.offsetY > 0 ? springY : springX,
    [-threshold * 1.5, 0, threshold * 1.5],
    [0.5, 1, 0.5]
  )

  // CSS style for non-Framer Motion usage (backwards compatible)
  const swipeStyle = useMemo(() => {
    if (swipeState.isDragging) {
      if (swipeState.offsetY > 0) {
        const rubberY = rubberBand(swipeState.offsetY, threshold * 1.5)
        return {
          transform: `translateY(${rubberY}px)`,
          transition: 'none',
          opacity: Math.max(0.5, 1 - progress * 0.5)
        }
      }
      
      if (swipeState.offsetX !== 0) {
        const rubberX = rubberBand(swipeState.offsetX, threshold * 1.5)
        return {
          transform: `translateX(${rubberX}px)`,
          transition: 'none',
          opacity: Math.max(0.5, 1 - progress * 0.5)
        }
      }
    }

    // Return to rest with spring-like easing
    return {
      transform: 'translate(0, 0)',
      transition: 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.35s ease-out',
      opacity: 1
    }
  }, [swipeState, threshold, progress, rubberBand])

  // Convert @use-gesture bind to React touch handlers format
  const handlers = useMemo(() => {
    const boundHandlers = bind()
    return {
      onTouchStart: boundHandlers.onPointerDown,
      onTouchMove: boundHandlers.onPointerMove,
      onTouchEnd: boundHandlers.onPointerUp,
      onTouchCancel: boundHandlers.onPointerCancel,
      // Also support pointer events for better cross-platform support
      onPointerDown: boundHandlers.onPointerDown,
      onPointerMove: boundHandlers.onPointerMove,
      onPointerUp: boundHandlers.onPointerUp,
      onPointerCancel: boundHandlers.onPointerCancel,
    }
  }, [bind])

  return {
    handlers,
    swipeState,
    swipeStyle,
    progress,
    // Framer Motion values for advanced usage
    motionValues: {
      x: springX,
      y: springY,
      opacity
    },
    // Expose bind for direct use with spread syntax
    bind
  }
}
