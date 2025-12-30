import { useEffect } from 'react'
import { onModalOpen, onModalClose } from '@/stores/themeStore'

/**
 * Hook to update status bar color when modal is open
 * This makes the status bar match the modal backdrop color
 * 
 * @param isOpen - Whether the modal is currently open
 */
export function useModalStatusBar(isOpen: boolean) {
  useEffect(() => {
    if (isOpen) {
      onModalOpen()
    }
    return () => {
      if (isOpen) {
        onModalClose()
      }
    }
  }, [isOpen])
}
