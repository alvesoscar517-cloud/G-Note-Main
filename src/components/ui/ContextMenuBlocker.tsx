import { useEffect } from 'react'
import { isTouchDevice } from '@/hooks/useIsTouchDevice'

/**
 * Block default browser context menu globally
 * Only allow context menu on elements with data-allow-context-menu attribute
 * or inside elements with that attribute
 * 
 * NOTE: On touch devices (mobile/tablet), we allow native context menu
 * to preserve native text selection and copy/paste behavior.
 * Use SelectionToolbar component for custom actions on mobile.
 */
export function useBlockContextMenu() {
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      
      // On touch devices, allow native context menu for better UX
      // This preserves native text selection, copy, paste, etc.
      if (isTouchDevice()) {
        return
      }
      
      // Allow context menu if target or any parent has data-allow-context-menu
      if (target.closest('[data-allow-context-menu]')) {
        return
      }
      
      // Allow context menu on input, textarea elements
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA'
      ) {
        return
      }
      
      // Block default context menu on desktop only
      e.preventDefault()
    }

    document.addEventListener('contextmenu', handleContextMenu)
    return () => document.removeEventListener('contextmenu', handleContextMenu)
  }, [])
}

/**
 * Wrapper component that allows context menu for its children
 */
export function AllowContextMenu({ 
  children, 
  className 
}: { 
  children: React.ReactNode
  className?: string 
}) {
  return (
    <div data-allow-context-menu className={className}>
      {children}
    </div>
  )
}
