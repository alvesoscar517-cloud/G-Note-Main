import { useState, useMemo, useEffect, RefObject, useCallback, useRef } from 'react'
import { useDrag } from '@use-gesture/react'
import { useSpring, useMotionValue, useTransform, motion } from 'framer-motion'
import { isTouchDevice } from './useIsTouchDevice'

interface EdgeSwipeConfig {
  onSwipeBack: () => void
  /** Width of the edge zone that triggers swipe (default: 20px) */
  edgeWidth?: number
  /** Minimum distance to trigger swipe (default: 80px) */
  threshold?: number
  /** Velocity threshold for quick swipes (default: 0.5 px/ms) */
  velocityThreshold?: number
  /** Enable/disable the gesture */
  enabled?: boolean
  /** Ref to the element to attach listeners to */
  containerRef?: RefObject<HTMLElement>
}

interface EdgeSwipeState {
  offsetX: number
  isDragging: boolean
  startedFromEdge: boolean
  velocity: number
}

// Spring config for iOS-like smooth animations
const SPRING_CONFIG = { stiffness: 400, damping: 35, mass: 0.8 }

/**
 * Enhanced edge swipe back gesture hook using @use-gesture/react + Framer Motion
 * Features:
 * - Velocity-based swipe detection (quick swipes trigger earlier)
 * - Spring physics via Framer Motion for smooth animations
 * - Better touch prediction with momentum
 * - iOS/Android-style edge swipe back gesture
 * - Predictive swipe completion based on velocity
 */
