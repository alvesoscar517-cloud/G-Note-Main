import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useDebouncedCallback } from 'use-debounce'
import { useTranslation } from 'react-i18next'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { ResizableImage } from './ResizableImageExtension'
import { DrawingModal } from './DrawingModal'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import { Markdown } from 'tiptap-markdown'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import TextAlign from '@tiptap/extension-text-align'
import Link from '@tiptap/extension-link'
import { marked } from 'marked'
import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import { Collaboration } from '@/lib/collaboration'
import {
  Undo2, 
  Redo2,
  Bold,
  Italic,
  List,
  ListOrdered,
  CheckSquare,
  Strikethrough,
  Pin,
  PinOff,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Pencil,
  Trash2,
  Share2,
  Users,
  History,
  Maximize2,
  Minimize2,
  Copy,
  Scissors,
  ClipboardPaste,
  TextSelect,
  Sparkles,
  Underline as UnderlineIcon,
  Highlighter,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Code,
  Code2,
  Quote,
  Minus,
  Link as LinkIcon,
  Unlink,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  RemoveFormatting,
  ArrowLeft
} from 'lucide-react'
import { useNotesStore } from '@/stores/notesStore'
import { useAuthStore } from '@/stores/authStore'
import { useNetworkStore, NetworkRequiredError } from '@/stores/networkStore'
import { cn } from '@/lib/utils'
import { ConfirmDialog, InputDialog } from '@/components/ui/Dialog'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/Tooltip'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/ContextMenu'
import { ShareDialog } from './ShareDialog'
import { VersionHistoryPanel } from './VersionHistoryPanel'
import { NoteStylePicker } from './NoteStylePicker'
import { NoteActionsMenu } from './NoteActionsMenu'
import { generateUserColor } from '@/lib/collaboration'
import { AIMenu, SummaryModal, InsufficientCreditsModal } from './AIMenu'
import { AIChatView } from './AIChatView'
import { SpeechButton } from './SpeechButton'
import { EditorSkeleton } from '@/components/ui/Skeleton'
import { useNetworkRequiredOverlay } from '@/components/ui/OfflineIndicator'
import * as AI from '@/lib/ai'
import { InsufficientCreditsError } from '@/lib/ai'
import type { Note, NoteStyle, AIChatMessage } from '@/types'

// Remove duplicate Message type - use AIChatMessage from types

// Editable title component with ellipsis support
function EditableTitle({ 
  value, 
  onChange, 
  placeholder,
  className 
}: { 
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
}) {
  const [isEditing, setIsEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setIsEditing(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Escape') {
            setIsEditing(false)
          }
        }}
        placeholder={placeholder}
        className={cn(
          'w-full bg-transparent border-0 outline-none',
          className
        )}
      />
    )
  }

  // Normalize text: collapse multiple spaces and trim
  const displayValue = value?.replace(/\s+/g, ' ').trimEnd() || placeholder

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={cn(
        'overflow-hidden cursor-text',
        !value && 'text-neutral-400',
        className
      )}
      style={{
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        wordBreak: 'break-all'
      }}
      title={value || placeholder}
    >
      {displayValue}
    </div>
  )
}

interface NoteEditorProps {
  note: Note
  onClose: () => void
  onTogglePin: () => void
  isPinned: boolean
  isFullscreen?: boolean
  canToggleFullscreen?: boolean
  onToggleFullscreen?: () => void
}

interface CollaboratorInfo {
  name: string
  color: string
}

