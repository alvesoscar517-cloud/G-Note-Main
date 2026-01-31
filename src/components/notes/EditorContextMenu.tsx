import { useTranslation } from 'react-i18next'
import { useRef, useState, useCallback, useEffect } from 'react'
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
    ClipboardPaste,
    Sparkles,
    TextSelect
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
type ContextType = 'cell' | 'row' | 'column' | 'table' | 'text'

/**
 * Check if element is inside a table
 */
function isElementInTable(target: HTMLElement): boolean {
    let element: HTMLElement | null = target
    while (element) {
        if (element.tagName === 'TABLE') {
            return true
        }
        element = element.parentElement
    }
    return false
}

/**
 * Get the context type based on the clicked element
 */
function getContextType(target: HTMLElement): ContextType {
    // Check if not in table
    if (!isElementInTable(target)) {
        return 'text'
    }

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
 * Props for the EditorContextMenu component
 */
export interface EditorContextMenuProps {
    /** The Tiptap editor instance */
    editor: Editor | null
    /** Child elements that trigger the context menu */
    children: React.ReactNode
    /** Callback to open the table properties dialog */
    onOpenTableProperties: () => void
    /** Callback to open AI ask dialog with selected text */
    onAskAI?: (text: string) => void
}

/**
 * EditorContextMenu Component
 * 
 * Unified context menu for the editor that adapts based on context:
 * - Text selection: Copy/Cut/Paste/Select All/Ask AI
 * - Table cell/row/column: Table-specific operations
 * 
 * Features:
 * - Context-aware menu items
 * - Smart paste with clipboard detection
 * - Keyboard shortcuts displayed
 * - Long-press support for mobile
 */
export function EditorContextMenu({
    editor,
    children,
    onOpenTableProperties,
    onAskAI
}: EditorContextMenuProps) {
    const { t } = useTranslation()

    // Ref to store the touch timer for long-press detection
    const touchTimerRef = useRef<NodeJS.Timeout | null>(null)

    // Track context type for smart menu display
    const [contextType, setContextType] = useState<ContextType>('text')
    const [hasClipboard, setHasClipboard] = useState(false)
    const [selectedText, setSelectedText] = useState('')

    // Check clipboard status on mount and focus
    useEffect(() => {
        const checkClipboard = async () => {
            try {
                const text = await navigator.clipboard.readText()
                setHasClipboard(!!text)
            } catch {
                setHasClipboard(false)
            }
        }

        checkClipboard()
        window.addEventListener('focus', checkClipboard)
        return () => window.removeEventListener('focus', checkClipboard)
    }, [])

    /**
     * Handle context menu open - detect what was clicked
     */
    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement
        const type = getContextType(target)
        setContextType(type)

        // Capture selected text
        const selection = window.getSelection()
        if (selection && selection.toString().trim().length > 0) {
            setSelectedText(selection.toString())
        } else {
            setSelectedText('')
        }
    }, [])

    /**
     * Handle touch start event for long-press detection
     */
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (touchTimerRef.current) {
            clearTimeout(touchTimerRef.current)
        }

        const target = e.target as HTMLElement

        // Set up long-press detection (500ms)
        touchTimerRef.current = setTimeout(() => {
            const type = getContextType(target)
            setContextType(type)

            const selection = window.getSelection()
            if (selection && selection.toString().trim().length > 0) {
                setSelectedText(selection.toString())
            } else {
                setSelectedText('')
            }
        }, 500)
    }, [])

    /**
     * Handle touch end event
     */
    const handleTouchEnd = useCallback(() => {
        if (touchTimerRef.current) {
            clearTimeout(touchTimerRef.current)
            touchTimerRef.current = null
        }
    }, [])

    /**
     * Handle touch move event
     */
    const handleTouchMove = useCallback(() => {
        if (touchTimerRef.current) {
            clearTimeout(touchTimerRef.current)
            touchTimerRef.current = null
        }
    }, [])

    // Common operations
    const handleCopy = useCallback(() => {
        const selection = window.getSelection()
        if (selection) {
            const text = selection.toString()
            if (text) {
                navigator.clipboard.writeText(text)
                setHasClipboard(true)
            }
        }
    }, [])

    const handleCut = useCallback(() => {
        if (!editor?.isEditable) return
        const selection = window.getSelection()
        if (selection && editor) {
            const text = selection.toString()
            if (text) {
                navigator.clipboard.writeText(text)
                editor.commands.deleteSelection()
                setHasClipboard(true)
            }
        }
    }, [editor])

    const handlePaste = useCallback(async () => {
        if (!editor || !editor.isEditable) return
        try {
            const text = await navigator.clipboard.readText()
            if (text) {
                editor.commands.insertContent(text)
            }
        } catch (err) {
            console.error('Failed to paste:', err)
        }
    }, [editor])

    const handlePasteAsPlainText = useCallback(async () => {
        if (!editor || !editor.isEditable) return
        try {
            const text = await navigator.clipboard.readText()
            if (text) {
                // Insert as plain text without any formatting
                editor.chain().focus().insertContent(text, {
                    parseOptions: {
                        preserveWhitespace: true,
                    }
                }).run()
            }
        } catch (err) {
            console.error('Failed to paste:', err)
        }
    }, [editor])

    const handleSelectAll = useCallback(() => {
        editor?.commands.selectAll()
    }, [editor])

    const handleAskAI = useCallback(() => {
        if (selectedText && onAskAI) {
            onAskAI(selectedText)
        }
    }, [selectedText, onAskAI])

    // Table operations
    const handleExportCSV = useCallback(() => {
        if (!editor) return
        const csv = exportTableAsCSV(editor)
        if (csv) {
            downloadFile(csv, 'table.csv', 'text/csv')
        }
    }, [editor])

    // Table export as Markdown
    const handleExportMarkdown = useCallback(() => {
        if (!editor) return
        const markdown = exportTableAsMarkdown(editor)
        if (markdown) {
            downloadFile(markdown, 'table.md', 'text/markdown')
        }
    }, [editor])

    // Determine which operations are available for table
    const isInTable = contextType !== 'text'
    const canMergeCells = isInTable && editor?.can().mergeCells()
    const canSplitCell = isInTable && editor?.can().splitCell()
    const canDeleteColumn = isInTable && editor?.can().deleteColumn()
    const canDeleteRow = isInTable && editor?.can().deleteRow()
    const canAddColumnBefore = isInTable && editor?.can().addColumnBefore()
    const canAddColumnAfter = isInTable && editor?.can().addColumnAfter()
    const canAddRowBefore = isInTable && editor?.can().addRowBefore()
    const canAddRowAfter = isInTable && editor?.can().addRowAfter()
    const canToggleHeaderRow = isInTable && editor?.can().toggleHeaderRow()
    const canToggleHeaderColumn = isInTable && editor?.can().toggleHeaderColumn()

    // Detect OS for keyboard shortcut display
    const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0
    const cmdKey = isMac ? '⌘' : 'Ctrl+'
    const optKey = isMac ? '⌥' : 'Alt+'
    const shiftKey = isMac ? '⇧' : 'Shift+'

    return (
        <ContextMenu>
            <ContextMenuTrigger
                onContextMenu={handleContextMenu}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchMove}
                asChild
            >
                {children}
            </ContextMenuTrigger>
            <ContextMenuContent className="w-64">
                {/* Table context label */}
                {isInTable && (
                    <>
                        <ContextMenuLabel>
                            {contextType === 'column' && t('editor.columnOperations')}
                            {contextType === 'row' && t('editor.rowOperations')}
                            {contextType === 'cell' && t('editor.cellOperations')}
                            {contextType === 'table' && t('editor.tableOperations')}
                        </ContextMenuLabel>
                    </>
                )}

                {/* Common text operations */}
                <ContextMenuItem onClick={handleCut} disabled={!selectedText || !editor?.isEditable}>
                    <Scissors className="w-4 h-4" />
                    {t('contextMenu.cut')}
                    <ContextMenuShortcut>{cmdKey}X</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem onClick={handleCopy} disabled={!selectedText}>
                    <Copy className="w-4 h-4" />
                    {t('contextMenu.copy')}
                    <ContextMenuShortcut>{cmdKey}C</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem onClick={handlePaste} disabled={!hasClipboard || !editor?.isEditable}>
                    <ClipboardPaste className="w-4 h-4" />
                    {t('contextMenu.paste')}
                    <ContextMenuShortcut>{cmdKey}V</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem onClick={handlePasteAsPlainText} disabled={!hasClipboard || !editor?.isEditable}>
                    <ClipboardPaste className="w-4 h-4" />
                    {t('contextMenu.pasteAsPlainText')}
                    <ContextMenuShortcut>{cmdKey}{shiftKey}V</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={handleSelectAll}>
                    <TextSelect className="w-4 h-4" />
                    {t('contextMenu.selectAll')}
                    <ContextMenuShortcut>{cmdKey}A</ContextMenuShortcut>
                </ContextMenuItem>

                {/* AI option */}
                {onAskAI && (
                    <>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={handleAskAI} disabled={!selectedText}>
                            <Sparkles className="w-4 h-4" />
                            {t('ai.askAboutSelection')}
                        </ContextMenuItem>
                    </>
                )}

                {/* Table-specific operations */}
                {isInTable && (
                    <>
                        <ContextMenuSeparator />

                        {/* Cell operations - Merge/Split */}
                        {(contextType === 'cell') && (canMergeCells || canSplitCell) && (
                            <>
                                {canMergeCells && (
                                    <ContextMenuItem
                                        onClick={() => editor?.chain().focus().mergeCells().run()}
                                    >
                                        <Plus className="w-4 h-4" />
                                        {t('editor.mergeCells')}
                                    </ContextMenuItem>
                                )}
                                {canSplitCell && (
                                    <ContextMenuItem
                                        onClick={() => editor?.chain().focus().splitCell().run()}
                                    >
                                        <Minus className="w-4 h-4" />
                                        {t('editor.splitCell')}
                                    </ContextMenuItem>
                                )}
                                <ContextMenuSeparator />
                            </>
                        )}

                        {/* Column submenu */}
                        {(contextType === 'column' || contextType === 'cell') && (
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
                                        <ContextMenuShortcut>{optKey}{shiftKey}←</ContextMenuShortcut>
                                    </ContextMenuItem>
                                    <ContextMenuItem
                                        onClick={() => editor?.chain().focus().addColumnAfter().run()}
                                        disabled={!canAddColumnAfter}
                                    >
                                        <ArrowRightToLine className="w-4 h-4" />
                                        {t('editor.addColumnAfter')}
                                        <ContextMenuShortcut>{optKey}{shiftKey}→</ContextMenuShortcut>
                                    </ContextMenuItem>
                                    <ContextMenuSeparator />
                                    <ContextMenuItem
                                        onClick={() => editor?.chain().focus().deleteColumn().run()}
                                        disabled={!canDeleteColumn}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        {t('editor.deleteColumn')}
                                    </ContextMenuItem>
                                </ContextMenuSubContent>
                            </ContextMenuSub>
                        )}

                        {/* Row submenu */}
                        {(contextType === 'row' || contextType === 'cell') && (
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
                                        <ContextMenuShortcut>{optKey}{shiftKey}↑</ContextMenuShortcut>
                                    </ContextMenuItem>
                                    <ContextMenuItem
                                        onClick={() => editor?.chain().focus().addRowAfter().run()}
                                        disabled={!canAddRowAfter}
                                    >
                                        <ArrowDownToLine className="w-4 h-4" />
                                        {t('editor.addRowAfter')}
                                        <ContextMenuShortcut>{optKey}{shiftKey}↓</ContextMenuShortcut>
                                    </ContextMenuItem>
                                    <ContextMenuSeparator />
                                    <ContextMenuItem
                                        onClick={() => editor?.chain().focus().deleteRow().run()}
                                        disabled={!canDeleteRow}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        {t('editor.deleteRow')}
                                    </ContextMenuItem>
                                </ContextMenuSubContent>
                            </ContextMenuSub>
                        )}

                        {/* Table submenu */}
                        <ContextMenuSub>
                            <ContextMenuSubTrigger>
                                <TableProperties className="w-4 h-4" />
                                {t('editor.table')}
                            </ContextMenuSubTrigger>
                            <ContextMenuSubContent>
                                <ContextMenuItem
                                    onClick={() => editor?.chain().focus().toggleHeaderRow().run()}
                                    disabled={!canToggleHeaderRow}
                                >
                                    <ToggleLeft className="w-4 h-4" />
                                    {t('editor.toggleHeaderRow')}
                                </ContextMenuItem>
                                <ContextMenuItem
                                    onClick={() => editor?.chain().focus().toggleHeaderColumn().run()}
                                    disabled={!canToggleHeaderColumn}
                                >
                                    <ToggleRight className="w-4 h-4" />
                                    {t('editor.toggleHeaderColumn')}
                                </ContextMenuItem>

                                <ContextMenuSeparator />

                                <ContextMenuItem onClick={handleExportCSV}>
                                    <FileDown className="w-4 h-4" />
                                    {t('editor.exportTableCSV')}
                                </ContextMenuItem>
                                <ContextMenuItem onClick={handleExportMarkdown}>
                                    <FileDown className="w-4 h-4" />
                                    {t('editor.exportTableMarkdown')}
                                </ContextMenuItem>

                                <ContextMenuSeparator />

                                <ContextMenuItem onClick={onOpenTableProperties}>
                                    <TableProperties className="w-4 h-4" />
                                    {t('editor.tableProperties')}
                                </ContextMenuItem>

                                <ContextMenuSeparator />

                                <ContextMenuItem
                                    onClick={() => editor?.chain().focus().deleteTable().run()}
                                >
                                    <Trash2 className="w-4 h-4" />
                                    {t('editor.deleteTable')}
                                </ContextMenuItem>
                            </ContextMenuSubContent>
                        </ContextMenuSub>
                    </>
                )}
            </ContextMenuContent>
        </ContextMenu>
    )
}
