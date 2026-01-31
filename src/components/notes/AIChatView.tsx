import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import { Markdown } from 'tiptap-markdown'
import Link from '@tiptap/extension-link'
import {
  Send,
  Mic,
  MessageCircle,
  FileText,
  X,
  Copy,
  RotateCw,
  Check
} from 'lucide-react'
import { Table } from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/Tooltip'
import { useAuthStore } from '@/stores/authStore'
import { useEdgeSwipeBack, EdgeSwipeIndicator } from '@/hooks/useEdgeSwipeBack'
import { useHistoryBack } from '@/hooks/useHistoryBack'
import * as AI from '@/lib/ai'
import { InsufficientCreditsError } from '@/lib/ai'
import type { AIChatMessage } from '@/types'

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

interface AIChatViewProps {
  open: boolean
  onClose: () => void
  noteContent: string
  contextText?: string
  onClearContext?: () => void
  initialMessages?: AIChatMessage[]
  onSendMessage?: (question: string, onStream?: (messageId: string, content: string) => void) => Promise<void>
  isLoading?: boolean
  onInsufficientCredits?: () => void
}

// Read-only Tiptap extensions for rendering AI responses
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
    name: 'link-readonly' // Unique name to avoid conflicts
  }),
  Table.configure({
    resizable: true,
  }),
  TableRow,
  TableHeader,
  TableCell,
]

