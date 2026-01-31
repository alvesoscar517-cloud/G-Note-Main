import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { Editor } from '@tiptap/react'
import { Dialog, DialogHeader, DialogContent, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

/**
 * Props for the TablePropertiesDialog component
 */
export interface TablePropertiesDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback to close the dialog */
  onClose: () => void
  /** The Tiptap editor instance */
  editor: Editor | null
}

/**
 * TablePropertiesDialog Component
 * 
 * Provides a dialog for viewing and editing table properties such as dimensions,
 * headers, width, and other options. Changes are applied immediately with preview.
 * 
 * @param props - Component props
 * @returns The table properties dialog component
 * 
 * @example
 * ```tsx
 * <TablePropertiesDialog
 *   open={showDialog}
 *   onClose={() => setShowDialog(false)}
 *   editor={editor}
 * />
 * ```
 */
export function TablePropertiesDialog({ open, onClose, editor }: TablePropertiesDialogProps) {
  const { t } = useTranslation()
  
  // State for table properties
  const [headerRow, setHeaderRow] = useState(false)
  const [headerColumn, setHeaderColumn] = useState(false)
  const [widthMode, setWidthMode] = useState<'auto' | '100%' | 'custom'>('100%')
  const [customWidth, setCustomWidth] = useState('600')
  const [widthUnit, setWidthUnit] = useState<'px' | '%'>('px')
  const [resizable, setResizable] = useState(true)
  const [dimensions, setDimensions] = useState({ rows: 0, cols: 0 })

  // Get current table properties when dialog opens
  useEffect(() => {
    if (!open || !editor) return

    // Get table dimensions
    const { state } = editor
    const { selection } = state
    const table = selection.$anchor.node(-1)
    
    if (table && table.type.name === 'table') {
      let rowCount = 0
      let colCount = 0
      
      table.forEach((row) => {
        rowCount++
        if (rowCount === 1) {
          row.forEach(() => colCount++)
        }
      })
      
      setDimensions({ rows: rowCount, cols: colCount })
    }

    // Get other properties (these would need to be stored in table attributes)
    // For now, using default values
    setHeaderRow(true)
    setHeaderColumn(false)
    setWidthMode('100%')
    setResizable(true)
  }, [open, editor])

  // Handle toggle header row
  const handleToggleHeaderRow = () => {
    const newValue = !headerRow
    setHeaderRow(newValue)
    editor?.chain().focus().toggleHeaderRow().run()
  }

  // Handle toggle header column
  const handleToggleHeaderColumn = () => {
    const newValue = !headerColumn
    setHeaderColumn(newValue)
    editor?.chain().focus().toggleHeaderColumn().run()
  }

  // Handle width mode change
  const handleWidthModeChange = (mode: 'auto' | '100%' | 'custom') => {
    setWidthMode(mode)
    // Apply width change to table
    // This would require custom table extension to support width attributes
  }

  // Handle resizable toggle
  const handleResizableToggle = () => {
    setResizable(!resizable)
    // This would require updating table configuration
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader>{t('editor.tableProperties')}</DialogHeader>
      <DialogContent>
        <div className="space-y-4">
          {/* Dimensions (read-only) */}
          <div>
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              {t('editor.tableDimensions')}
            </h3>
            <div className="flex gap-4 text-sm text-neutral-600 dark:text-neutral-400">
              <div>
                <span className="font-medium">{t('editor.tableRows')}:</span> {dimensions.rows}
              </div>
              <div>
                <span className="font-medium">{t('editor.tableColumns')}:</span> {dimensions.cols}
              </div>
            </div>
          </div>

          {/* Headers */}
          <div>
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              {t('editor.tableHeaders')}
            </h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={headerRow}
                  onChange={handleToggleHeaderRow}
                  className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-600"
                />
                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                  {t('editor.headerRow')}
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={headerColumn}
                  onChange={handleToggleHeaderColumn}
                  className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-600"
                />
                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                  {t('editor.headerColumn')}
                </span>
              </label>
            </div>
          </div>

          {/* Width */}
          <div>
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              {t('editor.tableWidth')}
            </h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="widthMode"
                  checked={widthMode === 'auto'}
                  onChange={() => handleWidthModeChange('auto')}
                  className="w-4 h-4"
                />
                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                  {t('editor.autoWidth')}
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="widthMode"
                  checked={widthMode === '100%'}
                  onChange={() => handleWidthModeChange('100%')}
                  className="w-4 h-4"
                />
                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                  {t('editor.fullWidth')}
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="widthMode"
                  checked={widthMode === 'custom'}
                  onChange={() => handleWidthModeChange('custom')}
                  className="w-4 h-4"
                />
                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                  {t('editor.customWidth')}
                </span>
              </label>
              {widthMode === 'custom' && (
                <div className="flex gap-2 ml-6">
                  <Input
                    type="number"
                    value={customWidth}
                    onChange={(e) => setCustomWidth(e.target.value)}
                    className="w-24"
                  />
                  <select
                    value={widthUnit}
                    onChange={(e) => setWidthUnit(e.target.value as 'px' | '%')}
                    className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800"
                  >
                    <option value="px">px</option>
                    <option value="%">%</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Options */}
          <div>
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              {t('editor.tableOptions')}
            </h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={resizable}
                  onChange={handleResizableToggle}
                  className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-600"
                />
                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                  {t('editor.resizableColumns')}
                </span>
              </label>
            </div>
          </div>
        </div>
      </DialogContent>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button onClick={onClose}>
          {t('common.apply')}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
