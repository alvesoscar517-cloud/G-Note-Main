import { useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import * as Popover from '@radix-ui/react-popover'
import {
  MoreVertical,
  Download,
  Upload,
  FileText,
  FileType,
  FileCode,
  Loader2,
  AlertTriangle,
  WifiOff
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/Tooltip'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import {
  exportNote,
  importDocument,
  downloadBlob,
  getSafeFilename,
  isImageFile,
  type ExportFormat
} from '@/lib/driveExport'

// Map i18n language codes to Google OCR language codes
const OCR_LANGUAGE_MAP: Record<string, string> = {
  'en': 'en',
  'vi': 'vi',
  'ja': 'ja',
  'ko': 'ko',
  'zh-CN': 'zh',
  'zh-TW': 'zh-TW',
  'de': 'de',
  'fr': 'fr',
  'es': 'es',
  'pt-BR': 'pt',
  'it': 'it',
  'nl': 'nl',
  'ar': 'ar',
  'hi': 'hi',
  'tr': 'tr',
  'pl': 'pl',
  'th': 'th',
  'id': 'id'
}

interface NoteActionsMenuProps {
  noteTitle: string
  noteContent: string
  onImport: (title: string, content: string) => void
  disabled?: boolean
}

export function NoteActionsMenu({
  noteTitle,
  noteContent,
  onImport,
  disabled
}: NoteActionsMenuProps) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [showExportOptions, setShowExportOptions] = useState(false)
  const [ocrWarning, setOcrWarning] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const user = useAuthStore(state => state.user)
  const isOnline = useAppStore(state => state.isOnline)

  const handleExport = useCallback(async (format: ExportFormat) => {
    if (!user?.accessToken) return

    setIsExporting(true)
    try {
      const blob = await exportNote(
        user.accessToken,
        noteTitle,
        noteContent,
        format
      )
      downloadBlob(blob, getSafeFilename(noteTitle, format))
      setOpen(false)
      setShowExportOptions(false)
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }, [user?.accessToken, noteTitle, noteContent])

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.accessToken) return

    // Check if it's an image file and show warning
    const isImage = isImageFile(file)
    if (isImage) {
      setOcrWarning(t('noteActions.ocrWarning'))
    }

    setIsImporting(true)
    try {
      // Get OCR language from current app language
      const ocrLang = OCR_LANGUAGE_MAP[i18n.language] || 'en'
      const { title, content } = await importDocument(user.accessToken, file, ocrLang)
      onImport(title, content)
      setOpen(false)
      setOcrWarning(null)
    } catch (error) {
      console.error('Import failed:', error)
    } finally {
      setIsImporting(false)
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [user?.accessToken, onImport, i18n.language, t])

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setShowExportOptions(false)
      setOcrWarning(null)
    }
    setOpen(newOpen)
  }

  const isLoading = isExporting || isImporting

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.doc,.txt,.md,.html,.htm,.jpg,.jpeg,.png,.gif,.bmp,.webp,.tiff,.tif"
        onChange={handleFileChange}
        className="hidden"
      />

      <Popover.Root open={open} onOpenChange={handleOpenChange}>
        <Popover.Trigger asChild>
          <span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  disabled={disabled || isLoading}
                  onPointerDown={(e) => {
                    e.preventDefault()
                  }}
                  className={cn(
                    'flex items-center justify-center w-[44px] h-[44px] sm:w-auto sm:h-auto rounded-full transition-colors touch-manipulation',
                    'sm:p-1.5',
                    'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700',
                    open && 'bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-white',
                    (disabled || isLoading) && 'opacity-40 cursor-not-allowed'
                  )}
                >
                  {isLoading ? (
                    <Loader2 className="w-[18px] h-[18px] animate-spin" />
                  ) : (
                    <MoreVertical className="w-[18px] h-[18px]" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{t('editor.more')}</TooltipContent>
            </Tooltip>
          </span>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            side="top"
            align="center"
            sideOffset={8}
            collisionPadding={16}
            avoidCollisions={true}
            className={cn(
              'z-50 w-[220px] max-w-[calc(100vw-32px)] rounded-xl border border-neutral-200 dark:border-neutral-700',
              'bg-white dark:bg-neutral-800 shadow-lg'
            )}
          >
            {showExportOptions ? (
              <div className="p-1">
                {/* Back button */}
                <button
                  onClick={() => setShowExportOptions(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg mb-1"
                >
                  <span>‹</span>
                  {t('noteActions.selectFormat')}
                </button>

                <MenuItem
                  icon={<FileText className="w-4 h-4" />}
                  label="PDF"
                  description={t('noteActions.pdfDescription')}
                  onClick={() => handleExport('pdf')}
                  disabled={isExporting}
                />

                <MenuItem
                  icon={<FileType className="w-4 h-4" />}
                  label="Word (.docx)"
                  description={t('noteActions.docxDescription')}
                  onClick={() => handleExport('docx')}
                  disabled={isExporting}
                />

                <MenuItem
                  icon={<FileCode className="w-4 h-4" />}
                  label="HTML"
                  description={t('noteActions.htmlDescription')}
                  onClick={() => handleExport('html')}
                  disabled={isExporting}
                />

                <MenuItem
                  icon={<FileCode className="w-4 h-4" />}
                  label="Markdown (.md)"
                  description={t('noteActions.mdDescription')}
                  onClick={() => handleExport('md')}
                  disabled={isExporting}
                />
              </div>
            ) : (
              <div className="p-1">
                {/* Offline Warning */}
                {!isOnline && (
                  <div className="mx-2 mb-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-2">
                      <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        {t('offline.networkRequired')}
                      </p>
                    </div>
                  </div>
                )}

                {/* OCR Warning */}
                {ocrWarning && (
                  <div className="mx-2 mb-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        {ocrWarning}
                      </p>
                    </div>
                  </div>
                )}

                <MenuItem
                  icon={<Download className="w-4 h-4" />}
                  label={t('noteActions.export')}
                  description={t('noteActions.exportDescription')}
                  onClick={() => setShowExportOptions(true)}
                  hasSubmenu
                  disabled={!isOnline}
                />

                <MenuItem
                  icon={<Upload className="w-4 h-4" />}
                  label={t('noteActions.import')}
                  description={t('noteActions.importDescription')}
                  onClick={handleImportClick}
                  disabled={isImporting || !isOnline}
                />
              </div>
            )}
            <Popover.Arrow className="fill-white dark:fill-neutral-800" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </>
  )
}

interface MenuItemProps {
  icon: React.ReactNode
  label: string
  description?: string
  onClick: () => void
  disabled?: boolean
  hasSubmenu?: boolean
}

function MenuItem({ icon, label, description, onClick, disabled, hasSubmenu }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left',
        'hover:bg-neutral-100 dark:hover:bg-neutral-700/50 transition-colors',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span className="text-neutral-600 dark:text-neutral-400">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {label}
          </span>
          {hasSubmenu && (
            <span className="text-neutral-400 dark:text-neutral-500">›</span>
          )}
        </div>
        {description && (
          <span className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1">
            {description}
          </span>
        )}
      </div>
    </button>
  )
}
