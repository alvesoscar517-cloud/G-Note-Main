/**
 * Free Note View - Public note-taking page for SEO and user acquisition
 * Features:
 * - Full rich text editor (unlocked)
 * - Local storage (with warning about data loss)
 * - Locked features (AI, History, Collaboration) show modal to redirect to main app
 * - "Save Permanently" button redirects to main app with pending note
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { languages } from '@/locales'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import { Markdown } from 'tiptap-markdown'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import TextAlign from '@tiptap/extension-text-align'
import Link from '@tiptap/extension-link'
import {
  Undo2, Redo2, Bold, Italic, List, ListOrdered, CheckSquare,
  Strikethrough, Heading1, Heading2, Heading3, RotateCcw, Save,
  Underline as UnderlineIcon, Highlighter, Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon, Code, Code2, Quote, Minus,
  Link as LinkIcon, Unlink, AlignLeft, AlignCenter, AlignRight,
  AlignJustify, RemoveFormatting, Sparkles, History, Users,
  ImagePlus, Pencil, Lock, ArrowRight, Info, X,
  Scissors, Copy, ClipboardPaste, TextSelect
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/Tooltip'
import { InputDialog, ConfirmDialog } from '@/components/ui/Dialog'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/ContextMenu'
import { ResizableImage } from './ResizableImageExtension'
import { DrawingModal } from './DrawingModal'
import { SpeechButton } from './SpeechButton'
import { NoteStylePicker, getNoteBackgroundStyle, NoteBackground } from './NoteStylePicker'
import { NoteActionsMenu } from './NoteActionsMenu'
import { useResponsiveToolbar } from '@/hooks/useResponsiveToolbar'
import { FreeNoteSEOHead } from '../FreeNoteSEOHead'
import type { NoteStyle } from '@/types'

// Local storage key for free note
const FREE_NOTE_STORAGE_KEY = 'g-note-free-note'
const PENDING_NOTE_KEY = 'g-note-pending-from-free'

interface FreeNoteData {
  title: string
  content: string
  style?: NoteStyle
  updatedAt: number
}

// Locked feature modal component
function LockedFeatureModal({ 
  open, 
  onClose, 
  feature 
}: { 
  open: boolean
  onClose: () => void
  feature: string 
}) {
  const { t } = useTranslation()
  
  if (!open) return null
  
  const handleGoToApp = () => {
    window.location.href = '/'
  }
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 max-w-sm w-full shadow-xl border border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-neutral-100 dark:bg-neutral-800 rounded-full">
          <Lock className="w-6 h-6 text-neutral-600 dark:text-neutral-400" />
        </div>
        <h3 className="text-lg font-semibold text-center text-neutral-900 dark:text-white mb-2">
          {t('freeNote.featureLocked')}
        </h3>
        <p className="text-sm text-center text-neutral-500 dark:text-neutral-400 mb-6">
          {t('freeNote.featureLockedDescription', { feature })}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleGoToApp}
            className="flex-1 px-4 py-2.5 text-sm font-medium border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            {t('freeNote.goToAppShort')}
            <ArrowRight className="w-4 h-4 flex-shrink-0" />
          </button>
        </div>
      </div>
    </div>
  )
}


// Warning banner for local storage
function LocalStorageWarning({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useTranslation()
  
  return (
    <div className="bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-3 mb-3 flex items-start gap-3">
      <Info className="w-5 h-5 text-neutral-500 dark:text-neutral-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          {t('freeNote.localStorageWarning')}
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="p-1 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors flex-shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export function FreeNoteView() {
  const { t, i18n } = useTranslation()
  const [searchParams] = useSearchParams()
  const [title, setTitle] = useState('')
  
  // Handle ?lang= URL parameter for language switching
  useEffect(() => {
    const lang = searchParams.get('lang')
    if (lang) {
      // Check if the language is supported
      const isSupported = languages.some(l => l.code === lang)
      if (isSupported && lang !== i18n.language) {
        i18n.changeLanguage(lang)
      }
    }
  }, [searchParams, i18n])
  const [noteStyle, setNoteStyle] = useState<NoteStyle | undefined>()
  const [showWarning, setShowWarning] = useState(true)
  const [showLockedModal, setShowLockedModal] = useState(false)
  const [lockedFeature, setLockedFeature] = useState('')
  const [showDrawingModal, setShowDrawingModal] = useState(false)
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [selectedText, setSelectedText] = useState('')
  
  const toolbarRef = useRef<HTMLDivElement>(null)
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const capturedTextRef = useRef<string>('')
  
  const toolbarVisibility = useResponsiveToolbar(toolbarRef)

  // TipTap editor setup
  const extensions = useMemo(() => [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      codeBlock: false
    }),
    Placeholder.configure({
      placeholder: t('freeNote.placeholder')
    }),
    CodeBlockLowlight.configure({
      lowlight: createLowlight(common),
      defaultLanguage: 'javascript',
      HTMLAttributes: { class: 'hljs' }
    }),
    TaskList,
    TaskItem.configure({
      nested: true,
      HTMLAttributes: { class: 'task-item' }
    }),
    ResizableImage,
    Markdown.configure({
      html: true,
      transformPastedText: true,
      transformCopiedText: false, // Disable markdown in copied text for clean plain text
      linkify: true,
      breaks: false
    }),
    Underline,
    Highlight.configure({ multicolor: false }),
    Subscript,
    Superscript,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Link.configure({
      openOnClick: true,
      HTMLAttributes: { class: 'text-blue-600 dark:text-blue-400 underline cursor-pointer' }
    })
  ], [t])

  const editor = useEditor({
    extensions,
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-neutral dark:prose-invert max-w-none focus:outline-none min-h-[300px]'
      }
    }
  })

  // Load saved note from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FREE_NOTE_STORAGE_KEY)
      if (saved) {
        const data: FreeNoteData = JSON.parse(saved)
        setTitle(data.title || '')
        setNoteStyle(data.style)
        if (editor && data.content) {
          editor.commands.setContent(data.content)
        }
        setLastSaved(new Date(data.updatedAt))
      }
    } catch (e) {
      console.error('Failed to load free note:', e)
    }
  }, [editor])

  // Auto-save to localStorage
  const saveToLocal = useCallback(() => {
    if (!editor) return
    
    const data: FreeNoteData = {
      title,
      content: editor.getHTML(),
      style: noteStyle,
      updatedAt: Date.now()
    }
    
    try {
      localStorage.setItem(FREE_NOTE_STORAGE_KEY, JSON.stringify(data))
      setLastSaved(new Date())
    } catch (e) {
      console.error('Failed to save free note:', e)
    }
  }, [editor, title, noteStyle])

  // Debounced auto-save
  useEffect(() => {
    if (!editor) return
    
    const timer = setTimeout(saveToLocal, 1000)
    return () => clearTimeout(timer)
  }, [editor?.getHTML(), title, noteStyle, saveToLocal])

  // Handle locked feature click
  const handleLockedFeature = (feature: string) => {
    setLockedFeature(feature)
    setShowLockedModal(true)
  }

  // Handle save permanently - redirect to main app
  const handleSavePermanently = () => {
    if (!editor) return
    
    setIsSaving(true)
    
    // Save to pending note storage
    const pendingNote = {
      title: title || t('freeNote.untitledNote'),
      content: editor.getHTML(),
      style: noteStyle,
      source: 'free-note',
      timestamp: Date.now()
    }
    
    localStorage.setItem(PENDING_NOTE_KEY, JSON.stringify(pendingNote))
    
    // Redirect to main app
    window.location.href = '/?from=free-note'
  }

  // Handle clear note
  const handleClear = () => {
    setShowResetDialog(true)
  }

  // Confirm reset
  const handleConfirmReset = () => {
    if (!editor) return
    
    setTitle('')
    editor.commands.clearContent()
    setNoteStyle(undefined)
    localStorage.removeItem(FREE_NOTE_STORAGE_KEY)
    setLastSaved(null)
    setShowResetDialog(false)
  }

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !editor) return

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      editor.chain().focus().setImage({ src: base64 }).run()
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // Handle drawing insert
  const handleDrawingInsert = (dataUrl: string) => {
    if (!editor) return
    editor.chain().focus().setImage({ src: dataUrl }).run()
    setShowDrawingModal(false)
  }

  // Handle link insert
  const handleLinkInsert = (url: string) => {
    if (!editor || !url) return
    
    const urlWithProtocol = url.startsWith('http') ? url : `https://${url}`
    editor.chain().focus().setLink({ href: urlWithProtocol }).run()
    setShowLinkDialog(false)
  }

  // Handle speech result
  const handleSpeechResult = (text: string, isFinal: boolean) => {
    if (!editor || !isFinal) return
    editor.chain().focus().insertContent(text + ' ').run()
  }

  // Context menu handlers
  const handleContextMenuOpen = useCallback(() => {
    const selection = window.getSelection()
    if (selection && selection.toString().trim().length > 0) {
      capturedTextRef.current = selection.toString()
      setSelectedText(selection.toString())
    } else {
      capturedTextRef.current = ''
      setSelectedText('')
    }
  }, [])

  const handleCopy = useCallback(() => {
    if (selectedText) {
      navigator.clipboard.writeText(selectedText)
    } else {
      document.execCommand('copy')
    }
  }, [selectedText])

  const handleCut = useCallback(() => {
    if (selectedText) {
      navigator.clipboard.writeText(selectedText)
      editor?.commands.deleteSelection()
    } else {
      document.execCommand('cut')
    }
  }, [selectedText, editor])

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      editor?.commands.insertContent(text)
    } catch {
      document.execCommand('paste')
    }
  }, [editor])

  const handleSelectAll = useCallback(() => {
    editor?.chain().focus().selectAll().run()
  }, [editor])

  const hasCustomBg = noteStyle?.backgroundColor || noteStyle?.backgroundImage

  return (
    <div className="h-screen flex flex-col bg-neutral-50 dark:bg-neutral-950 overflow-hidden fixed inset-0 status-bar-bg">
      <FreeNoteSEOHead />
      
      {/* Header */}
      <header className="flex-shrink-0 px-3 sm:px-4 pt-3 sm:pt-4 safe-top safe-x">
        <div className="max-w-4xl mx-auto bg-white/80 dark:bg-neutral-900/80 backdrop-blur-lg border border-neutral-200 dark:border-neutral-800 rounded-[12px] sm:rounded-[16px] px-3 sm:px-4 py-2.5 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <a href="/" className="flex items-center gap-2 sm:gap-3">
                <img src="/g-note.svg" alt="G-Note" className="w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0 dark:hidden" />
                <img src="/g-note-dark.svg" alt="G-Note" className="w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0 hidden dark:block" />
                <span className="font-semibold text-neutral-900 dark:text-white text-sm sm:text-base">G-Note</span>
              </a>
              <span className="hidden sm:inline text-xs px-2 py-0.5 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-full">
                {t('freeNote.freeMode')}
              </span>
            </div>
            <button
              onClick={handleSavePermanently}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 text-xs sm:text-sm border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-[8px] sm:rounded-[10px] font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex-shrink-0 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">{t('freeNote.savePermanently')}</span>
              <span className="sm:hidden">{t('freeNote.save')}</span>
            </button>
          </div>
        </div>
      </header>


      {/* Main Content */}
      <main className="flex-1 overflow-hidden px-3 sm:px-4 py-3 sm:py-4 safe-x">
        <div className="h-full max-w-4xl mx-auto flex flex-col">
          {/* Warning Banner */}
          {showWarning && (
            <LocalStorageWarning onDismiss={() => setShowWarning(false)} />
          )}
          
          {/* Editor Container */}
          <div 
            className={cn(
              "flex-1 rounded-[12px] sm:rounded-[16px] border border-neutral-200 dark:border-neutral-800 overflow-hidden relative flex flex-col",
              !hasCustomBg && 'bg-white dark:bg-neutral-900'
            )}
            style={getNoteBackgroundStyle(noteStyle)}
          >
            <NoteBackground style={noteStyle} className="rounded-[12px] sm:rounded-[16px]" />
            
            {/* Toolbar */}
            <div 
              ref={toolbarRef}
              className="flex-shrink-0 border-b border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm relative z-20"
            >
              <div className="flex items-center gap-0.5 p-1.5 sm:p-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {/* Undo/Redo */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => editor?.chain().focus().undo().run()}
                      disabled={!editor?.can().undo()}
                      className="p-1.5 sm:p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 transition-colors"
                    >
                      <Undo2 className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t('editor.undo')}</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => editor?.chain().focus().redo().run()}
                      disabled={!editor?.can().redo()}
                      className="p-1.5 sm:p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 transition-colors"
                    >
                      <Redo2 className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t('editor.redo')}</TooltipContent>
                </Tooltip>

                <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700 mx-1" />

                {/* Voice Input */}
                <SpeechButton onTranscript={handleSpeechResult} />

                <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700 mx-1" />

                {/* AI - Locked */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleLockedFeature(t('ai.title'))}
                      className="p-1.5 sm:p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors relative"
                    >
                      <Sparkles className="w-4 h-4" />
                      <Lock className="w-2.5 h-2.5 absolute -top-0.5 -right-0.5 text-neutral-400" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t('ai.title')}</TooltipContent>
                </Tooltip>

                <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700 mx-1" />

                {/* Text Formatting */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => editor?.chain().focus().toggleBold().run()}
                      className={cn(
                        "p-1.5 sm:p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors",
                        editor?.isActive('bold') && 'bg-neutral-200 dark:bg-neutral-700'
                      )}
                    >
                      <Bold className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t('editor.bold')}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => editor?.chain().focus().toggleItalic().run()}
                      className={cn(
                        "p-1.5 sm:p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors",
                        editor?.isActive('italic') && 'bg-neutral-200 dark:bg-neutral-700'
                      )}
                    >
                      <Italic className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t('editor.italic')}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => editor?.chain().focus().toggleUnderline().run()}
                      className={cn(
                        "p-1.5 sm:p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors",
                        editor?.isActive('underline') && 'bg-neutral-200 dark:bg-neutral-700'
                      )}
                    >
                      <UnderlineIcon className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t('editor.underline')}</TooltipContent>
                </Tooltip>

                {toolbarVisibility.strikethrough && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => editor?.chain().focus().toggleStrike().run()}
                        className={cn(
                          "p-1.5 sm:p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors",
                          editor?.isActive('strike') && 'bg-neutral-200 dark:bg-neutral-700'
                        )}
                      >
                        <Strikethrough className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t('editor.strikethrough')}</TooltipContent>
                  </Tooltip>
                )}

                {toolbarVisibility.highlight && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => editor?.chain().focus().toggleHighlight().run()}
                        className={cn(
                          "p-1.5 sm:p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors",
                          editor?.isActive('highlight') && 'bg-neutral-200 dark:bg-neutral-700'
                        )}
                      >
                        <Highlighter className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t('editor.highlight')}</TooltipContent>
                  </Tooltip>
                )}

                {toolbarVisibility.dividerAfterHighlight && (
                  <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700 mx-1" />
                )}

                {/* Headings */}
                {toolbarVisibility.heading1 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                        className={cn(
                          "p-1.5 sm:p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors",
                          editor?.isActive('heading', { level: 1 }) && 'bg-neutral-200 dark:bg-neutral-700'
                        )}
                      >
                        <Heading1 className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t('editor.heading1')}</TooltipContent>
                  </Tooltip>
                )}

                {toolbarVisibility.heading2 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                        className={cn(
                          "p-1.5 sm:p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors",
                          editor?.isActive('heading', { level: 2 }) && 'bg-neutral-200 dark:bg-neutral-700'
                        )}
                      >
                        <Heading2 className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t('editor.heading2')}</TooltipContent>
                  </Tooltip>
                )}

                {toolbarVisibility.heading3 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
                        className={cn(
                          "p-1.5 sm:p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors",
                          editor?.isActive('heading', { level: 3 }) && 'bg-neutral-200 dark:bg-neutral-700'
                        )}
                      >
                        <Heading3 className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t('editor.heading3')}</TooltipContent>
                  </Tooltip>
                )}

                {toolbarVisibility.dividerAfterHeadings && (
                  <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700 mx-1" />
                )}

                {/* Lists */}
                {toolbarVisibility.bulletList && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => editor?.chain().focus().toggleBulletList().run()}
                        className={cn(
                          "p-1.5 sm:p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors",
                          editor?.isActive('bulletList') && 'bg-neutral-200 dark:bg-neutral-700'
                        )}
                      >
                        <List className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t('editor.bulletList')}</TooltipContent>
                  </Tooltip>
                )}

                {toolbarVisibility.orderedList && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                        className={cn(
                          "p-1.5 sm:p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors",
                          editor?.isActive('orderedList') && 'bg-neutral-200 dark:bg-neutral-700'
                        )}
                      >
                        <ListOrdered className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t('editor.numberedList')}</TooltipContent>
                  </Tooltip>
                )}

                {toolbarVisibility.taskList && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => editor?.chain().focus().toggleTaskList().run()}
                        className={cn(
                          "p-1.5 sm:p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors",
                          editor?.isActive('taskList') && 'bg-neutral-200 dark:bg-neutral-700'
                        )}
                      >
                        <CheckSquare className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t('editor.taskList')}</TooltipContent>
                  </Tooltip>
                )}

                {toolbarVisibility.dividerAfterLists && (
                  <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700 mx-1" />
                )}


                {/* Alignment */}
                {toolbarVisibility.alignLeft && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => editor?.chain().focus().setTextAlign('left').run()}
                        className={cn(
                          "p-1.5 sm:p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors",
                          editor?.isActive({ textAlign: 'left' }) && 'bg-neutral-200 dark:bg-neutral-700'
                        )}
                      >
                        <AlignLeft className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t('editor.alignLeft')}</TooltipContent>
                  </Tooltip>
                )}

                {toolbarVisibility.alignCenter && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => editor?.chain().focus().setTextAlign('center').run()}
                        className={cn(
                          "p-1.5 sm:p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors",
                          editor?.isActive({ textAlign: 'center' }) && 'bg-neutral-200 dark:bg-neutral-700'
                        )}
                      >
                        <AlignCenter className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t('editor.alignCenter')}</TooltipContent>
                  </Tooltip>
                )}

                {toolbarVisibility.alignRight && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => editor?.chain().focus().setTextAlign('right').run()}
                        className={cn(
                          "p-1.5 sm:p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors",
                          editor?.isActive({ textAlign: 'right' }) && 'bg-neutral-200 dark:bg-neutral-700'
                        )}
                      >
                        <AlignRight className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t('editor.alignRight')}</TooltipContent>
                  </Tooltip>
                )}

                {toolbarVisibility.alignJustify && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => editor?.chain().focus().setTextAlign('justify').run()}
                        className={cn(
                          "p-1.5 sm:p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors",
                          editor?.isActive({ textAlign: 'justify' }) && 'bg-neutral-200 dark:bg-neutral-700'
                        )}
                      >
                        <AlignJustify className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t('editor.alignJustify')}</TooltipContent>
                  </Tooltip>
                )}

                {toolbarVisibility.dividerAfterAlignment && (
                  <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700 mx-1" />
                )}

                {/* Code */}
                {toolbarVisibility.inlineCode && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => editor?.chain().focus().toggleCode().run()}
                        className={cn(
                          "p-1.5 sm:p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors",
                          editor?.isActive('code') && 'bg-neutral-200 dark:bg-neutral-700'
                        )}
                      >
                        <Code className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t('editor.inlineCode')}</TooltipContent>
                  </Tooltip>
                )}

                {toolbarVisibility.codeBlock && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
                        className={cn(
                          "p-1.5 sm:p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors",
                          editor?.isActive('codeBlock') && 'bg-neutral-200 dark:bg-neutral-700'
                        )}
                      >
                        <Code2 className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t('editor.codeBlock')}</TooltipContent>
                  </Tooltip>
                )}

                {toolbarVisibility.blockquote && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                        className={cn(
                          "p-1.5 sm:p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors",
                          editor?.isActive('blockquote') && 'bg-neutral-200 dark:bg-neutral-700'
                        )}
                      >
                        <Quote className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t('editor.blockquote')}</TooltipContent>
                  </Tooltip>
                )}

                {toolbarVisibility.dividerAfterCode && (
                  <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700 mx-1" />
                )}

                {/* Sub/Superscript */}
                {toolbarVisibility.subscript && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => editor?.chain().focus().toggleSubscript().run()}
                        className={cn(
                          "p-1.5 sm:p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors",
                          editor?.isActive('subscript') && 'bg-neutral-200 dark:bg-neutral-700'
                        )}
                      >
                        <SubscriptIcon className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t('editor.subscript')}</TooltipContent>
                  </Tooltip>
                )}

                {toolbarVisibility.superscript && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => editor?.chain().focus().toggleSuperscript().run()}
                        className={cn(
                          "p-1.5 sm:p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors",
                          editor?.isActive('superscript') && 'bg-neutral-200 dark:bg-neutral-700'
                        )}
                      >
                        <SuperscriptIcon className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t('editor.superscript')}</TooltipContent>
                  </Tooltip>
                )}

                {toolbarVisibility.horizontalRule && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => editor?.chain().focus().setHorizontalRule().run()}
                        className="p-1.5 sm:p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t('editor.horizontalRule')}</TooltipContent>
                  </Tooltip>
                )}

                {toolbarVisibility.dividerAfterSubscript && (
                  <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700 mx-1" />
                )}

                {/* Link */}
                {toolbarVisibility.link && (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setShowLinkDialog(true)}
                          className={cn(
                            "p-1.5 sm:p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors",
                            editor?.isActive('link') && 'bg-neutral-200 dark:bg-neutral-700'
                          )}
                        >
                          <LinkIcon className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{t('editor.insertLink')}</TooltipContent>
                    </Tooltip>

                    {editor?.isActive('link') && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => editor?.chain().focus().unsetLink().run()}
                            className="p-1.5 sm:p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                          >
                            <Unlink className="w-4 h-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{t('editor.removeLink')}</TooltipContent>
                      </Tooltip>
                    )}
                  </>
                )}

                {toolbarVisibility.dividerAfterLink && (
                  <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700 mx-1" />
                )}

                {/* Clear Formatting */}
                {toolbarVisibility.clearFormatting && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()}
                        className="p-1.5 sm:p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      >
                        <RemoveFormatting className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t('editor.clearFormatting')}</TooltipContent>
                  </Tooltip>
                )}

                {/* Image - Always visible */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-1.5 sm:p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <ImagePlus className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t('editor.insertImage')}</TooltipContent>
                </Tooltip>

                {/* Drawing - Always visible */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowDrawingModal(true)}
                      className="p-1.5 sm:p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t('drawing.insert')}</TooltipContent>
                </Tooltip>

                {toolbarVisibility.dividerAfterStyle && (
                  <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700 mx-1" />
                )}

                {/* Style Picker */}
                {toolbarVisibility.style && (
                  <NoteStylePicker
                    style={noteStyle}
                    onChange={setNoteStyle}
                  />
                )}

                {/* Export/Import */}
                {toolbarVisibility.exportImport && editor && (
                  <NoteActionsMenu
                    noteTitle={title || t('freeNote.untitledNote')}
                    noteContent={editor.getHTML()}
                    onImport={(importedTitle, importedContent) => {
                      if (importedTitle) setTitle(importedTitle)
                      if (importedContent) editor.commands.setContent(importedContent)
                    }}
                  />
                )}

                <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700 mx-1" />

                {/* History - Locked */}
                {toolbarVisibility.history && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleLockedFeature(t('versionHistory.title'))}
                        className="p-1.5 sm:p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors relative"
                      >
                        <History className="w-4 h-4" />
                        <Lock className="w-2.5 h-2.5 absolute -top-0.5 -right-0.5 text-neutral-400" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t('versionHistory.title')}</TooltipContent>
                  </Tooltip>
                )}

                {/* Collaboration - Locked */}
                {toolbarVisibility.share && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleLockedFeature(t('share.title'))}
                        className="p-1.5 sm:p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors relative"
                      >
                        <Users className="w-4 h-4" />
                        <Lock className="w-2.5 h-2.5 absolute -top-0.5 -right-0.5 text-neutral-400" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t('share.title')}</TooltipContent>
                  </Tooltip>
                )}

                {/* Reset */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleClear}
                      className="p-1.5 sm:p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t('freeNote.reset')}</TooltipContent>
                </Tooltip>
              </div>
            </div>


            {/* Editor Content */}
            <div 
              ref={editorContainerRef}
              className="flex-1 overflow-y-auto p-4 sm:p-6 relative z-10"
            >
              {/* Title Input */}
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('freeNote.titlePlaceholder')}
                className="w-full text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white bg-transparent border-0 outline-none placeholder:text-neutral-400 mb-4"
              />
              
              {/* Editor with Context Menu */}
              <ContextMenu>
                <ContextMenuTrigger asChild onContextMenu={handleContextMenuOpen}>
                  <div>
                    <EditorContent 
                      editor={editor} 
                      className="min-h-[200px] text-neutral-700 dark:text-neutral-300"
                    />
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onClick={handleCut}>
                    <Scissors className="w-4 h-4 mr-2" />
                    {t('contextMenu.cut')}
                  </ContextMenuItem>
                  <ContextMenuItem onClick={handleCopy}>
                    <Copy className="w-4 h-4 mr-2" />
                    {t('contextMenu.copy')}
                  </ContextMenuItem>
                  <ContextMenuItem onClick={handlePaste}>
                    <ClipboardPaste className="w-4 h-4 mr-2" />
                    {t('contextMenu.paste')}
                  </ContextMenuItem>
                  <ContextMenuItem onClick={handleSelectAll}>
                    <TextSelect className="w-4 h-4 mr-2" />
                    {t('contextMenu.selectAll')}
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            </div>

            {/* Last saved indicator */}
            {lastSaved && (
              <div className="absolute bottom-2 right-2 text-xs text-neutral-400 dark:text-neutral-500 z-10">
                {t('freeNote.lastSaved')}: {lastSaved.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* Drawing Modal */}
      <DrawingModal
        open={showDrawingModal}
        onClose={() => setShowDrawingModal(false)}
        onSave={handleDrawingInsert}
      />

      {/* Link Dialog */}
      <InputDialog
        open={showLinkDialog}
        onClose={() => setShowLinkDialog(false)}
        onConfirm={handleLinkInsert}
        title={t('editor.insertLink')}
        placeholder="https://example.com"
        confirmText={t('common.confirm')}
        cancelText={t('common.cancel')}
      />

      {/* Reset Confirm Dialog */}
      <ConfirmDialog
        open={showResetDialog}
        onClose={() => setShowResetDialog(false)}
        onConfirm={handleConfirmReset}
        title={t('freeNote.resetTitle')}
        description={t('freeNote.resetDescription')}
        confirmText={t('freeNote.resetConfirm')}
        cancelText={t('common.cancel')}
      />

      {/* Locked Feature Modal */}
      <LockedFeatureModal
        open={showLockedModal}
        onClose={() => setShowLockedModal(false)}
        feature={lockedFeature}
      />
    </div>
  )
}
