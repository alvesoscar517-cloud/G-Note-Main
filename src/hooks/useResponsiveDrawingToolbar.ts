import { useState, useEffect, useCallback } from 'react'

// Breakpoint thresholds for drawing toolbar - optimized for web app
const DRAWING_BREAKPOINTS = {
  xs: 0,      // Minimum - show essential only
  sm: 400,    // Small - show more colors
  md: 520,    // Medium - show all colors
  lg: 640,    // Large - show stroke widths inline
} as const

export interface DrawingToolbarVisibility {
  // Number of colors to show inline (rest are hidden)
  visibleColorsCount: number
  // Number of stroke widths to show inline (rest are hidden)
  visibleStrokeWidthsCount: number
  // Use compact mode (smaller buttons)
  compactMode: boolean
  // Current breakpoint for styling
  breakpoint: 'xs' | 'sm' | 'md' | 'lg'
}

function getVisibilityForWidth(width: number): DrawingToolbarVisibility {
  if (width >= DRAWING_BREAKPOINTS.lg) {
    return {
      visibleColorsCount: 9, // All colors
      visibleStrokeWidthsCount: 4, // All stroke widths
      compactMode: false,
      breakpoint: 'lg',
    }
  }
  
  if (width >= DRAWING_BREAKPOINTS.md) {
    return {
      visibleColorsCount: 7, // Most colors
      visibleStrokeWidthsCount: 4, // All stroke widths
      compactMode: false,
      breakpoint: 'md',
    }
  }
  
  if (width >= DRAWING_BREAKPOINTS.sm) {
    return {
      visibleColorsCount: 5, // Basic colors
      visibleStrokeWidthsCount: 3, // 3 stroke widths
      compactMode: true,
      breakpoint: 'sm',
    }
  }
  
  // xs - minimum
  return {
    visibleColorsCount: 4, // Essential colors only
    visibleStrokeWidthsCount: 2, // 2 stroke widths
    compactMode: true,
    breakpoint: 'xs',
  }
}

export function useResponsiveDrawingToolbar(containerRef?: React.RefObject<HTMLElement | null>) {
  const [visibility, setVisibility] = useState<DrawingToolbarVisibility>(() => 
    getVisibilityForWidth(typeof window !== 'undefined' ? window.innerWidth : 800)
  )
  
  const updateVisibility = useCallback(() => {
    const width = containerRef?.current?.offsetWidth ?? window.innerWidth
    setVisibility(getVisibilityForWidth(width))
  }, [containerRef])
  
  useEffect(() => {
    updateVisibility()
    
    window.addEventListener('resize', updateVisibility)
    
    let resizeObserver: ResizeObserver | null = null
    if (containerRef?.current) {
      resizeObserver = new ResizeObserver(updateVisibility)
      resizeObserver.observe(containerRef.current)
    }
    
    return () => {
      window.removeEventListener('resize', updateVisibility)
      resizeObserver?.disconnect()
    }
  }, [updateVisibility, containerRef])
  
  return visibility
}
