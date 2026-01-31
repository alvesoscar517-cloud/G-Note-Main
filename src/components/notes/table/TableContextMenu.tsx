import { useTranslation } from 'react-i18next'
import { useRef, useState, useCallback } from 'react'
import type { Editor } from '@tiptap/react'
import {
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  ArrowDownToLine,
  Columns2,
  Rows3,
  Trash2,
  Plus,
  Minus,
  FileDown,
  TableProperties,
  ToggleLeft,
  ToggleRight,
  Copy,
  Scissors,
  ClipboardPaste
} from 'lucide-react'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent
} from '@/components/ui/ContextMenu'
import { exportTableAsCSV, exportTableAsMarkdown, downloadFile } from '@/lib/tableExport'

/**
 * Context type for smart menu display
 */
type ContextType = 'cell' | 'row' | 'column' | 'table'

/**
 * Get the context type based on the clicked element
 */
function getTableContext(target: HTMLElement): ContextType {
  // Check if clicked on column resize handle
  if (target.classList.contains('column-resize-handle')) {
    return 'column'
  }

  // Check if clicked element or parent is a table header
  let element: HTMLElement | null = target
  while (element && element.tagName !== 'TABLE') {
    if (element.tagName === 'TH') {
      return 'column'
    }
    if (element.tagName === 'TD') {
      return 'cell'
    }
    if (element.tagName === 'TR') {
      return 'row'
    }
    element = element.parentElement
  }

  // If we reached the table element
  if (element && element.tagName === 'TABLE') {
    return 'table'
  }

  return 'cell' // Default to cell context
}

/**
 * Props for the TableContextMenu component
 */
export interface TableContextMenuProps {
  /** The Tiptap editor instance */
  editor: Editor | null
  /** Child elements that trigger the context menu */
  children: React.ReactNode
  /** Callback to open the table properties dialog */
  onOpenProperties: () => void
}

/**
 * TableContextMenu Component
 * 
 * Provides a smart right-click context menu for table operations when the cursor is inside a table.
 * The menu adapts based on what element was clicked (cell, row, column, or table).
 * 
 * Features:
 * - Context-aware menu items based on clicked element
 * - Submenu structure for Column, Row, and Table operations
 * - Copy/Cut/Paste operations for cell content
 * - Merge/Split cell operations
 * - Export table as CSV or Markdown
 * - Long-press support for mobile devices (500ms)
 * 
 * @param props - Component props
 * @returns The table context menu component
 * 
 * @example
 * ```tsx
 * <TableContextMenu
 *   editor={editor}
 *   onOpenProperties={() => setShowPropertiesDialog(true)}
 * >
 *   <div>Table content</div>
 * </TableContextMenu>
 * ```
 */
