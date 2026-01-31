import { useEffect, useRef } from 'react'

/**
 * Custom hook to enable drag-to-scroll and horizontal wheel scroll
 * for horizontally scrollable containers
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
    const handleWheel = (e: WheelEvent) => {
      // Only handle horizontal scroll if there's overflow
      if (element.scrollWidth > element.clientWidth) {
        // Prevent default vertical scroll
        e.preventDefault()
        
        // Scroll horizontally using deltaY (vertical wheel movement)
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
      element.style.cursor = 'move'
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
        element.style.cursor = 'pointer'
        element.style.userSelect = ''
      }
    }

    // Handle mouse leave - stop dragging if mouse leaves element
    const handleMouseLeave = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false
        element.style.cursor = 'pointer'
        element.style.userSelect = ''
      }
    }

    // Set initial cursor
    element.style.cursor = 'pointer'

    // Add event listeners
    element.addEventListener('wheel', handleWheel, { passive: false })
    element.addEventListener('mousedown', handleMouseDown)
    element.addEventListener('mousemove', handleMouseMove)
    element.addEventListener('mouseup', handleMouseUp)
    element.addEventListener('mouseleave', handleMouseLeave)

    // Cleanup
    return () => {
      element.removeEventListener('wheel', handleWheel)
      element.removeEventListener('mousedown', handleMouseDown)
      element.removeEventListener('mousemove', handleMouseMove)
      element.removeEventListener('mouseup', handleMouseUp)
      element.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  return ref
}
