import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import * as Popover from '@radix-ui/react-popover'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import { Markdown } from 'tiptap-markdown'
import Link from '@tiptap/extension-link'
import { 
  Sparkles, 
  FileText, 
  PenLine, 
  Wand2, 
  Languages, 
  ListTodo, 
  MessageCircleQuestion,
  Send,
  X,
  Copy,
  Scissors,
  Coins,
  Mic
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/Tooltip'
import { CircleFlag } from '@/components/ui/CircleFlag'
import * as AI from '@/lib/ai'

// Type declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: ((event: Event) => void) | null
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance
    webkitSpeechRecognition: new () => SpeechRecognitionInstance
  }
}

interface AIMenuProps {
  onAction: (action: AI.AIAction, extra?: string) => void
  disabled?: boolean
}

export function AIMenu({ onAction, disabled }: AIMenuProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [showLanguages, setShowLanguages] = useState(false)

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setShowLanguages(false)
    }
    setOpen(newOpen)
  }

  const handleAction = (action: AI.AIAction) => {
    if (action === 'translate') {
      setShowLanguages(true)
      return
    }
    setOpen(false)
    onAction(action)
  }

  const handleTranslate = (langName: string) => {
    setShowLanguages(false)
    setOpen(false)
    onAction('translate', langName)
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                disabled={disabled}
                className={cn(
                  'p-1.5 rounded-full text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors touch-manipulation',
                  disabled && 'opacity-40 cursor-not-allowed',
                  open && 'bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-white'
                )}
              >
                <Sparkles className="w-[18px] h-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">AI</TooltipContent>
          </Tooltip>
        </span>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="z-50 bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 animate-in fade-in zoom-in-95 duration-200"
          sideOffset={5}
          align="start"
        >
          {/* Main menu - hide on mobile when showing languages */}
          <div className={cn(
            "min-w-[180px] p-1",
            showLanguages && "hidden sm:block"
          )}>
            <MenuItem icon={FileText} label={t('ai.summarize')} onClick={() => handleAction('summarize')} />
            <MenuItem icon={PenLine} label={t('ai.continue')} onClick={() => handleAction('continue')} />
            <MenuItem icon={Wand2} label={t('ai.improve')} onClick={() => handleAction('improve')} />
            <MenuItem 
              icon={Languages} 
              label={t('ai.translate')} 
              onClick={() => handleAction('translate')} 
              hasSubmenu 
              active={showLanguages}
            />
            <MenuItem icon={ListTodo} label={t('ai.extractTasks')} onClick={() => handleAction('extract-tasks')} />
            <MenuItem icon={MessageCircleQuestion} label={t('ai.ask')} onClick={() => handleAction('ask')} />
          </div>

          {/* Language submenu - inline on mobile, side popup on desktop */}
          {showLanguages && (
            <>
              {/* Mobile: inline replacement */}
              <div className="sm:hidden w-[160px] flex flex-col overflow-hidden">
                {/* Back button */}
                <button
                  onClick={() => setShowLanguages(false)}
                  className="flex items-center gap-2 px-2.5 py-1.5 text-[13px] text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg mb-0.5"
                >
                  <span>‹</span>
                  {t('ai.translate')}
                </button>
                
                {/* Language list */}
                <div className="max-h-[220px] overflow-y-auto p-1 pt-0">
                  {AI.LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => handleTranslate(lang.name)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-[13px] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                    >
                      <CircleFlag countryCode={lang.countryCode} size={16} className="flex-shrink-0" />
                      <span className="truncate">{lang.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Desktop: side popup */}
              <div 
                className="hidden sm:flex absolute left-full top-0 ml-1 w-[160px] bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 animate-in fade-in zoom-in-95 duration-200 flex-col overflow-hidden"
                style={{ maxHeight: '240px' }}
              >
                {/* Language list */}
                <div className="flex-1 overflow-y-auto p-1">
                  {AI.LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => handleTranslate(lang.name)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-[13px] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                    >
                      <CircleFlag countryCode={lang.countryCode} size={16} className="flex-shrink-0" />
                      <span className="truncate">{lang.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function MenuItem({ 
  icon: Icon, 
  label, 
  onClick, 
  hasSubmenu,
  active
}: { 
  icon: React.ElementType
  label: string
  onClick: () => void
  hasSubmenu?: boolean
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors touch-manipulation",
        active && "bg-neutral-100 dark:bg-neutral-700"
      )}
    >
      <span className="flex items-center gap-2">
        <Icon className="w-4 h-4" />
        {label}
      </span>
      {hasSubmenu && <span className="text-neutral-400 text-xs">▸</span>}
    </button>
  )
}

// Ask AI Input overlay
interface AskAIInputProps {
  open: boolean
  onSubmit: (question: string) => void
  contextText?: string
  onClearContext?: () => void
  isLoading?: boolean
}

export function AskAIInput({ open, onSubmit, contextText, onClearContext, isLoading }: AskAIInputProps) {
  const { t, i18n } = useTranslation()
  const [question, setQuestion] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  // Check if speech recognition is supported
  const isSpeechSupported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 50)
    } else {
      setQuestion('')
      // Stop listening when closed
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        setIsListening(false)
      }
    }
  }, [open])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [question])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (question.trim() && !isLoading) {
      onSubmit(question.trim())
      setQuestion('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const toggleVoiceInput = () => {
    if (!isSpeechSupported) return

    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition

    recognition.lang = i18n.language
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('')
      setQuestion(transcript)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognition.onerror = () => {
      setIsListening(false)
    }

    recognition.start()
    setIsListening(true)
  }

  if (!open) return null

  const status = isLoading ? 'streaming' : 'ready'

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 px-2 flex flex-col items-center gap-1">
      {/* Prompt input */}
      <div className="w-full max-w-xl bg-neutral-100 dark:bg-neutral-800 backdrop-blur-md rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
        <form onSubmit={handleSubmit} className="flex flex-col">
          {/* Context text attachment - shown above textarea */}
          {contextText && (
            <div className="px-4 pt-3">
              <div className="inline-flex items-center gap-2 max-w-full px-3 py-2 rounded-xl bg-neutral-200/50 dark:bg-neutral-700/50">
                <FileText className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 flex-shrink-0" />
                <span className="text-xs text-neutral-700 dark:text-neutral-300 truncate max-w-[280px]">
                  {contextText.length > 50 ? contextText.slice(0, 50) + '...' : contextText}
                </span>
                <button
                  type="button"
                  onClick={onClearContext}
                  className="p-1 rounded-full text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600 flex-shrink-0 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
          
          {/* Textarea */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={contextText ? t('ai.askAboutSelection') : t('ai.askPlaceholder')}
              rows={1}
              className="w-full resize-none bg-transparent px-4 py-3 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 focus:outline-none"
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between gap-2 px-3 pb-3">
            {/* Tools */}
            <div className="flex items-center gap-1">
              {/* Voice Input Button */}
              {isSpeechSupported && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={toggleVoiceInput}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-lg transition-colors',
                        isListening
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                          : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                      )}
                    >
                      {isListening ? (
                        <>
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                          </span>
                          <span className="text-xs">{t('speech.stop')}</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-4 h-4" />
                          <span className="text-xs hidden sm:inline">{t('speech.start')}</span>
                        </>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isListening ? t('speech.stop') : t('speech.start')}
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Submit Button */}
          <PromptSubmitButton 
            disabled={!question.trim() || !!isLoading} 
            status={status} 
          />
        </div>
      </form>
    </div>
  </div>
  )
}

// Submit button with spinning loading state
function PromptSubmitButton({ 
  disabled, 
  status 
}: { 
  disabled: boolean
  status: 'ready' | 'streaming' | 'submitted' | 'error'
}) {
  const { t } = useTranslation()
  const isLoading = status === 'streaming' || status === 'submitted'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="submit"
          disabled={disabled}
          className={cn(
            'p-2 rounded-lg transition-colors',
            disabled
              ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
              : 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100'
          )}
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>{isLoading ? t('ai.processing') : t('ai.ask')}</TooltipContent>
    </Tooltip>
  )
}

