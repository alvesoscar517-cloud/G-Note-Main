import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from './Button'
import { Input } from './Input'
import { useEdgeSwipeBack } from '@/hooks/useEdgeSwipeBack'
import { onModalOpen, onModalClose } from '@/stores/appStore'

interface DialogProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

export function Dialog({ open, onClose, children }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  // Edge swipe to close dialog
  const { swipeStyle } = useEdgeSwipeBack({
    onSwipeBack: onClose,
    edgeWidth: 25,
    threshold: 80,
    enabled: open
  })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
      // Update status bar color for modal
      onModalOpen()
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
      if (open) {
        // Restore status bar color when modal closes
        onModalClose()
      }
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 safe-x">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        style={swipeStyle}
        className={cn(
          'relative z-10 w-full max-w-sm max-h-[90vh] overflow-y-auto bg-white dark:bg-neutral-900 rounded-[16px] shadow-xl',
          'border border-neutral-200 dark:border-neutral-700 modal-safe-area'
        )}
      >
        {children}
      </div>
    </div>
  )
}

interface DialogHeaderProps {
  children: React.ReactNode
  icon?: React.ReactNode
}

export function DialogHeader({ children, icon }: DialogHeaderProps) {
  return (
    <div className="px-5 py-3">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="flex items-center justify-center w-10 h-10 rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 shrink-0">
            {icon}
          </div>
        )}
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
          {children}
        </h2>
      </div>
    </div>
  )
}

export function DialogContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 pb-4 text-neutral-600 dark:text-neutral-400">
      {children}
    </div>
  )
}

export function DialogFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-2 px-5 py-3 safe-bottom">
      {children}
    </div>
  )
}

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  confirmIcon?: React.ReactNode
  cancelIcon?: React.ReactNode
  headerIcon?: React.ReactNode
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  cancelText,
  confirmIcon,
  cancelIcon,
  headerIcon
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader icon={headerIcon}>{title}</DialogHeader>
      <DialogContent>{description}</DialogContent>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} className="flex items-center gap-2">
          {cancelIcon}
          {cancelText || t('common.cancel')}
        </Button>
        <Button onClick={handleConfirm} className="flex items-center gap-2">
          {confirmIcon}
          {confirmText || t('common.confirm')}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

interface InputDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (value: string) => void
  title: string
  placeholder?: string
  defaultValue?: string
  confirmText?: string
  cancelText?: string
  inputType?: string
  headerIcon?: React.ReactNode
}

export function InputDialog({
  open,
  onClose,
  onConfirm,
  title,
  placeholder,
  defaultValue = '',
  confirmText,
  cancelText,
  inputType = 'text',
  headerIcon
}: InputDialogProps) {
  const { t } = useTranslation()
  const [value, setValue] = useState(defaultValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setValue(defaultValue)
      // Don't auto-focus on mobile to prevent keyboard from opening
      // Users can tap the input to focus
    }
  }, [open, defaultValue])

  const handleConfirm = () => {
    if (value.trim()) {
      onConfirm(value.trim())
      onClose()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleConfirm()
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader icon={headerIcon}>{title}</DialogHeader>
      <DialogContent>
        <Input
          ref={inputRef}
          type={inputType}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full"
        />
      </DialogContent>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          {cancelText || t('common.cancel')}
        </Button>
        <Button onClick={handleConfirm} disabled={!value.trim()}>
          {confirmText || t('common.confirm')}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