export function TableContextMenu({ editor, children, onOpenProperties }: TableContextMenuProps) {
  const { t } = useTranslation()

  // Ref to store the touch timer for long-press detection
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Track context type for smart menu display
  const [contextType, setContextType] = useState<ContextType>('cell')
  const contextTargetRef = useRef<HTMLElement | null>(null)

  // All hooks must be called before any early returns (Rules of Hooks)

  /**
   * Handle context menu open - detect what was clicked
   */
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    contextTargetRef.current = target
    const type = getTableContext(target)
    setContextType(type)
  }, [])

  /**
   * Handle touch start event for long-press detection
   */
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current)
    }

    const target = e.target as HTMLElement
    contextTargetRef.current = target

    // Set up long-press detection (500ms)
    touchTimerRef.current = setTimeout(() => {
      const type = getTableContext(target)
      setContextType(type)
    }, 500)
  }, [])

  /**
   * Handle touch end event
   */
  const handleTouchEnd = useCallback((_e: React.TouchEvent) => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current)
      touchTimerRef.current = null
    }
  }, [])

  /**
   * Handle touch move event
   */
  const handleTouchMove = useCallback((_e: React.TouchEvent) => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current)
      touchTimerRef.current = null
    }
  }, [])

  // Handle export as CSV
  const handleExportCSV = useCallback(() => {
    if (!editor) return
    const csv = exportTableAsCSV(editor)
    if (csv) {
      downloadFile(csv, 'table.csv', 'text/csv')
    }
  }, [editor])

  // Handle export as Markdown
  const handleExportMarkdown = useCallback(() => {
    if (!editor) return
    const markdown = exportTableAsMarkdown(editor)
    if (markdown) {
      downloadFile(markdown, 'table.md', 'text/markdown')
    }
  }, [editor])

  // Handle copy cell content
  const handleCopyCellContent = useCallback(() => {
    const selection = window.getSelection()
    if (selection) {
      const text = selection.toString()
      if (text) {
        navigator.clipboard.writeText(text)
      }
    }
  }, [])

  // Handle cut cell content
  const handleCutCellContent = useCallback(() => {
    const selection = window.getSelection()
    if (selection && editor) {
      const text = selection.toString()
      if (text) {
        navigator.clipboard.writeText(text)
        editor.commands.deleteSelection()
      }
    }
  }, [editor])

  // Handle paste cell content
  const handlePasteCellContent = useCallback(async () => {
    if (!editor) return
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        editor.commands.insertContent(text)
      }
    } catch (err) {
      console.error('Failed to paste:', err)
    }
  }, [editor])

  // Only show context menu when cursor is in a table
  // This check comes AFTER all hooks (Rules of Hooks compliance)
  const isInTable = editor?.isActive('table')
  if (!isInTable) {
    return <>{children}</>
  }

  // Check if operations are available
  const canMergeCells = editor?.can().mergeCells()
  const canSplitCell = editor?.can().splitCell()
  const canDeleteColumn = editor?.can().deleteColumn()
  const canDeleteRow = editor?.can().deleteRow()
  const canAddColumnBefore = editor?.can().addColumnBefore()
  const canAddColumnAfter = editor?.can().addColumnAfter()
  const canAddRowBefore = editor?.can().addRowBefore()
  const canAddRowAfter = editor?.can().addRowAfter()
  const canToggleHeaderRow = editor?.can().toggleHeaderRow()
  const canToggleHeaderColumn = editor?.can().toggleHeaderColumn()

  return (
    <ContextMenu>
      <ContextMenuTrigger
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        {/* Dynamic label based on context */}
        <ContextMenuLabel>
          {contextType === 'column' && t('editor.columnOperations')}
          {contextType === 'row' && t('editor.rowOperations')}
          {contextType === 'cell' && t('editor.cellOperations')}
          {contextType === 'table' && t('editor.tableOperations')}
        </ContextMenuLabel>

        {/* Cell-specific operations */}
        {contextType === 'cell' && (
          <>
            <ContextMenuItem onClick={handleCopyCellContent}>
              <Copy className="w-4 h-4" />
              {t('contextMenu.copy')}
              <ContextMenuShortcut>⌘C</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={handleCutCellContent}>
              <Scissors className="w-4 h-4" />
              {t('contextMenu.cut')}
              <ContextMenuShortcut>⌘X</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={handlePasteCellContent}>
              <ClipboardPaste className="w-4 h-4" />
              {t('contextMenu.paste')}
              <ContextMenuShortcut>⌘V</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuSeparator />

            {/* Merge/Split Operations - only for cells */}
            {canMergeCells && (
              <ContextMenuItem
                onClick={() => editor?.chain().focus().mergeCells().run()}
              >
                <Plus className="w-4 h-4" />
                {t('editor.mergeCells')}
                <ContextMenuShortcut>⌘M</ContextMenuShortcut>
              </ContextMenuItem>
            )}
            {canSplitCell && (
              <ContextMenuItem
                onClick={() => editor?.chain().focus().splitCell().run()}
              >
                <Minus className="w-4 h-4" />
                {t('editor.splitCell')}
                <ContextMenuShortcut>⌘⇧M</ContextMenuShortcut>
              </ContextMenuItem>
            )}

            {(canMergeCells || canSplitCell) && <ContextMenuSeparator />}
          </>
        )}

        {/* Column-specific operations */}
        {(contextType === 'column' || contextType === 'cell') && (
          <>
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <Columns2 className="w-4 h-4" />
                {t('editor.column')}
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuItem
                  onClick={() => editor?.chain().focus().addColumnBefore().run()}
                  disabled={!canAddColumnBefore}
                >
                  <ArrowLeftToLine className="w-4 h-4" />
                  {t('editor.addColumnBefore')}
                  <ContextMenuShortcut>⌥⇧←</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => editor?.chain().focus().addColumnAfter().run()}
                  disabled={!canAddColumnAfter}
                >
                  <ArrowRightToLine className="w-4 h-4" />
                  {t('editor.addColumnAfter')}
                  <ContextMenuShortcut>⌥⇧→</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={() => editor?.chain().focus().deleteColumn().run()}
                  disabled={!canDeleteColumn}
                >
                  <Trash2 className="w-4 h-4" />
                  {t('editor.deleteColumn')}
                  <ContextMenuShortcut>⌥⌫</ContextMenuShortcut>
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
          </>
        )}

        {/* Row-specific operations */}
        {(contextType === 'row' || contextType === 'cell') && (
          <>
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <Rows3 className="w-4 h-4" />
                {t('editor.row')}
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuItem
                  onClick={() => editor?.chain().focus().addRowBefore().run()}
                  disabled={!canAddRowBefore}
                >
                  <ArrowUpToLine className="w-4 h-4" />
                  {t('editor.addRowBefore')}
                  <ContextMenuShortcut>⌥⇧↑</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => editor?.chain().focus().addRowAfter().run()}
                  disabled={!canAddRowAfter}
                >
                  <ArrowDownToLine className="w-4 h-4" />
                  {t('editor.addRowAfter')}
                  <ContextMenuShortcut>⌥⇧↓</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={() => editor?.chain().focus().deleteRow().run()}
                  disabled={!canDeleteRow}
                >
                  <Trash2 className="w-4 h-4" />
                  {t('editor.deleteRow')}
                  <ContextMenuShortcut>⌘⌫</ContextMenuShortcut>
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
          </>
        )}

        <ContextMenuSeparator />

        {/* Table-wide operations */}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <TableProperties className="w-4 h-4" />
            {t('editor.table')}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {/* Toggle Header Operations */}
            <ContextMenuItem
              onClick={() => editor?.chain().focus().toggleHeaderRow().run()}
              disabled={!canToggleHeaderRow}
            >
              <ToggleLeft className="w-4 h-4" />
              {t('editor.toggleHeaderRow')}
              <ContextMenuShortcut>⌘⇧H</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => editor?.chain().focus().toggleHeaderColumn().run()}
              disabled={!canToggleHeaderColumn}
            >
              <ToggleRight className="w-4 h-4" />
              {t('editor.toggleHeaderColumn')}
              <ContextMenuShortcut>⌘⇧C</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuSeparator />

            {/* Export Operations */}
            <ContextMenuItem onClick={handleExportCSV}>
              <FileDown className="w-4 h-4" />
              {t('editor.exportTableCSV')}
            </ContextMenuItem>
            <ContextMenuItem onClick={handleExportMarkdown}>
              <FileDown className="w-4 h-4" />
              {t('editor.exportTableMarkdown')}
            </ContextMenuItem>

            <ContextMenuSeparator />

            {/* Table Properties */}
            <ContextMenuItem onClick={onOpenProperties}>
              <TableProperties className="w-4 h-4" />
              {t('editor.tableProperties')}
              <ContextMenuShortcut>⌘⇧P</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuSeparator />

            {/* Delete Table */}
            <ContextMenuItem
              onClick={() => editor?.chain().focus().deleteTable().run()}
            >
              <Trash2 className="w-4 h-4" />
              {t('editor.deleteTable')}
              <ContextMenuShortcut>⌘⇧⌫</ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  )
}