export function AIChatView({ open, onClose, noteContent, contextText, onClearContext, initialMessages = [], onSendMessage, isLoading: externalLoading, onInsufficientCredits }: AIChatViewProps) {
  const { t, i18n } = useTranslation()
  const { user } = useAuthStore()
  const [messages, setMessages] = useState<AIChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [streamingContent, setStreamingContent] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  // Edge swipe back gesture
  const {
    handlers: edgeSwipeHandlers,
    swipeStyle: edgeSwipeStyle,
    swipeState: edgeSwipeState,
    progress: edgeSwipeProgress
  } = useEdgeSwipeBack({
    onSwipeBack: onClose,
    edgeWidth: 25,
    threshold: 100,
    enabled: open
  })

  // History back support for system back gesture (Android swipe, browser back button)
  useHistoryBack({
    isOpen: open,
    onBack: onClose,
    stateKey: 'ai-chat-view'
  })

  // Check if speech recognition is supported
  const isSpeechSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  // Sync with external messages
  useEffect(() => {
    if (initialMessages.length > 0) {
      setMessages(initialMessages)
    }
  }, [initialMessages])

  // Use external loading state if provided
  const loading = externalLoading !== undefined ? externalLoading : isLoading

  // Auto-scroll to bottom when new messages arrive or streaming
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, loading, streamingContent])

  // Additional auto-scroll during streaming for smoother experience
  useEffect(() => {
    if (streamingContent && messagesEndRef.current) {
      const scrollContainer = messagesEndRef.current.parentElement
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [streamingContent])

  // Focus input when opened - DISABLED to prevent keyboard auto-open on mobile
  useEffect(() => {
    if (!open) {
      // Don't clear messages - keep history
      setInput('')
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
  }, [input])

  // Batch streaming logic
  const streamingBufferRef = useRef('')
  const lastFlushedLengthRef = useRef(0)
  const flushIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Start flushing buffer to state at regular intervals
  const startFlushing = () => {
    if (flushIntervalRef.current) return

    flushIntervalRef.current = setInterval(() => {
      const buffer = streamingBufferRef.current
      const lastLength = lastFlushedLengthRef.current

      if (buffer.length > lastLength) {
        // Update state with current full text
        setStreamingContent(buffer)
        lastFlushedLengthRef.current = buffer.length
      }
    }, 50) // 50ms batch update = 20fps, smooth enough but much less react work than per-char
  }

  const stopFlushing = () => {
    if (flushIntervalRef.current) {
      clearInterval(flushIntervalRef.current)
      flushIntervalRef.current = null
    }
    // Final flush
    if (streamingBufferRef.current !== streamingContent) {
      setStreamingContent(streamingBufferRef.current)
    }
  }

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (flushIntervalRef.current) clearInterval(flushIntervalRef.current)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage: AIChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    }

    setInput('')
    setIsLoading(true)

    // Reset streaming state
    setStreamingMessageId(null)
    setStreamingContent('')
    streamingBufferRef.current = ''
    lastFlushedLengthRef.current = 0

    // If external handler provided, use it
    if (onSendMessage) {
      // NOTE: External handler needs to support the new streaming callback signature if we want it to stream
      // For now, we assume onSendMessage might be updated or we handle the stream inside the callback wrapper
      // But based on the code, onSendMessage is likely just a prop from parent.
      // If the parent hasn't been updated to stream, this might not work as expected.
      // However, we are "Implementing Frontend Changes".
      // Let's assume onSendMessage is LEGACY or we wrap it.
      // Actually, looking at the code, onSendMessage is optional.
      // If it exists, we await it.
      await onSendMessage(userMessage.content, async (messageId, content) => {
        // This callback is for "fake streaming" from parent. 
        // If we want real streaming, we should probably ignore this or deprecate it.
        // But let's keep it compatible:
        setStreamingMessageId(messageId)
        streamingBufferRef.current = content // "Jump" to content if parent provides it
        setStreamingContent(content)
      })
      return
    }

    // Default internal handler
    setMessages(prev => [...prev, userMessage])

    const aiMessageId = (Date.now() + 1).toString()
    const aiMessage: AIChatMessage = {
      id: aiMessageId,
      role: 'assistant',
      content: '', // Start empty
      timestamp: Date.now()
    }

    // Add placeholder message
    setMessages(prev => [...prev, aiMessage])

    // Start streaming mode
    setStreamingMessageId(aiMessageId)
    startFlushing()

    try {
      // Use the new streaming API
      const finalContent = await AI.askAIStream(
        noteContent,
        userMessage.content,
        (chunk) => {
          // Add chunk to buffer
          streamingBufferRef.current += chunk
          // The interval will pick it up
        }
      )

      stopFlushing()
      setStreamingMessageId(null)
      setIsLoading(false)

      // Update message with final content
      setMessages(prev => prev.map(m =>
        m.id === aiMessageId ? { ...m, content: finalContent } : m
      ))
    } catch (error) {
      stopFlushing()
      setStreamingMessageId(null)
      setIsLoading(false)
      console.error('AI error:', error)

      if (error instanceof InsufficientCreditsError) {
        onInsufficientCredits?.()
        // Remove the failed message
        setMessages(prev => prev.filter(m => m.id !== aiMessageId))
      } else {
        // Show error message
        const errorMessage: AIChatMessage = {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: t('ai.error'),
          timestamp: Date.now()
        }
        setMessages(prev => prev.map(m =>
          m.id === aiMessageId ? errorMessage : m
        ))
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleRegenerate = async (messageId: string) => {
    if (loading) return

    // Find the message index
    const messageIndex = messages.findIndex(m => m.id === messageId)
    if (messageIndex === -1) return

    // Find the previous user message
    const previousMessage = messages[messageIndex - 1]
    if (!previousMessage || previousMessage.role !== 'user') return

    // Remove the current AI message
    const newMessages = messages.filter(m => m.id !== messageId)
    setMessages(newMessages)

    // Set loading state
    setIsLoading(true)

    // Create a new AI message placeholder
    const aiMessageId = (Date.now() + 1).toString()
    const aiMessage: AIChatMessage = {
      id: aiMessageId,
      role: 'assistant',
      content: '', // Start empty
      timestamp: Date.now()
    }

    setMessages([...newMessages, aiMessage])

    // Trigger streaming
    setStreamingMessageId(aiMessageId)
    startFlushing()

    try {
      const finalContent = await AI.askAIStream(
        noteContent,
        previousMessage.content,
        (chunk) => {
          streamingBufferRef.current += chunk
        }
      )

      stopFlushing()
      setStreamingMessageId(null)
      setIsLoading(false)

      // Update message with final content
      setMessages(prev => prev.map(m =>
        m.id === aiMessageId ? { ...m, content: finalContent } : m
      ))
    } catch (error) {
      stopFlushing()
      setStreamingMessageId(null)
      setIsLoading(false)

      if (error instanceof InsufficientCreditsError) {
        onInsufficientCredits?.()
        setMessages(prev => prev.filter(m => m.id !== aiMessageId))
      } else {
        const errorMessage: AIChatMessage = {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: t('ai.error'),
          timestamp: Date.now()
        }
        setMessages(prev => prev.map(m =>
          m.id === aiMessageId ? errorMessage : m
        ))
      }
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
      setInput(transcript)
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

  // Get user's first name
  const userName = user?.name?.split(' ')[0] || 'there'

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-white dark:bg-neutral-950 flex flex-col status-bar-bg"
      style={edgeSwipeState.isDragging ? edgeSwipeStyle : undefined}
      {...edgeSwipeHandlers}
    >
      {/* Edge swipe indicator */}
      <EdgeSwipeIndicator
        progress={edgeSwipeProgress}
        isActive={edgeSwipeState.isDragging && edgeSwipeState.startedFromEdge}
      />

      {/* Close button - X icon with border at top right */}
      <button
        onClick={onClose}
        className="absolute z-[60] p-1.5 rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors top-4 right-4"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Messages Area - with proper padding to prevent text cutoff */}
      <div
        className="flex-1 overflow-y-auto px-4 pt-14 pb-4 safe-top"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <MessageCircle className="w-16 h-16 text-neutral-400 dark:text-neutral-600 mb-4" strokeWidth={1.5} />
            <h3 className="text-2xl font-semibold text-neutral-900 dark:text-white mb-2">
              {t('ai.chatWelcome')}, {userName}!
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md">
              {t('ai.chatDescription')}
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((message, index) => (
              <MessageBubble
                key={message.id}
                message={message}
                isStreaming={streamingMessageId === message.id}
                streamingContent={streamingMessageId === message.id ? streamingContent : undefined}
                onRegenerate={handleRegenerate}
                isLast={index === messages.length - 1}
              />
            ))}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area - Prompt style with border and safe area */}
      <div className="pt-4 px-4 pb-4 safe-bottom">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl overflow-hidden shadow-sm">
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
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={contextText ? t('ai.askAboutSelection') : t('ai.askPlaceholder')}
              rows={1}
              className="w-full resize-none bg-transparent px-4 py-3 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 focus:outline-none"
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />

            {/* Toolbar */}
            <div className="flex items-center justify-between px-3 pb-3">
              {/* Left side tools */}
              <div className="flex items-center gap-1">
                {/* Voice Input */}
                {isSpeechSupported && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={toggleVoiceInput}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg transition-colors',
                          isListening
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                            : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
                        )}
                      >
                        {isListening ? (
                          <>
                            <span className="relative flex h-4 w-4 items-center justify-center">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                              <Mic className="relative w-3.5 h-3.5" />
                            </span>
                            <span className="hidden sm:inline">{t('speech.stop')}</span>
                          </>
                        ) : (
                          <>
                            <Mic className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{t('speech.start')}</span>
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

              {/* Right side - Submit button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="submit"
                    disabled={!input.trim() || loading}
                    className={cn(
                      'p-2 rounded-xl transition-colors',
                      !input.trim() || loading
                        ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-600 cursor-not-allowed'
                        : 'border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    )}
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{loading ? t('ai.processing') : t('ai.send')}</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

// Message bubble component
function MessageBubble({ message, isStreaming, streamingContent, onRegenerate, isLast }: {
  message: AIChatMessage
  isStreaming?: boolean
  streamingContent?: string
  onRegenerate?: (id: string) => void
  isLast?: boolean
}) {
  const isUser = message.role === 'user'
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  // For AI messages, use Tiptap editor for rich formatting - full width, no bubble
  const editor = useEditor({
    extensions: readOnlyExtensions,
    content: isStreaming ? streamingContent || '' : message.content,
    editable: false,
    editorProps: {
      attributes: {
        class: 'focus:outline-none'
      }
    }
  }, [message.content, isStreaming, streamingContent])

  // Update editor content when streaming
  useEffect(() => {
    if (editor && isStreaming && streamingContent) {
      editor.commands.setContent(streamingContent)
    }
  }, [editor, isStreaming, streamingContent])

  const handleCopy = () => {
    if (editor) {
      // Get plain text to avoid markdown syntax
      const text = editor.getText()
      navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-2xl rounded-tr-sm px-4 py-3">
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    )
  }

  // AI message - full width, no bubble
  return (
    <div className="w-full group">
      {isStreaming && !editor?.getText() ? (
        <div className="flex gap-1 py-1">
          <div className="w-2 h-2 bg-neutral-400 dark:bg-neutral-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-neutral-400 dark:bg-neutral-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-neutral-400 dark:bg-neutral-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      ) : (
        <>
          <EditorContent
            editor={editor}
            className="ai-chat-response prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-p:leading-relaxed prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-headings:mt-4 prose-headings:mb-2 prose-headings:text-neutral-800 dark:prose-headings:text-neutral-200 prose-code:bg-neutral-200 dark:prose-code:bg-neutral-700 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:my-3 prose-pre:bg-neutral-200 dark:prose-pre:bg-neutral-700 text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed"
          />

          {/* Action buttons (Copy, Regenerate) */}
          {!isStreaming && (
            <div className="flex items-center gap-2 mt-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleCopy}
                    className="p-1.5 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{copied ? t('common.copied') : t('common.copy')}</TooltipContent>
              </Tooltip>

              {onRegenerate && isLast && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onRegenerate(message.id)}
                      className="p-1.5 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t('ai.regenerate')}</TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
