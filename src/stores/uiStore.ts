import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ModalSize = 'default' | 'large' | 'xlarge'

interface UIState {
  modalSize: ModalSize
  setModalSize: (size: ModalSize) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      modalSize: 'default',
      setModalSize: (modalSize) => set({ modalSize })
    }),
    {
      name: 'ui-storage'
    }
  )
)