export function NoteEditor({ note, onClose, onTogglePin, isPinned, isFullscreen, canToggleFullscreen = true, onToggleFullscreen }: NoteEditorProps) {
  const { t } = useTranslation()
  const { updateNote, deleteNote } = useNotesStore()
  const { user } = useAuthStore()
  const isOnline = useNetworkStore(state => state.isOnline)
  
  // Network required overlay for offline handling
  const { showOverlay: showNetworkOverlay, OverlayComponent: NetworkOverlay } = useNetworkRequiredOverlay()
  
  // Track note ID to detect when note changes
  const currentNoteIdRef = useRef(note.id)
  const isFirstRender = useRef(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [roomId, setRoomId] = useState<string | null>(null)
  const [isRoomHost, setIsRoomHost] = useState(false) // Track if user created the room (host) or joined (guest)
  const [collaborators, setCollaborators] = useState<CollaboratorInfo[]>([])
  const [userColor] = useState(() => generateUserColor())
  
  // AI states
  const [isAILoading, setIsAILoading] = useState(false) // For actions that modify editor
  const [isAskAILoading, setIsAskAILoading] = useState(false) // For ask AI only
  const [isStreaming, setIsStreaming] = useState(false)
  const [showAIChatView, setShowAIChatView] = useState(false) // Fullscreen chat view
  const [chatMessages, setChatMessages] = useState<AIChatMessage[]>(note.aiChatHistory || []) // Chat history from note
  const [showSummary, setShowSummary] = useState(false)
  const [summaryContent, setSummaryContent] = useState('')
  const [selectedText, setSelectedText] = useState('') // Text currently highlighted
  const [aiContextText, setAiContextText] = useState('') // Text to use for AI query
  const [aiError, setAiError] = useState<string | null>(null)
  const [showCreditsError, setShowCreditsError] = useState(false)
  const [showDrawingModal, setShowDrawingModal] = useState(false)
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const editorContainerRef = useRef<HTMLDivElement>(null)

  // Clear AI error after 5 seconds
  useEffect(() => {
    if (aiError) {
      const timer = setTimeout(() => setAiError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [aiError])

  // Sync chat history when note changes
  useEffect(() => {
    // Load chat history from note
    setChatMessages(note.aiChatHistory || [])
  }, [note.id])

  // Save chat history to note when messages change
  useEffect(() => {
    if (chatMessages.length > 0 && note.id) {
      // Only save if different from current note's history
      const currentHistory = note.aiChatHistory || []
      if (JSON.stringify(chatMessages) !== JSON.stringify(currentHistory)) {
        // Debounce to avoid too many updates
        const timer = setTimeout(() => {
          updateNote(note.id, { aiChatHistory: chatMessages })
        }, 500)
        return () => clearTimeout(timer)
      }
    }
  }, [chatMessages, note.id, note.aiChatHistory, updateNote])
  
  // WebRTC provider and Y.Doc for collaboration
  const [provider, setProvider] = useState<WebrtcProvider | null>(null)
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null)
  const [isProviderReady, setIsProviderReady] = useState(false)
  
  // Use refs to track current provider/ydoc for cleanup
  const providerRef = useRef<WebrtcProvider | null>(null)
  const ydocRef = useRef<Y.Doc | null>(null)

  // Setup collaboration when roomId changes
  useEffect(() => {
    // Cleanup previous provider/ydoc if exists
    if (providerRef.current) {
      providerRef.current.disconnect()
      providerRef.current.destroy()
      providerRef.current = null
    }
    if (ydocRef.current) {
      ydocRef.current.destroy()
      ydocRef.current = null
    }
    
    if (!roomId) {
      setProvider(null)
      setYdoc(null)
      setIsProviderReady(false)
      return
    }

    console.log('[Collab] Starting collaboration for room:', roomId)
    
    const newYdoc = new Y.Doc()
    
    // Get signaling servers from environment variable
    const signalingServers = import.meta.env.VITE_SIGNALING_SERVERS
      ? import.meta.env.VITE_SIGNALING_SERVERS.split(',').map((s: string) => s.trim())
      : []
    
    console.log('[Collab] Using signaling servers:', signalingServers)
    
    const newProvider = new WebrtcProvider(`notes-app-${roomId}`, newYdoc, {
      signaling: signalingServers
    })

    // Store in refs for cleanup
    providerRef.current = newProvider
    ydocRef.current = newYdoc

    newProvider.awareness.setLocalStateField('user', {
      name: user?.name || 'Anonymous',
      color: userColor,
      colorLight: userColor + '40'
    })

    // Log connection status
    newProvider.on('synced', (event: { synced: boolean }) => {
      console.log('[Collab] Provider synced:', event.synced)
    })
    
    newProvider.on('peers', (event: { added: string[], removed: string[], webrtcPeers: string[], bcPeers: string[] }) => {
      console.log('[Collab] Peers changed:', event)
    })

    setYdoc(newYdoc)
    setProvider(newProvider)
    
    // Wait for provider to be ready
    const checkReady = () => {
      if (newProvider.awareness) {
        console.log('[Collab] Provider ready')
        setIsProviderReady(true)
      } else {
        setTimeout(checkReady, 100)
      }
    }
    const readyTimeout = setTimeout(checkReady, 300)

    // Update collaborators list
    const updateCollaborators = () => {
      const collabs: CollaboratorInfo[] = []
      newProvider.awareness.getStates().forEach((state: { user?: { name?: string; color?: string } }) => {
        if (state.user) {
          collabs.push({
            name: state.user.name || 'Anonymous',
            color: state.user.color || '#888'
          })
        }
      })
      console.log('[Collab] Collaborators updated:', collabs.length)
      setCollaborators(collabs)
    }

    newProvider.awareness.on('change', updateCollaborators)
    updateCollaborators()
    const interval = setInterval(updateCollaborators, 2000)

    return () => {
      console.log('[Collab] Cleaning up room:', roomId)
      clearTimeout(readyTimeout)
      clearInterval(interval)
      newProvider.awareness.off('change', updateCollaborators)
      setIsProviderReady(false)
    }
  }, [roomId, user?.name, userColor])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (providerRef.current) {
        providerRef.current.disconnect()
        providerRef.current.destroy()
      }
      if (ydocRef.current) {
        ydocRef.current.destroy()
      }
    }
  }, [])

  // Debounced update note content - reduced for snappier feel
  const debouncedUpdate = useDebouncedCallback((id: string, content: string) => {
    lastSavedContentRef.current = content
    updateNote(id, { content })
  }, 300)

  // Track last saved content to avoid unnecessary saves
  const lastSavedContentRef = useRef<string>(note.content || '')
  
  // Store note.id in ref to use in editor callback (avoids stale closure)
  const noteIdRef = useRef(note.id)
  noteIdRef.current = note.id

  // Determine if collaboration mode is fully ready
  const isCollaborationReady = !!(roomId && ydoc && provider && isProviderReady)

  // Memoize extensions to prevent recreation on every render
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extensions = useMemo(() => {
    const baseExtensions: any[] = [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        // Disable history when collaborating (y-prosemirror handles it)
        ...(isCollaborationReady ? { history: false } : {})
      }),
      CodeBlockLowlight.configure({
        lowlight: createLowlight(common),
        defaultLanguage: 'javascript',
        HTMLAttributes: {
          class: 'hljs'
        }
      }),
      Placeholder.configure({
        placeholder: t('notes.placeholder')
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
        HTMLAttributes: { class: 'task-item' }
      }),
      ResizableImage,
      // Add Link BEFORE Markdown - Markdown will detect it exists and not add duplicate
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-500 underline cursor-pointer'
        }
      }),
      // Add Underline BEFORE Markdown - Markdown will detect it exists and not add duplicate
      Underline,
      // Markdown extension - will use existing Link and Underline instead of adding new ones
      Markdown.configure({
        html: true,
        transformPastedText: true,
        transformCopiedText: true,
        linkify: false,
        breaks: false
      }),
      Highlight.configure({
        multicolor: false
      }),
      Subscript,
      Superscript,
      TextAlign.configure({
        types: ['heading', 'paragraph']
      })
    ]

    // Add collaboration extensions when in a room and ready
    if (isCollaborationReady && ydoc && provider) {
      baseExtensions.push(
        Collaboration.configure({
          document: ydoc,
          field: 'prosemirror', // Use 'prosemirror' as the Y.js fragment name
        })
      )
      // Note: CollaborationCursor is disabled due to compatibility issues
      // with y-webrtc provider. The "Cannot read properties of undefined (reading 'doc')"
      // error occurs because the provider's awareness is not properly initialized
    }

    return baseExtensions
  }, [t, isCollaborationReady, ydoc, provider, user?.name, userColor])

  // Editor - only recreate when roomId changes, NOT when note changes
  const editor = useEditor({
    extensions,
    // When in collaboration mode, don't set initial content - Y.js document is the source of truth
    // Content will be synced from the host via Y.js
    content: isCollaborationReady ? '' : (note.content || ''),
    onUpdate: ({ editor }) => {
      if (noteIdRef.current && !roomId) {
        debouncedUpdate(noteIdRef.current, editor.getHTML())
      }
    },
    // Performance optimizations
    editorProps: {
      attributes: {
        class: 'focus:outline-none'
      }
    },
    // Defer parsing for faster initial render
    parseOptions: {
      preserveWhitespace: 'full'
    }
  }, [isCollaborationReady, extensions]) // Only depend on collaboration state and memoized extensions

  // Update editor content when note changes (without recreating editor)
  useEffect(() => {
    if (editor && currentNoteIdRef.current !== note.id) {
      currentNoteIdRef.current = note.id
      lastSavedContentRef.current = note.content || ''
      editor.commands.setContent(note.content || '')
    }
  }, [note.id, note.content, editor])

  // Set initial content on first render
  useEffect(() => {
    if (editor && isFirstRender.current) {
      isFirstRender.current = false
      if (editor.getHTML() !== note.content) {
        editor.commands.setContent(note.content || '')
      }
    }
  }, [editor, note.content])

  // When starting collaboration, initialize Y.js document with current content
  useEffect(() => {
    if (!roomId || !provider || !editor || !ydoc || !isProviderReady) {
      return
    }
    
    const fragment = ydoc.getXmlFragment('prosemirror')
    let initTimeout: ReturnType<typeof setTimeout> | null = null
    let peerWaitTimeout: ReturnType<typeof setTimeout> | null = null
    
    console.log('[Collab] Collaboration ready, isHost:', isRoomHost, 'fragment length:', fragment.length)
    
    // Only the HOST should initialize Y.js document with their content
    // Guests should wait for sync from the host
    // Use lastSavedContentRef to get initial content without causing re-renders
    const initialContent = lastSavedContentRef.current || note.content
    
    if (isRoomHost && initialContent) {
      console.log('[Collab] Host initializing content...')
      
      // Function to set content when ready
      const setInitialContent = () => {
        const currentFragment = ydoc.getXmlFragment('prosemirror')
        if (currentFragment.length === 0) {
          console.log('[Collab] Setting initial content to Y.js document')
          editor.commands.setContent(initialContent)
        } else {
          console.log('[Collab] Fragment already has content, skipping init')
        }
      }
      
      // Wait a bit for Y.js to be fully ready before setting content
      initTimeout = setTimeout(setInitialContent, 500)
      
      // Also set content again after a longer delay to ensure sync with late joiners
      peerWaitTimeout = setTimeout(() => {
        const currentFragment = ydoc.getXmlFragment('prosemirror')
        if (currentFragment.length === 0 && initialContent) {
          console.log('[Collab] Re-setting content after peer wait')
          editor.commands.setContent(initialContent)
        }
      }, 2000)
    } else if (!isRoomHost) {
      console.log('[Collab] Guest waiting for sync from host...')
      
      // Listen for Y.js document updates to know when content arrives
      const onUpdate = () => {
        const currentFragment = ydoc.getXmlFragment('prosemirror')
        console.log('[Collab] Y.js update received, fragment length:', currentFragment.length)
      }
      ydoc.on('update', onUpdate)
      
      return () => {
        ydoc.off('update', onUpdate)
      }
    }
    
    // Periodic auto-save during collaboration (every 10 seconds)
    const autoSaveInterval = setInterval(() => {
      const content = editor.getHTML()
      if (noteIdRef.current && content !== lastSavedContentRef.current) {
        lastSavedContentRef.current = content
        updateNote(noteIdRef.current, { content })
      }
    }, 10000)

    return () => {
      if (initTimeout) clearTimeout(initTimeout)
      if (peerWaitTimeout) clearTimeout(peerWaitTimeout)
      
      // Save content before leaving collaboration
      const finalContent = editor.getHTML()
      if (noteIdRef.current && finalContent !== lastSavedContentRef.current) {
        lastSavedContentRef.current = finalContent
        updateNote(noteIdRef.current, { content: finalContent })
      }
      
      clearInterval(autoSaveInterval)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, provider, editor, ydoc, isProviderReady, updateNote, isRoomHost])

  // Save on page unload or visibility change (prevent data loss)
  useEffect(() => {
    const saveCurrentContent = () => {
      if (editor && noteIdRef.current) {
        const content = editor.getHTML()
        if (content !== lastSavedContentRef.current) {
          lastSavedContentRef.current = content
          // Use sync update for immediate save
          useNotesStore.getState().updateNote(noteIdRef.current, { content })
        }
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveCurrentContent()
      }
    }

    const handleBeforeUnload = () => {
      saveCurrentContent()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      // Final save on unmount
      saveCurrentContent()
    }
  }, [editor])

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !editor) return

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      editor.chain().focus().setImage({ src: base64 }).run()
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }, [editor])

  const addImage = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  // Store the text captured when context menu opened
  const capturedTextRef = useRef<string>('')

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

  const handleDelete = () => {
    deleteNote(note.id)
    onClose()
  }

  const handleCreateRoom = (newRoomId: string) => {
    console.log('[Collab] handleCreateRoom called with:', newRoomId)
    setIsRoomHost(true) // User is the host when creating a room
    setRoomId(newRoomId)
  }

  const handleJoinRoom = (joinRoomId: string) => {
    console.log('[Collab] handleJoinRoom called with:', joinRoomId)
    setIsRoomHost(false) // User is a guest when joining a room
    setRoomId(joinRoomId)
  }

  const handleStopSharing = () => {
    // Save current content before stopping collaboration
    if (editor && noteIdRef.current) {
      const content = editor.getHTML()
      if (content !== lastSavedContentRef.current) {
        lastSavedContentRef.current = content
        updateNote(noteIdRef.current, { content })
      }
    }
    setRoomId(null)
    setIsRoomHost(false)
    setCollaborators([])
  }

  const handleRestoreVersion = (content: string, title: string) => {
    if (note && editor) {
      editor.commands.setContent(content)
      updateNote(note.id, { content, title })
    }
  }

  const handleStyleChange = (style: NoteStyle) => {
    if (note) {
      updateNote(note.id, { style })
    }
  }

  // Import document handler
  const handleImportDocument = useCallback((title: string, content: string) => {
    if (!editor || !note) return
    
    // Update title if imported file has one and current note is untitled
    if (title && !note.title) {
      updateNote(note.id, { title })
    }
    
    // Set content to editor
    editor.commands.setContent(content)
    
    // Trigger save
    debouncedUpdate(note.id, content)
  }, [editor, note, updateNote, debouncedUpdate])

  // AI handlers
  const getEditorText = () => {
    return editor?.getText() || ''
  }

  // Convert markdown to HTML and set to editor
  const setMarkdownContent = (markdown: string) => {
    if (!editor) return
    // Use marked to convert markdown to HTML, then set to editor
    const html = marked.parse(markdown, { async: false }) as string
    editor.commands.setContent(html)
  }

  // Simulate streaming text effect with markdown support
  const streamText = async (markdownText: string, onComplete?: () => void, asTaskList?: boolean) => {
    if (!editor) return
    
    setIsStreaming(true)
    editor.commands.setContent('') // Clear editor
    
    const words = markdownText.split(' ')
    let currentText = ''
    
    for (let i = 0; i < words.length; i++) {
      currentText += (i === 0 ? '' : ' ') + words[i]
      // Set as plain text during streaming for performance
      editor.commands.setContent(`<p>${currentText}</p>`)
      
      // Auto scroll to bottom - smooth scroll during streaming
      if (editorContainerRef.current) {
        editorContainerRef.current.scrollTo({
          top: editorContainerRef.current.scrollHeight,
          behavior: 'smooth'
        })
      }
      
      // Random delay for natural feel (15-35ms per word)
      await new Promise(resolve => setTimeout(resolve, 15 + Math.random() * 20))
    }
    
    // After streaming, parse markdown properly
    if (asTaskList) {
      // Convert markdown list to Tiptap task list format
      const taskListHtml = convertToTaskList(markdownText)
      editor.commands.setContent(taskListHtml)
    } else {
      setMarkdownContent(markdownText)
    }
    
    // Final scroll to ensure everything is visible
    if (editorContainerRef.current) {
      editorContainerRef.current.scrollTo({
        top: editorContainerRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
    
    setIsStreaming(false)
    if (note) updateNote(note.id, { content: editor.getHTML() })
    onComplete?.()
  }

  // Convert markdown list items to Tiptap task list HTML
  const convertToTaskList = (markdown: string): string => {
    const lines = markdown.split('\n')
    const taskItems: string[] = []
    
    for (const line of lines) {
      // Match markdown list items: - item, * item, or numbered 1. item
      const match = line.match(/^[\s]*[-*][\s]+(.+)$/) || line.match(/^[\s]*\d+\.[\s]+(.+)$/)
      if (match) {
        const text = match[1].trim()
        taskItems.push(`<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>${text}</p></div></li>`)
      }
    }
    
    if (taskItems.length > 0) {
      return `<ul data-type="taskList">${taskItems.join('')}</ul>`
    }
    
    // Fallback: if no list items found, just return as paragraph
    return `<p>${markdown}</p>`
  }

  const handleAIAction = async (action: AI.AIAction, extra?: string) => {
    if (!editor || isAILoading || isStreaming) return
    
    // Check network for AI features
    if (!isOnline) {
      showNetworkOverlay(t('ai.title'))
      return
    }
    
    const content = getEditorText()
    if (!content.trim()) return

    if (action === 'ask') {
      // Open fullscreen chat view directly
      setShowAIChatView(true)
      return
    }

    setIsAILoading(true)
    
    // Clear editor and show skeleton for actions that replace content
    const replaceActions = ['improve', 'translate', 'extract-tasks']
    if (replaceActions.includes(action)) {
      editor.commands.setContent('')
    }
    
    try {
      let result: string

      switch (action) {
        case 'summarize':
          result = await AI.summarize(content)
          setSummaryContent(result)
          setShowSummary(true)
          setIsAILoading(false)
          break
        
        case 'continue':
          result = await AI.continueWriting(content)
          setIsAILoading(false)
          // Stream append to existing content
          const originalHtml = editor.getHTML()
          setIsStreaming(true)
          
          const newWords = result.split(' ')
          let appendText = '\n\n'
          for (let i = 0; i < newWords.length; i++) {
            appendText += (i === 0 ? '' : ' ') + newWords[i]
            editor.commands.setContent(originalHtml + `<p>${appendText}</p>`)
            // Auto scroll during streaming
            if (editorContainerRef.current) {
              editorContainerRef.current.scrollTo({
                top: editorContainerRef.current.scrollHeight,
                behavior: 'smooth'
              })
            }
            await new Promise(resolve => setTimeout(resolve, 15 + Math.random() * 20))
          }
          // Parse markdown for the appended content
          setMarkdownContent(content + '\n\n' + result)
          // Final scroll
          if (editorContainerRef.current) {
            editorContainerRef.current.scrollTo({
              top: editorContainerRef.current.scrollHeight,
              behavior: 'smooth'
            })
          }
          setIsStreaming(false)
          if (note) updateNote(note.id, { content: editor.getHTML() })
          break
        
        case 'improve':
          result = await AI.improveWriting(content)
          setIsAILoading(false)
          await streamText(result)
          break
        
        case 'translate':
          if (!extra) {
            setIsAILoading(false)
            return
          }
          result = await AI.translate(content, extra)
          setIsAILoading(false)
          await streamText(result)
          break
        
        case 'extract-tasks':
          result = await AI.extractTasks(content)
          setIsAILoading(false)
          // Convert to Tiptap task list format instead of regular markdown
          await streamText(result, undefined, true)
          break
      }
    } catch (error) {
      console.error('AI error:', error)
      if (error instanceof InsufficientCreditsError) {
        setShowCreditsError(true)
        // Restore content if it was cleared
        if (replaceActions.includes(action)) {
          editor.commands.setContent(note.content || '')
        }
      } else {
        setAiError((error as Error).message || t('ai.error'))
      }
      setIsAILoading(false)
      setIsStreaming(false)
    }
  }

  const handleCopy = () => {
    if (selectedText) {
      navigator.clipboard.writeText(selectedText)
    } else {
      document.execCommand('copy')
    }
  }

  const handleCut = () => {
    if (selectedText) {
      navigator.clipboard.writeText(selectedText)
      editor?.commands.deleteSelection()
    } else {
      document.execCommand('cut')
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      editor?.commands.insertContent(text)
    } catch {
      document.execCommand('paste')
    }
  }

  const handleSelectAll = () => {
    // Focus editor first, then select all
    editor?.chain().focus().selectAll().run()
  }

  const handleSelectionAskAI = () => {
    // Use captured text from when context menu opened (more reliable than selectedText state)
    const textToUse = capturedTextRef.current || selectedText
    if (textToUse) {
      setAiContextText(textToUse)
    }
    // Open fullscreen chat view directly
    setShowAIChatView(true)
  }

  return (
    <div className="flex flex-col h-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* AI Chat View - Fullscreen */}
      <AIChatView
        open={showAIChatView}
        onClose={() => {
          setShowAIChatView(false)
          // Don't clear context and messages - keep for next time
        }}
        noteContent={aiContextText || getEditorText()}
        contextText={aiContextText}
        onClearContext={() => setAiContextText('')}
        initialMessages={chatMessages}
        isLoading={isAskAILoading}
        onSendMessage={async (question, onStream) => {
          if (isAskAILoading) return
          
          const content = aiContextText || getEditorText()
          if (!content.trim()) return

          // Add user message first
          const userMessage: AIChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: question,
            timestamp: Date.now()
          }
          setChatMessages(prev => [...prev, userMessage])

          setIsAskAILoading(true)
          
          try {
            const result = await AI.askAI(content, question)
            
            const aiMessage: AIChatMessage = {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: result,
              timestamp: Date.now()
            }
            
            // Add empty message first for streaming
            setChatMessages(prev => [...prev, { ...aiMessage, content: '' }])
            setIsAskAILoading(false)
            
            // Stream the text if callback provided
            if (onStream) {
              await onStream(aiMessage.id, result)
            }
            
            // Update with final content
            setChatMessages(prev => prev.map(m => 
              m.id === aiMessage.id ? aiMessage : m
            ))
          } catch (error) {
            console.error('AI error:', error)
            setIsAskAILoading(false)
            
            if (error instanceof InsufficientCreditsError) {
              setShowAIChatView(false)
              setShowCreditsError(true)
            } else if (error instanceof NetworkRequiredError) {
              setShowAIChatView(false)
              showNetworkOverlay(t('ai.title'))
            } else {
              setAiError((error as Error).message || t('ai.error'))
            }
          }
        }}
        onInsufficientCredits={() => {
          setShowAIChatView(false)
          setShowCreditsError(true)
        }}
      />

      {/* Network Required Overlay */}
      <NetworkOverlay />

      <ConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title={t('notes.delete')}
        description={t('notes.deleteConfirm')}
        confirmText={t('notes.delete')}
        cancelText={t('notes.cancel')}
      />

      <ShareDialog
        open={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        noteId={note.id}
        existingRoomId={roomId || undefined}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
      />

      <VersionHistoryPanel
        open={showVersionHistory}
        onClose={() => setShowVersionHistory(false)}
        driveFileId={note.driveFileId}
        onRestore={handleRestoreVersion}
      />

      <DrawingModal
        open={showDrawingModal}
        onClose={() => setShowDrawingModal(false)}
        onSave={(imageDataUrl) => {
          // Insert drawing as image into editor
          editor?.chain().focus().setImage({ src: imageDataUrl }).run()
        }}
      />

      <InputDialog
        open={showLinkDialog}
        onClose={() => setShowLinkDialog(false)}
        onConfirm={(url) => {
          editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
        }}
        title={t('editor.insertLink')}
        placeholder={t('editor.linkPrompt')}
        inputType="url"
      />

      {/* Collaboration indicator - Mobile (title is now in NoteModal header) */}
      {roomId && collaborators.length > 0 && (
        <div className="md:hidden flex items-center gap-1 px-4 pt-2">
          <div className="flex -space-x-1">
            {collaborators.slice(0, 2).map((collab, i) => (
              <div
                key={i}
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-medium text-white border border-white dark:border-neutral-900"
                style={{ backgroundColor: collab.color }}
              >
                {collab.name.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
        </div>
      )}

      {/* Scrollable Content Area - includes title */}
      <div ref={editorContainerRef} className="flex-1 overflow-y-auto px-4 relative">
        {/* Mobile Header - Back + Title + Pin - scrolls with content */}
        <div className="md:hidden flex items-center gap-2 pt-4 pb-2 min-w-0">
          <button
            onClick={onClose}
            className="p-2 -ml-2 rounded-full text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="flex-1 min-w-0">
            <EditableTitle
              value={note.title}
              onChange={(value) => updateNote(note.id, { title: value })}
              placeholder={t('notes.title')}
              className="text-xl font-medium text-neutral-900 dark:text-white"
            />
          </div>
          
          {/* Collaboration indicator */}
          {roomId && collaborators.length > 0 && (
            <div className="flex items-center gap-1">
              <div className="flex -space-x-1">
                {collaborators.slice(0, 3).map((collab, i) => (
                  <div
                    key={i}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium text-white border-2 border-white dark:border-neutral-900"
                    style={{ backgroundColor: collab.color }}
                    title={collab.name}
                  >
                    {collab.name.charAt(0).toUpperCase()}
                  </div>
                ))}
                {collaborators.length > 3 && (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium bg-neutral-300 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-200 border-2 border-white dark:border-neutral-900">
                    +{collaborators.length - 3}
                  </div>
                )}
              </div>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            </div>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onTogglePin}
                className="p-2 rounded-full text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{isPinned ? t('notes.unpin') : t('notes.pin')}</TooltipContent>
          </Tooltip>
        </div>

        {/* Title + Pin - Desktop (now scrolls with content) */}
        <div className="hidden md:flex items-center gap-2 pt-4 pb-2 min-w-0">
            {/* Back button - only when fullscreen on desktop */}
            {isFullscreen && (
              <button
                onClick={onClose}
                className="p-2 -ml-2 rounded-full text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex-1 min-w-0">
              <EditableTitle
                value={note.title}
                onChange={(value) => updateNote(note.id, { title: value })}
                placeholder={t('notes.title')}
                className="text-xl font-medium text-neutral-900 dark:text-white"
              />
            </div>
            
            {/* Collaboration indicator */}
            {roomId && collaborators.length > 0 && (
              <div className="flex items-center gap-1">
                <div className="flex -space-x-1">
                  {collaborators.slice(0, 3).map((collab, i) => (
                    <div
                      key={i}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium text-white border-2 border-white dark:border-neutral-900"
                      style={{ backgroundColor: collab.color }}
                      title={collab.name}
                    >
                      {collab.name.charAt(0).toUpperCase()}
                    </div>
                  ))}
                  {collaborators.length > 3 && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium bg-neutral-300 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-200 border-2 border-white dark:border-neutral-900">
                      +{collaborators.length - 3}
                    </div>
                  )}
                </div>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              </div>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onTogglePin}
                  className="p-2 rounded-full text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                </button>
              </TooltipTrigger>
              <TooltipContent>{isPinned ? t('notes.unpin') : t('notes.pin')}</TooltipContent>
            </Tooltip>
          </div>

        {/* Editor Content or Skeleton Loading */}
        {isAILoading ? (
          <EditorSkeleton />
        ) : (
          <ContextMenu disableOnTouch>
            <ContextMenuTrigger asChild onContextMenu={handleContextMenuOpen} disableOnTouch>
              <div>
                <EditorContent 
                  editor={editor} 
                  className="min-h-[200px] text-neutral-700 dark:text-neutral-300"
                />
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent disableOnTouch>
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
              <ContextMenuItem onClick={handleSelectionAskAI}>
                <Sparkles className="w-4 h-4 mr-2" />
                {t('ai.ask')}
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        )}
      </div>

      {/* Footer Toolbar */}
      <div 
        className="flex items-center justify-between px-2 py-1.5 bg-neutral-100/80 dark:bg-neutral-800/60 backdrop-blur-sm safe-x relative rounded-b-[12px] safe-bottom"
      >
        {/* AI Modals - positioned above toolbar */}
        <SummaryModal
          open={showSummary}
          content={summaryContent}
          onClose={() => setShowSummary(false)}
        />

        <InsufficientCreditsModal
          open={showCreditsError}
          onClose={() => setShowCreditsError(false)}
          onBuyCredits={() => {
            // Close note modal first, then open credits modal
            onClose()
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('open-credits-modal'))
            }, 100)
          }}
        />

        {/* AI Error Toast */}
        {aiError && (
          <div className="absolute inset-x-0 bottom-full mb-2 px-4 z-20">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2 text-sm text-red-700 dark:text-red-300 animate-in fade-in slide-in-from-bottom-2">
              {aiError}
            </div>
          </div>
        )}

        <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none">
          {/* AI Menu - First position */}
          <AIMenu 
            onAction={handleAIAction} 
            disabled={isAILoading || isStreaming}
          />
          
          {/* Speech to Text */}
          <SpeechButton
            onTranscript={(text, isFinal) => {
              if (isFinal && editor) {
                editor.commands.insertContent(text + ' ')
              }
            }}
            disabled={isAILoading || isStreaming}
          />
          
          <Divider />
          
          {/* Primary formatting tools - always visible */}
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleBold().run()}
            active={editor?.isActive('bold')}
            tooltip={t('editor.bold')}
          >
            <Bold className="w-[18px] h-[18px]" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            active={editor?.isActive('italic')}
            tooltip={t('editor.italic')}
          >
            <Italic className="w-[18px] h-[18px]" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
            active={editor?.isActive('underline')}
            tooltip={t('editor.underline')}
          >
            <UnderlineIcon className="w-[18px] h-[18px]" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleStrike().run()}
            active={editor?.isActive('strike')}
            tooltip={t('editor.strikethrough')}
          >
            <Strikethrough className="w-[18px] h-[18px]" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleHighlight().run()}
            active={editor?.isActive('highlight')}
            tooltip={t('editor.highlight')}
          >
            <Highlighter className="w-[18px] h-[18px]" />
          </ToolbarButton>
          
          <Divider />
          
          {/* Headings */}
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor?.isActive('heading', { level: 1 })}
            tooltip={t('editor.heading1')}
          >
            <Heading1 className="w-[18px] h-[18px]" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor?.isActive('heading', { level: 2 })}
            tooltip={t('editor.heading2')}
          >
            <Heading2 className="w-[18px] h-[18px]" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor?.isActive('heading', { level: 3 })}
            tooltip={t('editor.heading3')}
          >
            <Heading3 className="w-[18px] h-[18px]" />
          </ToolbarButton>
          
          <Divider />
          
          {/* Lists */}
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            active={editor?.isActive('bulletList')}
            tooltip={t('editor.bulletList')}
          >
            <List className="w-[18px] h-[18px]" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            active={editor?.isActive('orderedList')}
            tooltip={t('editor.numberedList')}
          >
            <ListOrdered className="w-[18px] h-[18px]" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleTaskList().run()}
            active={editor?.isActive('taskList')}
            tooltip={t('editor.taskList')}
          >
            <CheckSquare className="w-[18px] h-[18px]" />
          </ToolbarButton>
          
          <Divider />
          
          {/* Text alignment */}
          <ToolbarButton
            onClick={() => editor?.chain().focus().setTextAlign('left').run()}
            active={editor?.isActive({ textAlign: 'left' })}
            tooltip={t('editor.alignLeft')}
          >
            <AlignLeft className="w-[18px] h-[18px]" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().setTextAlign('center').run()}
            active={editor?.isActive({ textAlign: 'center' })}
            tooltip={t('editor.alignCenter')}
          >
            <AlignCenter className="w-[18px] h-[18px]" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().setTextAlign('right').run()}
            active={editor?.isActive({ textAlign: 'right' })}
            tooltip={t('editor.alignRight')}
          >
            <AlignRight className="w-[18px] h-[18px]" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().setTextAlign('justify').run()}
            active={editor?.isActive({ textAlign: 'justify' })}
            tooltip={t('editor.alignJustify')}
          >
            <AlignJustify className="w-[18px] h-[18px]" />
          </ToolbarButton>
          
          <Divider />
          
          {/* Code & Quote */}
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleCode().run()}
            active={editor?.isActive('code')}
            tooltip={t('editor.inlineCode')}
          >
            <Code className="w-[18px] h-[18px]" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
            active={editor?.isActive('codeBlock')}
            tooltip={t('editor.codeBlock')}
          >
            <Code2 className="w-[18px] h-[18px]" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            active={editor?.isActive('blockquote')}
            tooltip={t('editor.blockquote')}
          >
            <Quote className="w-[18px] h-[18px]" />
          </ToolbarButton>
          
          <Divider />
          
          {/* Subscript & Superscript */}
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleSubscript().run()}
            active={editor?.isActive('subscript')}
            tooltip={t('editor.subscript')}
          >
            <SubscriptIcon className="w-[18px] h-[18px]" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleSuperscript().run()}
            active={editor?.isActive('superscript')}
            tooltip={t('editor.superscript')}
          >
            <SuperscriptIcon className="w-[18px] h-[18px]" />
          </ToolbarButton>
          
          <Divider />
          
          {/* Link */}
          <ToolbarButton
            onClick={() => {
              if (editor?.isActive('link')) {
                editor.chain().focus().unsetLink().run()
              } else {
                setShowLinkDialog(true)
              }
            }}
            active={editor?.isActive('link')}
            tooltip={editor?.isActive('link') ? t('editor.removeLink') : t('editor.insertLink')}
          >
            {editor?.isActive('link') ? <Unlink className="w-[18px] h-[18px]" /> : <LinkIcon className="w-[18px] h-[18px]" />}
          </ToolbarButton>
          
          {/* Horizontal rule */}
          <ToolbarButton
            onClick={() => editor?.chain().focus().setHorizontalRule().run()}
            tooltip={t('editor.horizontalRule')}
          >
            <Minus className="w-[18px] h-[18px]" />
          </ToolbarButton>
          
          {/* Clear formatting */}
          <ToolbarButton
            onClick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()}
            tooltip={t('editor.clearFormatting')}
          >
            <RemoveFormatting className="w-[18px] h-[18px]" />
          </ToolbarButton>

          <Divider />

          <ToolbarButton onClick={addImage} tooltip={t('editor.insertImage')}>
            <ImagePlus className="w-[18px] h-[18px]" />
          </ToolbarButton>
          
          <ToolbarButton 
            onClick={() => setShowDrawingModal(true)} 
            tooltip={t('drawing.insert')}
          >
            <Pencil className="w-[18px] h-[18px]" />
          </ToolbarButton>
          
          <NoteStylePicker 
            style={note.style} 
            onChange={handleStyleChange}
          />

          <Divider />

          <ToolbarButton
            onClick={() => editor?.chain().focus().undo().run()}
            disabled={!editor?.can().undo()}
            tooltip={t('editor.undo')}
          >
            <Undo2 className="w-[18px] h-[18px]" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().redo().run()}
            disabled={!editor?.can().redo()}
            tooltip={t('editor.redo')}
          >
            <Redo2 className="w-[18px] h-[18px]" />
          </ToolbarButton>

          <Divider />

          {/* Export/Import menu */}
          <NoteActionsMenu
            noteTitle={note.title}
            noteContent={editor?.getHTML() || note.content}
            onImport={handleImportDocument}
            disabled={isAILoading || isStreaming}
          />

          {/* More menu for less-used actions */}
          <ToolbarButton
            onClick={() => roomId ? handleStopSharing() : setShowShareDialog(true)}
            active={!!roomId}
            tooltip={roomId ? t('editor.stopSharing') : t('editor.collaborate')}
          >
            {roomId ? <Users className="w-[18px] h-[18px]" /> : <Share2 className="w-[18px] h-[18px]" />}
          </ToolbarButton>

          <ToolbarButton
            onClick={() => setShowVersionHistory(true)}
            tooltip={t('editor.versionHistory')}
          >
            <History className="w-[18px] h-[18px]" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => setShowDeleteDialog(true)}
            tooltip={t('notes.delete')}
          >
            <Trash2 className="w-[18px] h-[18px]" />
          </ToolbarButton>

          {onToggleFullscreen && canToggleFullscreen && (
            <ToolbarButton
              onClick={onToggleFullscreen}
              tooltip={isFullscreen ? t('editor.exitFullscreen') : t('editor.fullscreen')}
              className="hidden md:flex"
            >
              {isFullscreen ? <Minimize2 className="w-[18px] h-[18px]" /> : <Maximize2 className="w-[18px] h-[18px]" />}
            </ToolbarButton>
          )}
        </div>

        <button
          onClick={onClose}
          className={cn(
            "px-3 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-[8px] transition-colors",
            "hidden md:block",
            isFullscreen && "md:hidden"
          )}
        >
          {t('notes.close')}
        </button>
      </div>
    </div>
  )
}

function Divider() {
  return <div className="w-px h-4 bg-neutral-300 dark:bg-neutral-600 mx-1" />
}

function ToolbarButton({
  children,
  onClick,
  active,
  disabled,
  tooltip,
  className
}: {
  children: React.ReactNode
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  tooltip?: string
  className?: string
}) {
  // Prevent mouse events from stealing focus on desktop
  const preventMouseFocusLoss = (e: React.MouseEvent) => {
    e.preventDefault()
  }

  const button = (
    <button
      onMouseDown={preventMouseFocusLoss}
      onClick={() => {
        if (onClick && !disabled) {
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
      {children}
    </button>
  )

  if (!tooltip) return button

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