// Selection toolbar (appears when text is selected)
interface SelectionToolbarProps {
  position: { top: number; left: number; bottom: number; viewportTop: number } | null
  onCopy: () => void
  onCut: () => void
  onAskAI: () => void
}

export function SelectionToolbar({ position, onCopy, onCut, onAskAI }: SelectionToolbarProps) {
  const { t } = useTranslation()
  if (!position) return null

  const toolbarHeight = 44 // approximate height of toolbar
  const minTopSpace = 60 // minimum space needed above selection
  
  // Show below selection if not enough space above
  const showBelow = position.viewportTop < minTopSpace
  const topPosition = showBelow 
    ? position.bottom + 10 
    : position.top - toolbarHeight - 8

  return (
    <div
      className="fixed z-50 flex items-center gap-0.5 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 p-1 animate-in fade-in zoom-in-95 duration-200"
      style={{ top: topPosition, left: position.left }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onCopy}
            className="p-1.5 rounded-md text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 touch-manipulation"
          >
            <Copy className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{t('ai.copy')}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onCut}
            className="p-1.5 rounded-md text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 touch-manipulation"
          >
            <Scissors className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{t('ai.cut')}</TooltipContent>
      </Tooltip>
      <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-700 mx-0.5" />
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onAskAI}
            className="p-1.5 rounded-md text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 touch-manipulation"
          >
            <Sparkles className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{t('ai.ask')}</TooltipContent>
      </Tooltip>
    </div>
  )
}

