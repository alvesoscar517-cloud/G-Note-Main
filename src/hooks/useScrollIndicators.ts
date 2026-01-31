import { useEffect, useRef, useState } from 'react'

/**
 * Hook to manage scroll indicators (shadows) for horizontally scrollable containers
 * Returns a ref to attach to the scrollable element and classes for styling
 */
export function useScrollIndicators() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showLeftShadow, setShowLeftShadow] = useState(false)
  const [showRightShadow, setShowRightShadow] = useState(false)

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return

    const updateShadows = () => {
      const { scrollLeft, scrollWidth, clientWidth } = element
      
      // Show left shadow if scrolled right
      setShowLeftShadow(scrollLeft > 0)
      
      // Show right shadow if not scrolled to the end
      // Add small threshold (1px) to account for rounding errors
      setShowRightShadow(scrollLeft < scrollWidth - clientWidth - 1)
    }

    // Check initial state
    updateShadows()

    // Update on scroll
    element.addEventListener('scroll', updateShadows)
    
    // Update on resize (viewport or content changes)
    const resizeObserver = new ResizeObserver(updateShadows)
    resizeObserver.observe(element)

    return () => {
      element.removeEventListener('scroll', updateShadows)
      resizeObserver.disconnect()
    }
  }, [])

  return {
    scrollRef,
    showLeftShadow,
    showRightShadow,
  }
}
