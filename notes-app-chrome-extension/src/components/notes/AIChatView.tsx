import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import { Markdown } from 'tiptap-markdown'
import Link from '@tiptap/extension-link'
import { 
  X, 
  Send, 
  Mic,
  MessageCircle,
  FileText
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/Tooltip'
import { useAuthStore } from '@/stores/authStore'
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
  })
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

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 100)
    } else {
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

  // Streaming text effect
  const streamText = async (text: string, messageId: string) => {
    setStreamingMessageId(messageId)
    setStreamingContent('')
    
    const words = text.split(' ')
    let currentText = ''
    
    for (let i = 0; i < words.length; i++) {
      currentText += (i === 0 ? '' : ' ') + words[i]
      setStreamingContent(currentText)
      
      // Random delay for natural feel (20-40ms per word)
      await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 20))
    }
    
    // Streaming complete
    setStreamingMessageId(null)
    setStreamingContent('')
  }

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

    // If external handler provided, use it (it will handle adding messages)
    if (onSendMessage) {
      await onSendMessage(userMessage.content, async (messageId, content) => {
        // Stream callback from parent
        await streamText(content, messageId)
      })
      return
    }

    // Otherwise handle internally - add user message and get AI response
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    try {
      // Call AI with note content as context
      const response = await AI.askAI(noteContent, userMessage.content)
      
      const aiMessage: AIChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      }

      // Add message to list first (with empty content for streaming)
      setMessages(prev => [...prev, { ...aiMessage, content: '' }])
      setIsLoading(false)
      
      // Stream the text
      await streamText(response, aiMessage.id)
      
      // Update with final content
      setMessages(prev => prev.map(m => 
        m.id === aiMessage.id ? aiMessage : m
      ))
    } catch (error) {
      console.error('AI error:', error)
      setIsLoading(false)
      
      if (error instanceof InsufficientCreditsError) {
        onInsufficientCredits?.()
      } else {
        // Show error message
        const errorMessage: AIChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: t('ai.error'),
          timestamp: Date.now()
        }
        setMessages(prev => [...prev, errorMessage])
      }
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

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-neutral-950 flex flex-col">
      {/* Close button - floating */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-lg text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
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
          <div className="max-w-3xl mx-auto space-y-4 pt-12">
            {messages.map((message) => (
              <MessageBubble 
                key={message.id} 
                message={message}
                isStreaming={streamingMessageId === message.id}
                streamingContent={streamingMessageId === message.id ? streamingContent : undefined}
              />
            ))}
            {loading && (
              <div className="w-full py-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-neutral-400 dark:bg-neutral-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-neutral-400 dark:bg-neutral-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-neutral-400 dark:bg-neutral-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area - Prompt style */}
      <div className="p-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="bg-neutral-100 dark:bg-neutral-900 rounded-2xl overflow-hidden">
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
                        : 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100'
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
    </div>
  )
}

// Message bubble component
function MessageBubble({ message, isStreaming, streamingContent }: { 
  message: AIChatMessage
  isStreaming?: boolean
  streamingContent?: string
}) {
  const isUser = message.role === 'user'

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
    <div className="w-full">
      <EditorContent 
        editor={editor} 
        className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-p:leading-relaxed prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-headings:mt-4 prose-headings:mb-2 prose-headings:text-neutral-800 dark:prose-headings:text-neutral-200 prose-code:bg-neutral-200 dark:prose-code:bg-neutral-700 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:my-3 prose-pre:bg-neutral-200 dark:prose-pre:bg-neutral-700 text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed"
      />
      {isStreaming && (
        <span className="inline-block w-1 h-4 bg-neutral-900 dark:bg-white ml-0.5 animate-pulse" />
      )}
    </div>
  )
}