// Tiptap extensions for read-only display
const readOnlyExtensions = [
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
  Markdown.configure({
    html: true,
    transformPastedText: false,
    transformCopiedText: false,
    linkify: true,
    breaks: true
  }),
  Link.configure({
    openOnClick: true,
    HTMLAttributes: {
      class: 'text-blue-500 underline cursor-pointer'
    }
  }).extend({
    name: 'link-aimenu' // Unique name to avoid conflicts
  })
]

// Summary modal - Siri-style glassmorphism design with Tiptap
interface SummaryModalProps {
  open: boolean
  content: string
  onClose: () => void
}

export function SummaryModal({ open, content, onClose }: SummaryModalProps) {
  const { t } = useTranslation()
  
  const editor = useEditor({
    extensions: readOnlyExtensions,
    content: '',
    editable: false,
    editorProps: {
      attributes: {
        class: 'focus:outline-none'
      }
    }
  })

  // Update content when it changes
  useEffect(() => {
    if (editor && content) {
      editor.commands.setContent(content)
    }
  }, [editor, content])

  if (!open) return null

  return (
    <div className="absolute inset-x-0 bottom-full mb-2 px-4 z-20 flex justify-center">
      <div className="w-full max-w-lg max-h-[35vh] overflow-y-auto scrollbar-none bg-neutral-100 dark:bg-neutral-800 backdrop-blur-md rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 animate-in fade-in slide-in-from-bottom-2 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-neutral-200 dark:bg-neutral-700">
              <FileText className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
            </div>
            <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              {t('ai.summary')}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Content - Tiptap editor */}
        <div className="selectable px-4 pb-4 text-sm text-neutral-700 dark:text-neutral-300">
          <EditorContent 
            editor={editor} 
            className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-headings:text-neutral-800 dark:prose-headings:text-neutral-200 prose-code:bg-neutral-200 dark:prose-code:bg-neutral-700 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-neutral-200 dark:prose-pre:bg-neutral-700"
          />
        </div>
      </div>
    </div>
  )
}

// AI Answer modal - Glassmorphism design with Tiptap
interface AIAnswerModalProps {
  open: boolean
  answer: string
  onClose: () => void
}

export function AIAnswerModal({ open, answer, onClose }: AIAnswerModalProps) {
  const editor = useEditor({
    extensions: readOnlyExtensions,
    content: '',
    editable: false,
    editorProps: {
      attributes: {
        class: 'focus:outline-none'
      }
    }
  })

  // Update content when answer changes
  useEffect(() => {
    if (editor && answer) {
      editor.commands.setContent(answer)
    }
  }, [editor, answer])

  if (!open) return null

  return (
    <>
      {/* Backdrop - click to close */}
      <div 
        className="fixed inset-0 z-25 bg-black/20 dark:bg-black/40 animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Modal content */}
      <div className="absolute inset-x-0 bottom-full mb-2 px-4 z-30 flex justify-center pointer-events-none">
        <div 
          className="w-full max-w-lg max-h-[35vh] overflow-y-auto scrollbar-none bg-neutral-100 dark:bg-neutral-800 backdrop-blur-md rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 animate-in fade-in slide-in-from-bottom-2 duration-200 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Content only - no header */}
          <div className="selectable px-4 py-4 text-sm text-neutral-700 dark:text-neutral-300">
            <EditorContent 
              editor={editor} 
              className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-headings:text-neutral-800 dark:prose-headings:text-neutral-200 prose-code:bg-neutral-200 dark:prose-code:bg-neutral-700 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-neutral-200 dark:prose-pre:bg-neutral-700"
            />
          </div>
        </div>
      </div>
    </>
  )
}

// Insufficient Credits Modal - Glassmorphism design
interface InsufficientCreditsModalProps {
  open: boolean
  onClose: () => void
  onBuyCredits: () => void
}

export function InsufficientCreditsModal({ open, onClose, onBuyCredits }: InsufficientCreditsModalProps) {
  const { t } = useTranslation()
  if (!open) return null

  return (
    <div className="absolute inset-x-0 bottom-full mb-2 px-4 z-20 flex justify-center">
      <div className="w-auto max-w-sm bg-neutral-100 dark:bg-neutral-800 backdrop-blur-md rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="flex items-center gap-3 p-4">
          <div className="p-2.5 rounded-xl bg-neutral-200 dark:bg-neutral-700">
            <Coins className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
          </div>
          <p className="text-sm text-neutral-700 dark:text-neutral-300 flex-1">
            {t('credits.insufficientCredits')}
          </p>
          <button
            onClick={() => {
              onBuyCredits()
              onClose()
            }}
            className="px-4 py-2 text-sm font-medium bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
          >
            {t('credits.buyMore')}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}