export function useEdgeSwipeBack({
  onSwipeBack,
  edgeWidth = 20,
  threshold = 80,
  velocityThreshold = 0.5,
  enabled = true,
  containerRef
}: EdgeSwipeConfig) {
  const [swipeState, setSwipeState] = useState<EdgeSwipeState>({
    offsetX: 0,
    isDragging: false,
    startedFromEdge: false,
    velocity: 0
  })

  // Framer Motion values for smooth spring animations
  const x = useMotionValue(0)
  const springX = useSpring(x, SPRING_CONFIG)

  // Track if gesture started from edge
  const startedFromEdgeRef = useRef(false)
  const startXRef = useRef(0)
  const lastVelocityRef = useRef(0)
  const lastTimeRef = useRef(0)

  // Only enable on touch devices
  const isTouch = isTouchDevice()
  const isEnabled = enabled && isTouch

  // Memoize callback
  const handleSwipeBack = useCallback(() => {
    onSwipeBack()
  }, [onSwipeBack])

  // Rubber-band effect for over-threshold drags (iOS-style)
  const rubberBand = useCallback((value: number, limit: number) => {
    if (value < limit) return value
    const excess = value - limit
    // Logarithmic resistance for natural feel
    return limit + Math.log10(1 + excess / limit) * limit * 0.4
  }, [])

  // Predict if swipe will complete based on current velocity and position
  const predictSwipeCompletion = useCallback((currentX: number, velocity: number) => {
    // Calculate where the finger would end up if released now
    // Using simple physics: final_position = current + velocity * decay_time
    const decayTime = 0.15 // seconds
    const predictedFinal = currentX + velocity * decayTime * 1000
    return predictedFinal >= threshold
  }, [threshold])

  const bind = useDrag(
    ({ active, xy: [currentX], movement: [mx], velocity: [vx], first, memo, cancel, timeStamp }) => {
      if (!isEnabled) {
        cancel()
        return memo
      }

      // On first touch, check if it started from edge
      if (first) {
        startXRef.current = currentX - mx
        startedFromEdgeRef.current = startXRef.current <= edgeWidth
        lastTimeRef.current = timeStamp
        
        if (!startedFromEdgeRef.current) {
          cancel()
          return memo
        }
      }

      // If not started from edge, ignore
      if (!startedFromEdgeRef.current) {
        return memo
      }

      // Calculate velocity with smoothing
      const deltaTime = timeStamp - lastTimeRef.current
      if (deltaTime > 0) {
        // Exponential smoothing for velocity
        lastVelocityRef.current = lastVelocityRef.current * 0.7 + vx * 0.3
      }
      lastTimeRef.current = timeStamp

      if (active) {
        // Only track positive movement (swipe right)
        const offsetX = Math.max(0, mx)
        
        // Apply rubber-band effect for visual feedback
        const rubberX = rubberBand(offsetX * 0.3, 100)
        x.set(rubberX)
        
        setSwipeState({
          offsetX,
          isDragging: true,
          startedFromEdge: true,
          velocity: lastVelocityRef.current
        })
      } else {
        // Drag ended - check if swipe should trigger
        // Use velocity-based prediction for smoother UX
        const velocity = lastVelocityRef.current
        const shouldTrigger = 
          mx >= threshold || 
          velocity > velocityThreshold ||
          predictSwipeCompletion(mx, velocity)

        if (shouldTrigger && mx > 0) {
          handleSwipeBack()
        }

        // Reset
        startedFromEdgeRef.current = false
        lastVelocityRef.current = 0
        x.set(0)
        
        setSwipeState({
          offsetX: 0,
          isDragging: false,
          startedFromEdge: false,
          velocity: 0
        })
      }

      return memo
    },
    {
      enabled: isEnabled,
      filterTaps: true,
      pointer: { touch: true },
      axis: 'x',
      // Allow vertical scrolling when not swiping from edge
      preventScrollAxis: undefined,
      from: () => [0, 0],
    }
  )

  // For containerRef support, we need to use native event listeners
  useEffect(() => {
    if (!isEnabled || !containerRef?.current) return

    const element = containerRef.current
    let startX = 0
    let startY = 0
    let startedFromEdge = false
    let currentOffsetX = 0
    let lastTouchTime = 0
    let lastTouchX = 0
    let velocity = 0

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      startX = touch.clientX
      startY = touch.clientY
      startedFromEdge = startX <= edgeWidth
      lastTouchTime = e.timeStamp
      lastTouchX = startX
      velocity = 0

      if (startedFromEdge) {
        x.set(0)
        setSwipeState({
          offsetX: 0,
          isDragging: true,
          startedFromEdge: true,
          velocity: 0
        })
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!startedFromEdge) return

      const touch = e.touches[0]
      const deltaX = touch.clientX - startX
      const deltaY = touch.clientY - startY

      // Calculate velocity
      const deltaTime = e.timeStamp - lastTouchTime
      if (deltaTime > 0) {
        const instantVelocity = (touch.clientX - lastTouchX) / deltaTime
        velocity = velocity * 0.7 + instantVelocity * 0.3
      }
      lastTouchTime = e.timeStamp
      lastTouchX = touch.clientX

      // Cancel if mostly vertical
      if (Math.abs(deltaY) > Math.abs(deltaX) * 1.5) {
        startedFromEdge = false
        x.set(0)
        setSwipeState({
          offsetX: 0,
          isDragging: false,
          startedFromEdge: false,
          velocity: 0
        })
        return
      }

      // Only track positive deltaX (swipe right)
      if (deltaX > 0) {
        e.preventDefault()
        currentOffsetX = deltaX
        
        // Apply rubber-band effect
        const rubberX = rubberBand(deltaX * 0.3, 100)
        x.set(rubberX)
        
        setSwipeState({
          offsetX: deltaX,
          isDragging: true,
          startedFromEdge: true,
          velocity
        })
      }
    }

    const handleTouchEnd = () => {
      if (!startedFromEdge) return

      // Use velocity-based prediction
      const shouldTrigger = 
        currentOffsetX >= threshold || 
        velocity > velocityThreshold ||
        predictSwipeCompletion(currentOffsetX, velocity)

      if (shouldTrigger) {
        handleSwipeBack()
      }

      startedFromEdge = false
      currentOffsetX = 0
      velocity = 0
      x.set(0)
      
      setSwipeState({
        offsetX: 0,
        isDragging: false,
        startedFromEdge: false,
        velocity: 0
      })
    }

    const handleTouchCancel = () => {
      startedFromEdge = false
      currentOffsetX = 0
      velocity = 0
      x.set(0)
      
      setSwipeState({
        offsetX: 0,
        isDragging: false,
        startedFromEdge: false,
        velocity: 0
      })
    }

    element.addEventListener('touchstart', handleTouchStart, { passive: true })
    element.addEventListener('touchmove', handleTouchMove, { passive: false })
    element.addEventListener('touchend', handleTouchEnd, { passive: true })
    element.addEventListener('touchcancel', handleTouchCancel, { passive: true })

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
      element.removeEventListener('touchend', handleTouchEnd)
      element.removeEventListener('touchcancel', handleTouchCancel)
    }
  }, [isEnabled, edgeWidth, threshold, velocityThreshold, containerRef, handleSwipeBack, x, rubberBand, predictSwipeCompletion])

  // Calculate progress for animations (0 to 1)
  const progress = useMemo(() => {
    return Math.min(swipeState.offsetX / threshold, 1)
  }, [swipeState.offsetX, threshold])

  // Opacity transform based on progress
  const opacity = useTransform(springX, [0, 100], [1, 0.7])

  // CSS style for non-Framer Motion usage (backwards compatible)
  const swipeStyle = useMemo(() => {
    if (swipeState.isDragging && swipeState.startedFromEdge) {
      const translateX = rubberBand(swipeState.offsetX * 0.3, 100)
      return {
        transform: `translateX(${translateX}px)`,
        transition: 'none',
        opacity: Math.max(0.7, 1 - progress * 0.3)
      }
    }

    // Return to rest with spring-like easing (iOS-style)
    return {
      transform: 'translateX(0)',
      transition: 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.35s ease-out',
      opacity: 1
    }
  }, [swipeState, progress, rubberBand])

  // Convert @use-gesture bind to handlers format
  const handlers = useMemo(() => {
    if (containerRef) {
      // When using containerRef, handlers are attached via useEffect
      return {}
    }
    
    const boundHandlers = bind()
    return {
      onPointerDown: boundHandlers.onPointerDown,
      onPointerMove: boundHandlers.onPointerMove,
      onPointerUp: boundHandlers.onPointerUp,
      onPointerCancel: boundHandlers.onPointerCancel,
    }
  }, [bind, containerRef])

  return {
    handlers,
    swipeState,
    progress,
    swipeStyle,
    // Framer Motion values for advanced usage
    motionValues: {
      x: springX,
      opacity
    },
    bind
  }
}

/**
 * Edge swipe indicator component
 * Shows a visual hint when user starts swiping from edge
 * Enhanced with Framer Motion spring physics for smoother animations
 */
export function EdgeSwipeIndicator({ 
  progress, 
  isActive 
}: { 
  progress: number
  isActive: boolean 
}) {
  // Smooth scale with easing
  const scale = 1 + progress * 15
  const indicatorOpacity = 0.1 + progress * 0.25

  return (
    <motion.div 
      className="fixed left-0 top-0 bottom-0 w-1 z-[60] pointer-events-none"
      initial={{ scaleX: 1, opacity: 0 }}
      animate={{ 
        scaleX: isActive ? scale : 1,
        opacity: isActive ? indicatorOpacity : 0
      }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 30,
        mass: 0.8
      }}
      style={{
        background: `linear-gradient(to right, rgba(0,0,0,${indicatorOpacity}), transparent)`,
        transformOrigin: 'left',
      }}
    />
  )
}
