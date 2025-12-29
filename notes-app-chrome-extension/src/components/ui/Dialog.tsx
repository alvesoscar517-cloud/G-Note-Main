import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from './Button'
import { Input } from './Input'

interface DialogProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

export function Dialog({ open, onClose, children }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
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
        className={cn(
          'relative z-10 w-full max-w-sm max-h-[90vh] overflow-y-auto bg-white dark:bg-neutral-900 rounded-[16px] shadow-xl',
          'border border-neutral-200 dark:border-neutral-700',
          'animate-in fade-in zoom-in-95 duration-200 modal-safe-area'
        )}
      >
        {children}
      </div>
    </div>
  )
}

interface DialogHeaderProps {
  children: React.ReactNode
}

export function DialogHeader({ children }: DialogHeaderProps) {
  return (
    <div className="px-5 py-3">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
        {children}
      </h2>
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
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  cancelText
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader>{title}</DialogHeader>
      <DialogContent>{description}</DialogContent>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          {cancelText || t('common.cancel')}
        </Button>
        <Button onClick={handleConfirm}>
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
  inputType = 'text'
}: InputDialogProps) {
  const { t } = useTranslation()
  const [value, setValue] = useState(defaultValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setValue(defaultValue)
      setTimeout(() => inputRef.current?.focus(), 100)
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
      <DialogHeader>{title}</DialogHeader>
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
