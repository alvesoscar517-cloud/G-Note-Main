import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Minus } from 'lucide-react'
import { Dialog, DialogHeader, DialogContent, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface TableInsertDialogProps {
  open: boolean
  onClose: () => void
  onInsert: (rows: number, cols: number, withHeaderRow: boolean) => void
}

export function TableInsertDialog({
  open,
  onClose,
  onInsert
}: TableInsertDialogProps) {
  const { t } = useTranslation()
  const [rows, setRows] = useState(3)
  const [cols, setCols] = useState(3)
  const [withHeaderRow, setWithHeaderRow] = useState(true)

  // Reset to defaults when dialog opens
  useEffect(() => {
    if (open) {
      setRows(3)
      setCols(3)
      setWithHeaderRow(true)
    }
  }, [open])

  const handleRowsChange = (value: string) => {
    const num = parseInt(value, 10)
    if (!isNaN(num) && num >= 1 && num <= 20) {
      setRows(num)
    }
  }

  const handleColsChange = (value: string) => {
    const num = parseInt(value, 10)
    if (!isNaN(num) && num >= 1 && num <= 10) {
      setCols(num)
    }
  }

  const incrementRows = () => {
    if (rows < 20) setRows(rows + 1)
  }

  const decrementRows = () => {
    if (rows > 1) setRows(rows - 1)
  }

  const incrementCols = () => {
    if (cols < 10) setCols(cols + 1)
  }

  const decrementCols = () => {
    if (cols > 1) setCols(cols - 1)
  }

  const handleInsert = () => {
    onInsert(rows, cols, withHeaderRow)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleInsert()
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader>{t('editor.insertTable')}</DialogHeader>

      <DialogContent>
        <div className="space-y-4">
          {/* Rows Input */}
          <div className="space-y-2">
            <label htmlFor="rows-input" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {t('editor.tableRows')}
            </label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={decrementRows}
                disabled={rows <= 1}
                className="h-10 w-10 shrink-0"
                aria-label="Decrease rows"
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Input
                id="rows-input"
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                value={rows}
                onChange={(e) => handleRowsChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className="text-center"
                aria-label="Rows"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={incrementRows}
                disabled={rows >= 20}
                className="h-10 w-10 shrink-0"
                aria-label="Increase rows"
              >
                <Plus className="w-4 h-4" />
              </Button>
              <span className="text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                (1-20)
              </span>
            </div>
          </div>

          {/* Columns Input */}
          <div className="space-y-2">
            <label htmlFor="cols-input" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {t('editor.tableColumns')}
            </label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={decrementCols}
                disabled={cols <= 1}
                className="h-10 w-10 shrink-0"
                aria-label="Decrease columns"
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Input
                id="cols-input"
                type="number"
                inputMode="numeric"
                min={1}
                max={10}
                value={cols}
                onChange={(e) => handleColsChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className="text-center"
                aria-label="Columns"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={incrementCols}
                disabled={cols >= 10}
                className="h-10 w-10 shrink-0"
                aria-label="Increase columns"
              >
                <Plus className="w-4 h-4" />
              </Button>
              <span className="text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                (1-10)
              </span>
            </div>
          </div>

          {/* Header Row Checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="headerRow"
              checked={withHeaderRow}
              onChange={(e) => setWithHeaderRow(e.target.checked)}
              className="w-4 h-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500 dark:border-neutral-600 dark:bg-neutral-800"
            />
            <label
              htmlFor="headerRow"
              className="text-sm text-neutral-700 dark:text-neutral-300 cursor-pointer"
            >
              {t('editor.includeHeaderRow')}
            </label>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                {t('editor.tablePreview')}
              </label>
              <span className="text-[10px] text-neutral-400 uppercase tracking-wider">
                {t('editor.stylePreviewOnly')}
              </span>
            </div>
            <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-3 bg-neutral-50 dark:bg-neutral-800/50">
              <table className="w-full border-collapse text-xs table-fixed">
                <tbody>
                  {Array.from({ length: Math.min(rows, 3) }).map((_, rowIndex) => (
                    <tr key={rowIndex}>
                      {Array.from({ length: Math.min(cols, 3) }).map((_, colIndex) => {
                        const isHeader = withHeaderRow && rowIndex === 0
                        const Cell = isHeader ? 'th' : 'td'
                        return (
                          <Cell
                            key={colIndex}
                            className={`border border-neutral-300 dark:border-neutral-600 p-2 text-center h-8 ${isHeader
                                ? 'bg-neutral-200 dark:bg-neutral-700 font-semibold'
                                : 'bg-white dark:bg-neutral-800'
                              }`}
                          >
                            {isHeader ? 'H' : ''}
                          </Cell>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </DialogContent>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button onClick={handleInsert}>
          {t('editor.createTable')}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
