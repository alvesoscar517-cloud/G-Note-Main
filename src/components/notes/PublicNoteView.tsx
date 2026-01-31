import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import { Markdown } from 'tiptap-markdown'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { MobileScrollableTable } from './table/MobileScrollableTable'
import { initTableScrollIndicators } from './table/tableScrollIndicators'
import { AlertCircle, LogIn } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/Tooltip'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { EditorContextMenu } from './EditorContextMenu'
import { ReadOnlyImage } from './ResizableImageExtension'
import { NoteBackground, getNoteBackgroundStyle } from './NoteStylePicker'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import Typography from '@tiptap/extension-typography'
import FontFamily from '@tiptap/extension-font-family'
import Youtube from '@tiptap/extension-youtube'
import type { Note } from '@/types'

interface PublicNoteViewProps {
  fileId: string
}

const API_URL = import.meta.env.VITE_API_URL

export function PublicNoteView({ fileId }: PublicNoteViewProps) {
  const { t } = useTranslation()
  const [note, setNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)


  // TipTap editor in read-only mode
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false
      }),
      CodeBlockLowlight.configure({
        lowlight: createLowlight(common),
        defaultLanguage: 'javascript',
        HTMLAttributes: {
          class: 'hljs'
        }
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
        HTMLAttributes: { class: 'task-item' }
      }),
      ReadOnlyImage,
      Markdown.configure({
        html: true,
        transformPastedText: false,
        transformCopiedText: false, // Disable markdown in copied text for clean plain text
        linkify: true,
        breaks: false
      }),
      MobileScrollableTable.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse table-fixed w-full my-4'
        }
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-neutral-300 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-800 px-3 py-2 text-left font-semibold'
        }
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-neutral-300 dark:border-neutral-600 px-3 py-2'
        }
      }),
      TextStyle,
      Color,
      Typography,
      FontFamily,
      Youtube.configure({
        controls: false,
        nocookie: true,
      }),
    ],
    content: '',
    editable: false,
  })

  // Initialize scroll indicators for table wrappers
  useEffect(() => {
    if (!editor) return

    let cleanup: (() => void) | undefined

    const timer = setTimeout(() => {
      const editorElement = editor.view.dom
      if (editorElement) {
        cleanup = initTableScrollIndicators(editorElement)
      }
    }, 100)

    return () => {
      clearTimeout(timer)
      if (cleanup) cleanup()
    }
  }, [editor])

  // Update editor content when note loads
  useEffect(() => {
    if (editor && note?.content) {
      editor.commands.setContent(note.content)
    }
  }, [editor, note?.content])

  useEffect(() => {
    const loadNote = async () => {
      try {
        const response = await fetch(`${API_URL}/drive/public/${fileId}`)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || t('publicNote.error'))
        }

        const data = await response.json()
        setNote(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('ai.error'))
      } finally {
        setLoading(false)
      }
    }

    loadNote()
  }, [fileId, t])


  if (loading) {
    return <LoadingOverlay isVisible={true} />
  }

  if (error || !note) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 p-4">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-neutral-400 mx-auto" />
          <h2 className="mt-4 text-lg font-semibold text-neutral-900 dark:text-white">
            {t('publicNote.error')}
          </h2>
          <p className="mt-2 text-neutral-500">
            {error || t('publicNote.notFound')}
          </p>
          <a
            href="/"
            className="mt-4 inline-block px-4 py-2 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-[12px] font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            {t('publicNote.goHome')}
          </a>
        </div>
      </div>
    )
  }

  // Check if note has custom background
  const hasCustomBg = note.style?.backgroundColor || note.style?.backgroundImage

  return (
    <div className="h-screen flex flex-col bg-neutral-50 dark:bg-neutral-950 overflow-hidden fixed inset-0 status-bar-bg">
      {/* Header */}
      <header className="flex-shrink-0 px-3 sm:px-4 pt-3 sm:pt-4 safe-top safe-x">
        <div className="max-w-3xl mx-auto bg-white/80 dark:bg-neutral-900/80 backdrop-blur-lg border border-neutral-200 dark:border-neutral-800 rounded-[12px] sm:rounded-[16px] px-3 sm:px-4 py-2.5 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <img src="/g-note.svg" alt="G-Note" className="w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0 dark:hidden" />
              <img src="/g-note-dark.svg" alt="G-Note" className="w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0 hidden dark:block" />
              <span className="font-semibold text-neutral-900 dark:text-white text-sm sm:text-base">G-Note</span>
              <span className="hidden sm:inline text-xs px-2 py-0.5 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-full">
                {t('publicNote.viewMode')}
              </span>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href="/"
                    className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors flex-shrink-0 border border-neutral-200 dark:border-neutral-700"
                  >
                    <LogIn className="w-5 h-5" />
                  </a>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {t('publicNote.startFree')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </header>

      {/* Content - scrollable */}
      <main className="flex-1 overflow-hidden px-3 sm:px-4 py-3 sm:py-4 safe-x safe-bottom">
        <article
          className={`h-full max-w-3xl mx-auto rounded-[12px] sm:rounded-[16px] border border-neutral-200 dark:border-neutral-800 overflow-hidden relative ${!hasCustomBg ? 'bg-white dark:bg-neutral-900' : ''
            }`}
          style={getNoteBackgroundStyle(note.style)}
        >
          {/* Background image layer */}
          <NoteBackground style={note.style} className="rounded-[12px] sm:rounded-[16px]" />

          {/* Content layer */}
          <div className="h-full overflow-y-auto p-4 sm:p-6 pb-8 sm:pb-10 relative z-10">
            {/* Title */}
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white">
              {note.title || t('publicNote.untitled')}
            </h1>
            <p className="mt-1.5 text-xs text-neutral-400">
              {t('publicNote.updated')} {new Date(note.updatedAt).toLocaleString()}
            </p>

            {/* TipTap Editor Content with Context Menu */}
            <EditorContextMenu
              editor={editor}
              onOpenTableProperties={() => { }} // Read-only view
            >
              <div className="mt-4">
                <EditorContent
                  editor={editor}
                  className="min-h-[200px] text-neutral-700 dark:text-neutral-300"
                />
              </div>
            </EditorContextMenu>


          </div>
        </article>
      </main>
    </div>
  )
}
