import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import type { Editor } from '@tiptap/react'
import {
  TableProperties,
  Trash2,
  Plus,
  Minus,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  ArrowDownToLine,
  Columns2,
  Rows3,
  X
} from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/Tooltip'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { cn } from '@/lib/utils'
import type { ToolbarVisibility } from '@/hooks/useResponsiveToolbar'

/**
 * Props for the TableToolbar component
 */
export interface TableToolbarProps {
  /** The Tiptap editor instance */
  editor: Editor | null
  /** Visibility settings for toolbar buttons based on screen size */
  visibility: ToolbarVisibility
  /** Callback to open the table properties dialog */
  onOpenProperties: () => void
}

/**
 * TableToolbar Component
 * 
 * Displays contextual toolbar buttons for table operations when the cursor is inside a table.
 * The toolbar includes buttons for adding/deleting rows and columns, merging/splitting cells,
 * and accessing table properties.
 * 
 * @param props - Component props
 * @returns The table toolbar component or null if not in a table
 * 
 * @example
 * ```tsx
 * <TableToolbar
 *   editor={editor}
 *   visibility={toolbarVisibility}
 *   onOpenProperties={() => setShowPropertiesDialog(true)}
 * />
 * ```
 */
export function TableToolbar({ editor, visibility, onOpenProperties }: TableToolbarProps) {
  const { t } = useTranslation()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Only show toolbar when cursor is in a table
  const isInTable = editor?.isActive('table')
  if (!isInTable) return null

  // Check if operations are available
  const canMergeCells = editor?.can().mergeCells()
  const canSplitCell = editor?.can().splitCell()
  const canDeleteColumn = editor?.can().deleteColumn()
  const canDeleteRow = editor?.can().deleteRow()
  const canAddColumnBefore = editor?.can().addColumnBefore()
  const canAddColumnAfter = editor?.can().addColumnAfter()
  const canAddRowBefore = editor?.can().addRowBefore()
  const canAddRowAfter = editor?.can().addRowAfter()

  // Handle delete table confirmation
  const handleDeleteTable = () => {
    editor?.chain().focus().deleteTable().run()
    setShowDeleteConfirm(false)
  }

  return (
    <>
      {/* Add Column Before - Priority 3 */}
      {visibility.addColumnBefore && (
        <ToolbarButton
          onClick={() => editor?.chain().focus().addColumnBefore().run()}
          tooltip={t('editor.addColumnBefore')}
          icon={<ArrowLeftToLine className="w-[18px] h-[18px]" />}
          disabled={!canAddColumnBefore}
        />
      )}

      {/* Add Column After - Priority 3 */}
      {visibility.addColumnBefore && (
        <ToolbarButton
          onClick={() => editor?.chain().focus().addColumnAfter().run()}
          tooltip={t('editor.addColumnAfter')}
          icon={<ArrowRightToLine className="w-[18px] h-[18px]" />}
          disabled={!canAddColumnAfter}
        />
      )}

      {/* Add Row Before - Priority 3 */}
      {visibility.addRowBefore && (
        <ToolbarButton
          onClick={() => editor?.chain().focus().addRowBefore().run()}
          tooltip={t('editor.addRowBefore')}
          icon={<ArrowUpToLine className="w-[18px] h-[18px]" />}
          disabled={!canAddRowBefore}
        />
      )}

      {/* Add Row After - Priority 3 */}
      {visibility.addRowBefore && (
        <ToolbarButton
          onClick={() => editor?.chain().focus().addRowAfter().run()}
          tooltip={t('editor.addRowAfter')}
          icon={<ArrowDownToLine className="w-[18px] h-[18px]" />}
          disabled={!canAddRowAfter}
        />
      )}

      {/* Delete Column - Priority 4 */}
      {visibility.deleteColumn && (
        <ToolbarButton
          onClick={() => editor?.chain().focus().deleteColumn().run()}
          tooltip={t('editor.deleteColumn')}
          icon={<Columns2 className="w-[18px] h-[18px]" />}
          disabled={!canDeleteColumn}
        />
      )}

      {/* Delete Row - Priority 4 */}
      {visibility.deleteRow && (
        <ToolbarButton
          onClick={() => editor?.chain().focus().deleteRow().run()}
          tooltip={t('editor.deleteRow')}
          icon={<Rows3 className="w-[18px] h-[18px]" />}
          disabled={!canDeleteRow}
        />
      )}

      {/* Delete Table - Priority 3 */}
      {visibility.deleteTable && (
        <ToolbarButton
          onClick={() => setShowDeleteConfirm(true)}
          tooltip={t('editor.deleteTable')}
          icon={<Trash2 className="w-[18px] h-[18px]" />}
        />
      )}

      {/* Merge Cells - Priority 5 (conditional - only when multiple cells selected) */}
      {canMergeCells && visibility.clearFormatting && (
        <ToolbarButton
          onClick={() => editor?.chain().focus().mergeCells().run()}
          tooltip={t('editor.mergeCells')}
          icon={<Plus className="w-[18px] h-[18px]" />}
        />
      )}

      {/* Split Cell - Priority 5 (conditional - only when in merged cell) */}
      {canSplitCell && visibility.clearFormatting && (
        <ToolbarButton
          onClick={() => editor?.chain().focus().splitCell().run()}
          tooltip={t('editor.splitCell')}
          icon={<Minus className="w-[18px] h-[18px]" />}
        />
      )}

      {/* Table Properties - Priority 4 */}
      {visibility.tableProperties && (
        <ToolbarButton
          onClick={onOpenProperties}
          tooltip={t('editor.tableProperties')}
          icon={<TableProperties className="w-[18px] h-[18px]" />}
        />
      )}

      {/* Delete Table Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteTable}
        title={t('editor.deleteTableConfirmTitle')}
        description={t('editor.deleteTableConfirmDescription')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        confirmIcon={<Trash2 className="w-4 h-4" />}
        cancelIcon={<X className="w-4 h-4" />}
      />
    </>
  )
}

/**
 * Props for the ToolbarButton component
 */
interface ToolbarButtonProps {
  /** Click handler for the button */
  onClick: () => void
  /** Tooltip text to display on hover */
  tooltip: string
  /** Icon element to display in the button */
  icon: React.ReactNode
  /** Whether the button is in active state */
  active?: boolean
  /** Whether the button is disabled */
  disabled?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * Internal toolbar button component with tooltip
 */
function ToolbarButton({
  onClick,
  tooltip,
  icon,
  active,
  disabled,
  className
}: ToolbarButtonProps) {
  // Prevent mouse events from stealing focus on desktop
  const preventMouseFocusLoss = (e: React.MouseEvent) => {
    e.preventDefault()
  }

  const button = (
    <button
      onMouseDown={preventMouseFocusLoss}
      onClick={() => {
        if (!disabled) {
          onClick()
        }
      }}
      disabled={disabled}
      className={cn(
        'p-1.5 rounded-full text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors',
        active && 'bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-white',
        disabled && 'opacity-40 cursor-not-allowed',
        className
      )}
    >
      {icon}
    </button>
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {button}
      </TooltipTrigger>
      <TooltipContent side="top">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}
