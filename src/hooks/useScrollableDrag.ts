import { useEffect, useRef } from 'react'

/**
 * Custom hook to enable drag-to-scroll, horizontal wheel scroll,
 * and touchpad two-finger horizontal scrolling for horizontally scrollable containers
 */
export function useScrollableDrag<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const isDraggingRef = useRef(false)
  const startXRef = useRef(0)
  const scrollLeftRef = useRef(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    // Handle mouse wheel for horizontal scroll
    // Supports both regular mouse wheel (deltaY) and touchpad horizontal swipe (deltaX)
    const handleWheel = (e: WheelEvent) => {
      // Only handle if there's horizontal overflow
      if (element.scrollWidth <= element.clientWidth) return

      // Check if this is a horizontal scroll (from touchpad)
      const isHorizontalScroll = Math.abs(e.deltaX) > Math.abs(e.deltaY)

      if (isHorizontalScroll) {
        // Touchpad horizontal swipe - use deltaX directly
        // Don't prevent default to allow natural feel
        element.scrollLeft += e.deltaX
        // Prevent propagation to parent containers
        e.stopPropagation()
      } else if (e.deltaY !== 0) {
        // Regular mouse wheel (vertical) - convert to horizontal scroll
        e.preventDefault()
        element.scrollLeft += e.deltaY
      }
    }

    // Handle mouse down - start dragging
    const handleMouseDown = (e: MouseEvent) => {
      // Only start drag on the container itself, not on buttons
      const target = e.target as HTMLElement
      if (target.closest('button') || target.closest('a')) {
        return
      }

      isDraggingRef.current = true
      startXRef.current = e.pageX - element.offsetLeft
      scrollLeftRef.current = element.scrollLeft
      element.style.cursor = 'grabbing'
      element.style.userSelect = 'none'
    }

    // Handle mouse move - perform dragging
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return

      e.preventDefault()
      const x = e.pageX - element.offsetLeft
      const walk = (x - startXRef.current) * 1.5 // Multiply for faster scroll
      element.scrollLeft = scrollLeftRef.current - walk
    }

    // Handle mouse up - stop dragging
    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false
        element.style.cursor = 'grab'
        element.style.userSelect = ''
      }
    }

    // Handle mouse leave - stop dragging if mouse leaves element
    const handleMouseLeave = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false
        element.style.cursor = 'grab'
        element.style.userSelect = ''
      }
    }

    // Handle touch events for mobile swipe
    let touchStartX = 0
    let touchScrollLeft = 0

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].pageX
        touchScrollLeft = element.scrollLeft
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && element.scrollWidth > element.clientWidth) {
        const deltaX = touchStartX - e.touches[0].pageX
        element.scrollLeft = touchScrollLeft + deltaX
      }
    }

    // Set initial cursor
    element.style.cursor = 'grab'

    // Add event listeners
    element.addEventListener('wheel', handleWheel, { passive: false })
    element.addEventListener('mousedown', handleMouseDown)
    element.addEventListener('mousemove', handleMouseMove)
    element.addEventListener('mouseup', handleMouseUp)
    element.addEventListener('mouseleave', handleMouseLeave)
    element.addEventListener('touchstart', handleTouchStart, { passive: true })
    element.addEventListener('touchmove', handleTouchMove, { passive: true })

    // Cleanup
    return () => {
      element.removeEventListener('wheel', handleWheel)
      element.removeEventListener('mousedown', handleMouseDown)
      element.removeEventListener('mousemove', handleMouseMove)
      element.removeEventListener('mouseup', handleMouseUp)
      element.removeEventListener('mouseleave', handleMouseLeave)
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
    }
  }, [])

  return ref
}
