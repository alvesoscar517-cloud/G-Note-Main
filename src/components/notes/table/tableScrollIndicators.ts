/**
 * Utility to add scroll indicators (shadows) to table wrappers
 * This function should be called after the editor is mounted
 */

/**
 * Updates shadow classes on a table wrapper based on scroll position
 */
function updateScrollShadows(wrapper: HTMLElement) {
  const { scrollLeft, scrollWidth, clientWidth } = wrapper
  
  // Show left shadow if scrolled right
  const hasLeftScroll = scrollLeft > 0
  // Show right shadow if not scrolled to the end (with 1px threshold for rounding)
  const hasRightScroll = scrollLeft < scrollWidth - clientWidth - 1
  
  wrapper.classList.toggle('scroll-left', hasLeftScroll)
  wrapper.classList.toggle('scroll-right', hasRightScroll)
}

/**
 * Initializes scroll indicators for all table wrappers in the editor
 * Returns a cleanup function to remove event listeners
 */
export function initTableScrollIndicators(editorElement: HTMLElement): () => void {
  const observers: ResizeObserver[] = []
  const scrollHandlers: Map<HTMLElement, () => void> = new Map()

  const setupWrapper = (wrapper: HTMLElement) => {
    // Initial check
    updateScrollShadows(wrapper)

    // Update on scroll
    const scrollHandler = () => updateScrollShadows(wrapper)
    wrapper.addEventListener('scroll', scrollHandler)
    scrollHandlers.set(wrapper, scrollHandler)

    // Update on resize (viewport or content changes)
    const resizeObserver = new ResizeObserver(() => updateScrollShadows(wrapper))
    resizeObserver.observe(wrapper)
    observers.push(resizeObserver)
  }

  // Setup existing wrappers
  const wrappers = editorElement.querySelectorAll<HTMLElement>('.tiptap-table-wrapper')
  wrappers.forEach(setupWrapper)

  // Watch for new wrappers being added (when tables are created)
  const mutationObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          // Check if the node itself is a wrapper
          if (node.classList.contains('tiptap-table-wrapper')) {
            setupWrapper(node)
          }
          // Check for wrappers within the added node
          const nestedWrappers = node.querySelectorAll<HTMLElement>('.tiptap-table-wrapper')
          nestedWrappers.forEach(setupWrapper)
        }
      })
    })
  })

  mutationObserver.observe(editorElement, {
    childList: true,
    subtree: true,
  })

  // Cleanup function
  return () => {
    // Remove scroll listeners
    scrollHandlers.forEach((handler, wrapper) => {
      wrapper.removeEventListener('scroll', handler)
    })
    scrollHandlers.clear()

    // Disconnect observers
    observers.forEach((observer) => observer.disconnect())
    observers.length = 0
    mutationObserver.disconnect()
  }
}
