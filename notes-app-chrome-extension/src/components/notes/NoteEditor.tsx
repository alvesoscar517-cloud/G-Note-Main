import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useDebouncedCallback } from 'use-debounce'
import { useTranslation } from 'react-i18next'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { MobileScrollableTable } from './table/MobileScrollableTable'
import { initTableScrollIndicators } from './table/tableScrollIndicators'
import { ResizableImage } from './ResizableImageExtension'
import { DrawingModal } from './DrawingModal'
import { ImageAnalysisModal } from './ImageAnalysisModal'
import { CollaborationCursors } from './CollaborationCursors'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import { Markdown } from 'tiptap-markdown'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import TextAlign from '@tiptap/extension-text-align'
import Link from '@tiptap/extension-link'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import Typography from '@tiptap/extension-typography'
import FontFamily from '@tiptap/extension-font-family'
import Youtube from '@tiptap/extension-youtube'
import { marked } from 'marked'
import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import Collaboration from '@tiptap/extension-collaboration'
import { generateUserColor } from '@/lib/collaboration'
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
  ArrowLeft,
  Table as TableIcon
} from 'lucide-react'
import { useNotesStore } from '@/stores/notesStore'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore, NetworkRequiredError } from '@/stores/appStore'
import { cn } from '@/lib/utils'
import { ConfirmDialog, InputDialog } from '@/components/ui/Dialog'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/Tooltip'
import { DrawingErrorBoundary } from '@/components/ui/ErrorBoundary'

import { ShareDialog } from './ShareDialog'
import { VersionHistoryPanel } from './VersionHistoryPanel'
import { NoteStylePicker } from './NoteStylePicker'
import { NoteActionsMenu } from './NoteActionsMenu'
import { AIMenu, InsufficientCreditsModal } from './AIMenu'
import { AIChatView } from './AIChatView'
import { SpeechButton } from './SpeechButton'
import { EditorSkeleton } from '@/components/ui/Skeleton'
import { useNetworkRequiredOverlay } from '@/components/ui/OfflineIndicator'
import { useResponsiveToolbar } from '@/hooks/useResponsiveToolbar'
import { TableInsertDialog } from './table/TableInsertDialog'
import { EditorContextMenu } from './EditorContextMenu'
import { TablePropertiesDialog } from './table/TablePropertiesDialog'
import { useScrollableDrag } from '@/hooks/useScrollableDrag'
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
  const isPastingRef = useRef(false)

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
        onChange={(e) => {
          // Strip newlines from pasted text to keep title single-line
          const newValue = e.target.value.replace(/[\r\n]+/g, ' ')
          onChange(newValue)
        }}
        onPaste={() => {
          // Mark that we're pasting to ignore Enter key from paste
          isPastingRef.current = true
          setTimeout(() => {
            isPastingRef.current = false
          }, 100)
        }}
        onBlur={() => setIsEditing(false)}
        onKeyDown={(e) => {
          // Only handle Enter/Escape if not from paste event
          if ((e.key === 'Enter' || e.key === 'Escape') && !isPastingRef.current) {
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
    <Tooltip>
      <TooltipTrigger asChild>
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
        >
          {displayValue}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">{value || placeholder}</TooltipContent>
    </Tooltip>
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
  picture?: string
}

export function NoteEditor({ note, onClose, onTogglePin, isPinned, isFullscreen, canToggleFullscreen = true, onToggleFullscreen }: NoteEditorProps) {
  const { t } = useTranslation()
  const { updateNote, deleteNote } = useNotesStore()
  const { user } = useAuthStore()
  const isOnline = useAppStore(state => state.isOnline)

  // Network required overlay for offline handling
  const { showOverlay: showNetworkOverlay, OverlayComponent: NetworkOverlay } = useNetworkRequiredOverlay()

  // Track note ID to detect when note changes
  const currentNoteIdRef = useRef(note.id)
  const isFirstRender = useRef(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showTableInsertDialog, setShowTableInsertDialog] = useState(false)
  const [showTablePropertiesDialog, setShowTablePropertiesDialog] = useState(false)
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
  const [isSummarizing, setIsSummarizing] = useState(false)

  const [aiContextText, setAiContextText] = useState('') // Text to use for AI query
  const [aiError, setAiError] = useState<string | null>(null)
  const [showCreditsError, setShowCreditsError] = useState(false)
  const [showDrawingModal, setShowDrawingModal] = useState(false)
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [showImageAnalysis, setShowImageAnalysis] = useState(false)
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false)
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  // Responsive toolbar visibility
  const toolbarVisibility = useResponsiveToolbar(toolbarRef)

  // Scrollable drag for toolbar
  const toolbarScrollRef = useScrollableDrag<HTMLDivElement>()

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
  const [awarenessDoc, setAwarenessDoc] = useState<Y.Doc | null>(null)

  // Use refs to track current provider/ydoc for cleanup
  const providerRef = useRef<WebrtcProvider | null>(null)
  const ydocRef = useRef<Y.Doc | null>(null)

  // Use refs for user info to avoid re-running effect when these change
  const userNameRef = useRef(user?.name)
  const userAvatarRef = useRef(user?.avatar)
  userNameRef.current = user?.name
  userAvatarRef.current = user?.avatar

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
      setAwarenessDoc(null)
      return
    }

    let cancelled = false
    let readyTimeout: ReturnType<typeof setTimeout>
    let interval: ReturnType<typeof setInterval>
    let newProvider: WebrtcProvider | null = null
    let newYdoc: Y.Doc | null = null

    const setupCollaboration = async () => {
      console.log('[Collab] Starting collaboration for room:', roomId)

      newYdoc = new Y.Doc()

      // Get signaling servers from environment variable
      const signalingServers = import.meta.env.VITE_SIGNALING_SERVERS
        ? import.meta.env.VITE_SIGNALING_SERVERS.split(',').map((s: string) => s.trim())
        : []

      console.log('[Collab] Using signaling servers:', signalingServers)

      // Fetch ICE servers from Metered API (includes STUN + TURN)
      // This enables cross-network connections (WiFi to 4G, etc.)
      const meteredApiKey = import.meta.env.VITE_METERED_API_KEY
      let iceServers: RTCIceServer[] = [
        // Fallback STUN servers if API fails
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ]

      if (meteredApiKey) {
        try {
          const response = await fetch(`https://gnote.metered.live/api/v1/turn/credentials?apiKey=${meteredApiKey}`)
          if (response.ok) {
            const meteredServers = await response.json()
            iceServers = meteredServers
            console.log('[Collab] Loaded ICE servers from Metered:', iceServers.length, 'servers')
          }
        } catch (error) {
          console.warn('[Collab] Failed to fetch Metered ICE servers, using fallback:', error)
        }
      }

      if (cancelled) return

      newProvider = new WebrtcProvider(`notes-app-${roomId}`, newYdoc, {
        signaling: signalingServers,
        peerOpts: {
          config: {
            iceServers: iceServers
          }
        }
      })

      // Store in refs for cleanup
      providerRef.current = newProvider
      ydocRef.current = newYdoc

      newProvider.awareness.setLocalStateField('user', {
        name: userNameRef.current || 'Anonymous',
        color: userColor,
        colorLight: userColor + '40',
        picture: userAvatarRef.current || null
      })

      // Log connection status
      newProvider.on('synced', (event: { synced: boolean }) => {
        console.log('[Collab] Provider synced:', event.synced)
      })

      newProvider.on('peers', (event: { added: string[], removed: string[], webrtcPeers: string[], bcPeers: string[] }) => {
        console.log('[Collab] Peers changed:', event)
      })

      if (cancelled) return

      setYdoc(newYdoc)
      setProvider(newProvider)

      // Wait for awareness to be fully initialized with doc before marking ready
      // CollaborationCursor needs awareness.doc to be available
      const checkReady = () => {
        if (cancelled || !newProvider) return
        // Check if awareness has doc property (required by CollaborationCursor)
        // Also verify the doc is the same as our ydoc
        const aDoc = (newProvider.awareness as any).doc
        if (newProvider.awareness && aDoc && aDoc === newYdoc) {
          console.log('[Collab] Provider ready, awareness doc available')
          setAwarenessDoc(aDoc)
          setIsProviderReady(true)
        } else {
          // Retry after a short delay
          readyTimeout = setTimeout(checkReady, 100)
        }
      }

      // Start checking after initial setup - give more time for initialization
      readyTimeout = setTimeout(checkReady, 300)

      // Update collaborators list
      const updateCollaborators = () => {
        if (!newProvider) return
        const collabs: CollaboratorInfo[] = []
        newProvider.awareness.getStates().forEach((state) => {
          if (state.user) {
            collabs.push({
              name: state.user.name || 'Anonymous',
              color: state.user.color || '#888',
              picture: state.user.picture || undefined
            })
          }
        })
        console.log('[Collab] Collaborators updated:', collabs.length)
        setCollaborators(collabs)
      }

      newProvider.awareness.on('change', updateCollaborators)
      // Initial update
      updateCollaborators()
      interval = setInterval(updateCollaborators, 2000)
    }

    setupCollaboration()

    return () => {
      console.log('[Collab] Cleaning up room:', roomId)
      cancelled = true
      if (readyTimeout) clearTimeout(readyTimeout)
      if (interval) clearInterval(interval)
      if (newProvider) {
        newProvider.awareness.off('change', () => { })
      }
      setIsProviderReady(false)
      // Cleanup will be done at the start of next effect run
    }
  }, [roomId, userColor]) // Only re-run when roomId or userColor changes, not user info

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

  // Reconnect WebRTC when tab becomes visible again (after phone sleep/unlock)
  useEffect(() => {
    if (!roomId || !providerRef.current) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && providerRef.current) {
        console.log('[Collab] Tab visible, checking connection...')
        // WebrtcProvider will auto-reconnect, but we can force it
        if (!providerRef.current.connected) {
          console.log('[Collab] Reconnecting...')
          providerRef.current.connect()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [roomId])

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
  // This ensures we only switch to collaboration mode when everything is initialized
  // CollaborationCursor requires provider.awareness.doc to be available
  const isCollaborationReady = !!(
    roomId &&
    ydoc &&
    provider &&
    isProviderReady &&
    awarenessDoc
  )

  // Disable history when roomId is set (even before full collaboration ready)
  // This prevents conflict between StarterKit history and Collaboration extension
  const shouldDisableHistory = !!roomId

  // Memoize extensions to prevent recreation on every render
  const extensions = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseExtensions: any[] = [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        // Disable history when in collaboration mode (y-prosemirror handles it)
        // Use shouldDisableHistory to disable early, before full collaboration ready
        ...(shouldDisableHistory ? { history: false } : {})
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
      TextStyle,
      Color,
      Typography,
      FontFamily,
      Youtube.configure({
        controls: false,
        nocookie: true,
      }),
      ResizableImage,
      // Link extension for hyperlinks
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-500 underline cursor-pointer'
        }
      }),
      // Underline extension
      Underline,
      // Markdown extension for markdown support
      Markdown.configure({
        html: true,
        transformPastedText: true,
        transformCopiedText: false, // Disable markdown in copied text - we handle plain text separately
        linkify: false,
        breaks: false,
      }),
      Highlight.configure({
        multicolor: false
      }),
      Subscript,
      Superscript,
      TextAlign.configure({
        types: ['heading', 'paragraph']
      }),
      // Table extensions
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
      })
    ]

    // Add collaboration extensions when in a room
    // Only add if provider and ydoc are fully ready
    if (isCollaborationReady && ydoc && provider && awarenessDoc) {
      baseExtensions.push(
        Collaboration.configure({
          document: ydoc,
          field: 'prosemirror', // Use 'prosemirror' as the Y.js fragment name
        })
      )

      // Note: CollaborationCursor is disabled due to compatibility issues
      // with y-webrtc provider. The "Cannot read properties of undefined (reading 'doc')"
      // error occurs because yCursorPlugin expects awareness.doc to be set synchronously,
      // but y-webrtc sets it asynchronously. Content sync still works without cursor.
    }

    return baseExtensions
  }, [t, isCollaborationReady, shouldDisableHistory, ydoc, provider, awarenessDoc, user?.name, userColor])

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

  // Initialize scroll indicators for table wrappers
  useEffect(() => {
    if (!editor) return

    let cleanup: (() => void) | undefined

    // Wait for editor to be fully mounted
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




  const handleDelete = () => {
    deleteNote(note.id)
    onClose()
  }

  const handleCreateRoom = (newRoomId: string) => {
    setIsRoomHost(true) // User is the host when creating a room
    setRoomId(newRoomId)
  }

  const handleJoinRoom = (joinRoomId: string) => {
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

  const handleInsertTable = (rows: number, cols: number, withHeaderRow: boolean) => {
    editor?.chain().focus().insertTable({ rows, cols, withHeaderRow }).run()
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



  // Simulate streaming text effect with markdown support - REMOVED (Legacy)
  // We now use real streaming from the backend

  // Helper to scroll to bottom
  const scrollToBottom = () => {
    if (editorContainerRef.current) {
      editorContainerRef.current.scrollTo({
        top: editorContainerRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
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

    // Determine content based on selection
    const selection = editor.state.selection
    const isSelectionMode = !selection.empty
    const startPos = selection.from
    let endPos = selection.to

    const content = isSelectionMode
      ? editor.state.doc.textBetween(selection.from, selection.to, '\n')
      : getEditorText()

    if (!content.trim()) return

    if (action === 'ask') {
      // Open fullscreen chat view directly
      setShowAIChatView(true)
      return
    }

    if (action === 'ocr') {
      setShowImageAnalysis(true)
      return
    }

    if (action === 'summarize') {
      setIsSummarizing(true)
      if (editorContainerRef.current) {
        editorContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } else {
      setIsAILoading(true)

      // Clear editor and show skeleton for actions that replace content
      const replaceActions = ['improve', 'translate', 'extract-tasks', 'tone']
      if (replaceActions.includes(action)) {
        if (isSelectionMode) {
          editor.commands.deleteSelection()
          endPos = startPos
        } else {
          editor.commands.setContent('')
        }
      }
    }

    // Helper to apply updates to editor (full doc or selection)
    const applyUpdate = (fullText: string, asTaskList = false) => {
      let html = ''
      if (asTaskList) {
        html = convertToTaskList(fullText)
      } else {
        html = marked.parse(fullText, { async: false }) as string
      }

      if (isSelectionMode) {
        // Select the range we want to replace (growing content)
        editor.commands.setTextSelection({ from: startPos, to: endPos })
        editor.commands.insertContent(html)
        // Update endPos to match the new end of inserted content
        endPos = editor.state.selection.to
      } else {
        editor.commands.setContent(html)
        scrollToBottom()
      }
    }

    // Batch update logic
    let lastUpdate = 0
    const updateEditor = (fullText: string, asTaskList = false) => {
      const now = Date.now()
      // Limit updates to ~20fps (50ms)
      if (now - lastUpdate > 50) {
        applyUpdate(fullText, asTaskList)
        lastUpdate = now
      }
    }

    try {
      let result: string
      let accumulatedText = ''

      switch (action) {
        case 'summarize':
          // Insert summary at the top
          result = await AI.summarize(content)
          const summaryHtml = `<p><strong>${t('ai.summary')}</strong>: ${result}</p><hr />`
          editor.commands.insertContentAt(0, summaryHtml)
          setIsSummarizing(false)
          if (note) updateNote(note.id, { content: editor.getHTML() })
          break

        case 'continue':
          setIsAILoading(false)
          setIsStreaming(true)

          accumulatedText = '\n\n' // Start with newline separators

          await AI.continueWritingStream(content, (chunk) => {
            accumulatedText += chunk
            const fullNewContent = content + accumulatedText
            updateEditor(fullNewContent)
          })

          // Final flush
          applyUpdate(content + accumulatedText)

          setIsStreaming(false)
          if (note) updateNote(note.id, { content: editor.getHTML() })
          break

        case 'improve':
          setIsAILoading(false)
          setIsStreaming(true)

          accumulatedText = ''
          await AI.improveWritingStream(content, (chunk) => {
            accumulatedText += chunk
            updateEditor(accumulatedText)
          })

          // Final flush
          applyUpdate(accumulatedText)

          setIsStreaming(false)
          if (note) updateNote(note.id, { content: editor.getHTML() })
          break

        case 'translate':
          if (!extra) {
            setIsAILoading(false)
            return
          }
          setIsAILoading(false)
          setIsStreaming(true)

          accumulatedText = ''
          await AI.translateStream(content, extra, (chunk) => {
            accumulatedText += chunk
            updateEditor(accumulatedText)
          })

          // Final flush
          applyUpdate(accumulatedText)

          setIsStreaming(false)
          if (note) updateNote(note.id, { content: editor.getHTML() })
          break

        case 'tone':
          if (!extra) {
            setIsAILoading(false)
            return
          }
          setIsAILoading(false)
          setIsStreaming(true)

          accumulatedText = ''
          await AI.changeToneStream(content, extra, (chunk) => {
            accumulatedText += chunk
            updateEditor(accumulatedText)
          })

          // Final flush
          applyUpdate(accumulatedText)

          setIsStreaming(false)
          if (note) updateNote(note.id, { content: editor.getHTML() })
          break

        case 'extract-tasks':
          setIsAILoading(false)
          setIsStreaming(true)

          accumulatedText = ''
          await AI.extractTasksStream(content, (chunk) => {
            accumulatedText += chunk
            updateEditor(accumulatedText, true) // asTaskList = true
          })

          // Final flush
          applyUpdate(accumulatedText, true)

          setIsStreaming(false)
          if (note) updateNote(note.id, { content: editor.getHTML() })
          break
      }
    } catch (error) {
      console.error('AI error:', error)
      if (error instanceof InsufficientCreditsError) {
        setShowCreditsError(true)
        // Restore content if it was cleared
        if (typeof replaceActions !== 'undefined' && replaceActions.includes(action)) {
          editor.commands.setContent(note.content || '')
        }
      } else {
        setAiError((error as Error).message || t('ai.error'))
      }
      setIsAILoading(false)
      setIsSummarizing(false)
      setIsStreaming(false)
    }
  }

  const onAnalyzeImage = async (file: File, type: string) => {
    if (!editor || isStreaming) return

    // Check network
    if (!isOnline) {
      showNetworkOverlay(t('ai.title'))
      return
    }

    setIsAnalyzingImage(true)
    setIsStreaming(true) // Show streaming indicator in editor if needed

    const selection = editor.state.selection
    const isSelectionMode = !selection.empty
    const startPos = selection.from
    let endPos = selection.to

    if (isSelectionMode) {
      editor.commands.deleteSelection()
      endPos = startPos
    }

    // Helper to apply updates
    const applyUpdate = (fullText: string) => {
      const html = marked.parse(fullText, { async: false }) as string
      // Always insert at cursor/selection-start
      editor.commands.setTextSelection({ from: startPos, to: endPos })
      editor.commands.insertContent(html)
      // Update endPos to match the new end of inserted content
      endPos = editor.state.selection.to
    }

    // Rate limited update
    let lastUpdate = 0
    const updateEditor = (fullText: string) => {
      const now = Date.now()
      if (now - lastUpdate > 50) {
        applyUpdate(fullText)
        lastUpdate = now
      }
    }

    try {
      let accumulatedText = ''

      if (type === 'whiteboard') {
        accumulatedText += '\n' // Start on new line
      }

      await AI.analyzeImageStream(file, type, (chunk) => {
        accumulatedText += chunk
        updateEditor(accumulatedText)
      })

      // Final flush
      applyUpdate(accumulatedText)

      setIsStreaming(false)
      setIsAnalyzingImage(false)
      setShowImageAnalysis(false)
      if (note) updateNote(note.id, { content: editor.getHTML() })

    } catch (error) {
      console.error('Image Analysis Error:', error)
      setIsStreaming(false)
      setIsAnalyzingImage(false)
      if (error instanceof InsufficientCreditsError) {
        setShowImageAnalysis(false)
        setShowCreditsError(true)
      } else {
        setAiError((error as Error).message || t('ai.error'))
      }
    }
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

      <ImageAnalysisModal
        open={showImageAnalysis}
        onOpenChange={setShowImageAnalysis}
        onAnalyze={onAnalyzeImage}
        isAnalyzing={isAnalyzingImage}
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
            // Use streaming API
            const aiMessageId = (Date.now() + 1).toString()
            const aiMessage: AIChatMessage = {
              id: aiMessageId,
              role: 'assistant',
              content: '',
              timestamp: Date.now()
            }

            // Add empty message first
            setChatMessages(prev => [...prev, aiMessage])

            // let's accumulate and call onStream (which updates AIChatView's buffer).

            let accumulated = ''

            await AI.askAIStream(content, question, (chunk) => {
              accumulated += chunk
              // Update AIChatView's visual stream
              if (onStream) onStream(aiMessageId, accumulated)
            })

            setIsAskAILoading(false)

            // Final state update
            setChatMessages(prev => prev.map(m =>
              m.id === aiMessageId ? { ...m, content: accumulated } : m
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
        headerIcon={<Trash2 className="w-5 h-5" />}
      />

      <ShareDialog
        open={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        noteId={note.id}
        existingRoomId={roomId}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        onStopSharing={handleStopSharing}
      />

      <VersionHistoryPanel
        open={showVersionHistory}
        onClose={() => setShowVersionHistory(false)}
        driveFileId={note.driveFileId}
        onRestore={handleRestoreVersion}
      />

      <DrawingErrorBoundary onReset={() => setShowDrawingModal(false)}>
        <DrawingModal
          open={showDrawingModal}
          onClose={() => setShowDrawingModal(false)}
          onSave={(imageDataUrl) => {
            // Insert drawing as image into editor
            editor?.chain().focus().setImage({ src: imageDataUrl }).run()
          }}
        />
      </DrawingErrorBoundary>

      <InputDialog
        open={showLinkDialog}
        onClose={() => setShowLinkDialog(false)}
        onConfirm={(url) => {
          editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
        }}
        title={t('editor.insertLink')}
        placeholder={t('editor.linkPrompt')}
        inputType="url"
        headerIcon={<LinkIcon className="w-5 h-5" />}
      />

      <TableInsertDialog
        open={showTableInsertDialog}
        onClose={() => setShowTableInsertDialog(false)}
        onInsert={handleInsertTable}
      />

      <TablePropertiesDialog
        open={showTablePropertiesDialog}
        onClose={() => setShowTablePropertiesDialog(false)}
        editor={editor}
      />

      {/* Collaboration indicator - Mobile (title is now in NoteModal header) */}
      {roomId && collaborators.length > 0 && (
        <div className="md:hidden flex items-center gap-1 px-4 pt-2">
          <div className="flex -space-x-1">
            {collaborators.slice(0, 2).map((collab, i) => (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  {collab.picture ? (
                    <img
                      src={collab.picture}
                      alt={collab.name}
                      className="w-5 h-5 rounded-full border border-white dark:border-neutral-900 object-cover"
                    />
                  ) : (
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-medium text-white border border-white dark:border-neutral-900"
                      style={{ backgroundColor: collab.color }}
                    >
                      {collab.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </TooltipTrigger>
                <TooltipContent side="bottom">{collab.name}</TooltipContent>
              </Tooltip>
            ))}
          </div>
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
        </div>
      )}

      {/* Scrollable Content Area - includes back button, title, pin */}
      <div
        ref={editorContainerRef}
        className="flex-1 overflow-y-auto px-4 relative"
      >
        {/* Header row - Back + Title + Pin - scrolls with content on all devices */}
        <div className="flex items-center gap-2 pt-4 pb-2 min-w-0">
          {/* Back button - on mobile always, on desktop only when fullscreen */}
          <button
            onClick={onClose}
            className={cn(
              "p-1.5 -ml-2 rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shrink-0",
              isFullscreen ? "flex" : "md:hidden"
            )}
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

          {/* Collaboration indicator - Desktop only (mobile has its own above) */}
          {roomId && collaborators.length > 0 && (
            <div className="hidden md:flex items-center gap-1">
              <div className="flex -space-x-1">
                {collaborators.slice(0, 3).map((collab, i) => (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>
                      {collab.picture ? (
                        <img
                          src={collab.picture}
                          alt={collab.name}
                          className="w-6 h-6 rounded-full border-2 border-white dark:border-neutral-900 object-cover"
                        />
                      ) : (
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium text-white border-2 border-white dark:border-neutral-900"
                          style={{ backgroundColor: collab.color }}
                        >
                          {collab.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{collab.name}</TooltipContent>
                  </Tooltip>
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
          <EditorContextMenu
            editor={editor}
            onOpenTableProperties={() => setShowTablePropertiesDialog(true)}
            onAskAI={(text) => {
              setAiContextText(text)
              setShowAIChatView(true)
            }}
          >
            <div className="relative">
              {isSummarizing && (
                <div className="px-4 py-4 space-y-2 animate-in fade-in slide-in-from-top-4 duration-300">
                  <Skeleton className="h-6 w-1/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <hr className="my-4 border-neutral-200 dark:border-neutral-700" />
                </div>
              )}
              <EditorContent
                editor={editor}
                className="min-h-[200px] text-neutral-700 dark:text-neutral-300"
              />
              {/* Collaboration cursors overlay */}
              {isCollaborationReady && provider && (
                <CollaborationCursors
                  editor={editor}
                  provider={provider}
                />
              )}
            </div>
          </EditorContextMenu>
        )}
      </div>

      {/* Footer Toolbar */}
      <div
        ref={toolbarRef}
        className="flex items-center justify-between py-1.5 bg-neutral-100/80 dark:bg-neutral-800/60 backdrop-blur-sm safe-x relative rounded-b-[12px] safe-bottom"
      >
        {/* AI Modals - positioned above toolbar */}


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
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2 text-sm text-red-700 dark:text-red-300">
              {aiError}
            </div>
          </div>
        )}

        <div ref={toolbarScrollRef} className="flex items-center gap-0.5 overflow-x-auto scrollbar-none" style={{ touchAction: 'pan-x' }}>
          {/* AI Menu - Priority 1 (always visible) */}
          {toolbarVisibility.ai && (
            <AIMenu
              onAction={handleAIAction}
              disabled={!isOnline || isAILoading || isStreaming}
            />
          )}

          {/* Speech to Text - Priority 1 */}
          {toolbarVisibility.voice && (
            <SpeechButton
              onTranscript={(text, isFinal, replaceLength) => {
                if (editor) {
                  // Delete previous interim text if needed
                  if (replaceLength && replaceLength > 0) {
                    // Move cursor back and delete the interim text
                    const { from } = editor.state.selection
                    const deleteFrom = Math.max(0, from - replaceLength)
                    editor.chain()
                      .deleteRange({ from: deleteFrom, to: from })
                      .insertContent(text + (isFinal ? ' ' : ''))
                      .run()
                  } else {
                    // Just insert new text
                    editor.commands.insertContent(text + (isFinal ? ' ' : ''))
                  }
                }
              }}
              disabled={isAILoading || isStreaming}
            />
          )}

          {/* Primary formatting tools - Priority 1 */}
          {toolbarVisibility.bold && (
            <ToolbarButton
              onClick={() => editor?.chain().toggleBold().run()}
              active={editor?.isActive('bold')}
              tooltip={t('editor.bold')}
            >
              <Bold className="w-[18px] h-[18px]" />
            </ToolbarButton>
          )}
          {toolbarVisibility.italic && (
            <ToolbarButton
              onClick={() => editor?.chain().toggleItalic().run()}
              active={editor?.isActive('italic')}
              tooltip={t('editor.italic')}
            >
              <Italic className="w-[18px] h-[18px]" />
            </ToolbarButton>
          )}
          {toolbarVisibility.underline && (
            <ToolbarButton
              onClick={() => editor?.chain().toggleUnderline().run()}
              active={editor?.isActive('underline')}
              tooltip={t('editor.underline')}
            >
              <UnderlineIcon className="w-[18px] h-[18px]" />
            </ToolbarButton>
          )}

          {/* Priority 2 - sm+ */}
          {toolbarVisibility.strikethrough && (
            <ToolbarButton
              onClick={() => editor?.chain().toggleStrike().run()}
              active={editor?.isActive('strike')}
              tooltip={t('editor.strikethrough')}
            >
              <Strikethrough className="w-[18px] h-[18px]" />
            </ToolbarButton>
          )}
          {toolbarVisibility.highlight && (
            <ToolbarButton
              onClick={() => editor?.chain().toggleHighlight().run()}
              active={editor?.isActive('highlight')}
              tooltip={t('editor.highlight')}
            >
              <Highlighter className="w-[18px] h-[18px]" />
            </ToolbarButton>
          )}

          {/* Headings - Priority 2 & 3 */}
          {toolbarVisibility.heading1 && (
            <ToolbarButton
              onClick={() => editor?.chain().toggleHeading({ level: 1 }).run()}
              active={editor?.isActive('heading', { level: 1 })}
              tooltip={t('editor.heading1')}
            >
              <Heading1 className="w-[18px] h-[18px]" />
            </ToolbarButton>
          )}
          {toolbarVisibility.heading2 && (
            <ToolbarButton
              onClick={() => editor?.chain().toggleHeading({ level: 2 }).run()}
              active={editor?.isActive('heading', { level: 2 })}
              tooltip={t('editor.heading2')}
            >
              <Heading2 className="w-[18px] h-[18px]" />
            </ToolbarButton>
          )}
          {toolbarVisibility.heading3 && (
            <ToolbarButton
              onClick={() => editor?.chain().toggleHeading({ level: 3 }).run()}
              active={editor?.isActive('heading', { level: 3 })}
              tooltip={t('editor.heading3')}
            >
              <Heading3 className="w-[18px] h-[18px]" />
            </ToolbarButton>
          )}

          {/* Lists - Priority 2 & 3 */}
          {toolbarVisibility.bulletList && (
            <ToolbarButton
              onClick={() => editor?.chain().toggleBulletList().run()}
              active={editor?.isActive('bulletList')}
              tooltip={t('editor.bulletList')}
            >
              <List className="w-[18px] h-[18px]" />
            </ToolbarButton>
          )}
          {toolbarVisibility.orderedList && (
            <ToolbarButton
              onClick={() => editor?.chain().toggleOrderedList().run()}
              active={editor?.isActive('orderedList')}
              tooltip={t('editor.numberedList')}
            >
              <ListOrdered className="w-[18px] h-[18px]" />
            </ToolbarButton>
          )}
          {toolbarVisibility.taskList && (
            <ToolbarButton
              onClick={() => editor?.chain().toggleTaskList().run()}
              active={editor?.isActive('taskList')}
              tooltip={t('editor.taskList')}
            >
              <CheckSquare className="w-[18px] h-[18px]" />
            </ToolbarButton>
          )}

          {/* Table - Priority 3 */}
          {toolbarVisibility.table && (
            <ToolbarButton
              onClick={() => setShowTableInsertDialog(true)}
              active={editor?.isActive('table')}
              tooltip={t('editor.insertTable')}
            >
              <TableIcon className="w-[18px] h-[18px]" />
            </ToolbarButton>
          )}

          {/* Table operations are now handled by TableContextMenu (right-click) */}

          {/* Text alignment - Priority 3 & 4 */}
          {toolbarVisibility.alignLeft && (
            <ToolbarButton
              onClick={() => editor?.chain().setTextAlign('left').run()}
              active={editor?.isActive({ textAlign: 'left' })}
              tooltip={t('editor.alignLeft')}
            >
              <AlignLeft className="w-[18px] h-[18px]" />
            </ToolbarButton>
          )}
          {toolbarVisibility.alignCenter && (
            <ToolbarButton
              onClick={() => editor?.chain().setTextAlign('center').run()}
              active={editor?.isActive({ textAlign: 'center' })}
              tooltip={t('editor.alignCenter')}
            >
              <AlignCenter className="w-[18px] h-[18px]" />
            </ToolbarButton>
          )}
          {toolbarVisibility.alignRight && (
            <ToolbarButton
              onClick={() => editor?.chain().setTextAlign('right').run()}
              active={editor?.isActive({ textAlign: 'right' })}
              tooltip={t('editor.alignRight')}
            >
              <AlignRight className="w-[18px] h-[18px]" />
            </ToolbarButton>
          )}
          {toolbarVisibility.alignJustify && (
            <ToolbarButton
              onClick={() => editor?.chain().setTextAlign('justify').run()}
              active={editor?.isActive({ textAlign: 'justify' })}
              tooltip={t('editor.alignJustify')}
            >
              <AlignJustify className="w-[18px] h-[18px]" />
            </ToolbarButton>
          )}

          {/* Code & Quote - Priority 4 */}
          {toolbarVisibility.inlineCode && (
            <ToolbarButton
              onClick={() => editor?.chain().toggleCode().run()}
              active={editor?.isActive('code')}
              tooltip={t('editor.inlineCode')}
            >
              <Code className="w-[18px] h-[18px]" />
            </ToolbarButton>
          )}
          {toolbarVisibility.codeBlock && (
            <ToolbarButton
              onClick={() => editor?.chain().toggleCodeBlock().run()}
              active={editor?.isActive('codeBlock')}
              tooltip={t('editor.codeBlock')}
            >
              <Code2 className="w-[18px] h-[18px]" />
            </ToolbarButton>
          )}
          {toolbarVisibility.blockquote && (
            <ToolbarButton
              onClick={() => editor?.chain().toggleBlockquote().run()}
              active={editor?.isActive('blockquote')}
              tooltip={t('editor.blockquote')}
            >
              <Quote className="w-[18px] h-[18px]" />
            </ToolbarButton>
          )}

          {/* Subscript & Superscript - Priority 5 */}
          {toolbarVisibility.subscript && (
            <ToolbarButton
              onClick={() => editor?.chain().toggleSubscript().run()}
              active={editor?.isActive('subscript')}
              tooltip={t('editor.subscript')}
            >
              <SubscriptIcon className="w-[18px] h-[18px]" />
            </ToolbarButton>
          )}
          {toolbarVisibility.superscript && (
            <ToolbarButton
              onClick={() => editor?.chain().toggleSuperscript().run()}
              active={editor?.isActive('superscript')}
              tooltip={t('editor.superscript')}
            >
              <SuperscriptIcon className="w-[18px] h-[18px]" />
            </ToolbarButton>
          )}

          {/* Link - Priority 4 */}
          {toolbarVisibility.link && (
            <ToolbarButton
              onClick={() => {
                if (editor?.isActive('link')) {
                  editor.chain().unsetLink().run()
                } else {
                  setShowLinkDialog(true)
                }
              }}
              active={editor?.isActive('link')}
              tooltip={editor?.isActive('link') ? t('editor.removeLink') : t('editor.insertLink')}
            >
              {editor?.isActive('link') ? <Unlink className="w-[18px] h-[18px]" /> : <LinkIcon className="w-[18px] h-[18px]" />}
            </ToolbarButton>
          )}

          {/* Horizontal rule - Priority 5 */}
          {toolbarVisibility.horizontalRule && (
            <ToolbarButton
              onClick={() => editor?.chain().setHorizontalRule().run()}
              tooltip={t('editor.horizontalRule')}
            >
              <Minus className="w-[18px] h-[18px]" />
            </ToolbarButton>
          )}

          {/* Clear formatting - Priority 5 */}
          {toolbarVisibility.clearFormatting && (
            <ToolbarButton
              onClick={() => editor?.chain().clearNodes().unsetAllMarks().run()}
              tooltip={t('editor.clearFormatting')}
            >
              <RemoveFormatting className="w-[18px] h-[18px]" />
            </ToolbarButton>
          )}

          {/* Image & Drawing - Priority 5 */}
          {toolbarVisibility.image && (
            <ToolbarButton onClick={addImage} tooltip={t('editor.insertImage')}>
              <ImagePlus className="w-[18px] h-[18px]" />
            </ToolbarButton>
          )}

          {toolbarVisibility.drawing && (
            <ToolbarButton
              onClick={() => setShowDrawingModal(true)}
              tooltip={t('drawing.insert')}
            >
              <Pencil className="w-[18px] h-[18px]" />
            </ToolbarButton>
          )}

          {toolbarVisibility.style && (
            <NoteStylePicker
              style={note.style}
              onChange={handleStyleChange}
            />
          )}

          {/* Undo/Redo - Priority 1 */}
          {toolbarVisibility.undo && (
            <ToolbarButton
              onClick={() => editor?.chain().undo().run()}
              disabled={!editor?.can().undo()}
              tooltip={t('editor.undo')}
            >
              <Undo2 className="w-[18px] h-[18px]" />
            </ToolbarButton>
          )}
          {toolbarVisibility.redo && (
            <ToolbarButton
              onClick={() => editor?.chain().redo().run()}
              disabled={!editor?.can().redo()}
              tooltip={t('editor.redo')}
            >
              <Redo2 className="w-[18px] h-[18px]" />
            </ToolbarButton>
          )}

          {/* Export/Import menu - Priority 5 */}
          {toolbarVisibility.exportImport && (
            <NoteActionsMenu
              noteTitle={note.title}
              noteContent={editor?.getHTML() || note.content}
              onImport={handleImportDocument}
              disabled={isAILoading || isStreaming}
            />
          )}

          {/* Share - Priority 5 */}
          {toolbarVisibility.share && (
            <ToolbarButton
              onClick={() => roomId ? handleStopSharing() : setShowShareDialog(true)}
              active={!!roomId}
              disabled={!isOnline && !roomId} // Disable when offline and not already in a room
              tooltip={
                !isOnline && !roomId
                  ? t('offline.networkRequired')
                  : roomId ? t('editor.stopSharing') : t('editor.collaborate')
              }
            >
              {roomId ? <Users className="w-[18px] h-[18px]" /> : <Share2 className="w-[18px] h-[18px]" />}
            </ToolbarButton>
          )}

          {/* History - Priority 5 */}
          {toolbarVisibility.history && (
            <ToolbarButton
              onClick={() => setShowVersionHistory(true)}
              disabled={!isOnline}
              tooltip={!isOnline ? t('offline.networkRequired') : t('editor.versionHistory')}
            >
              <History className="w-[18px] h-[18px]" />
            </ToolbarButton>
          )}

          {/* Delete - Priority 1 */}
          {toolbarVisibility.delete && (
            <ToolbarButton
              onClick={() => setShowDeleteDialog(true)}
              tooltip={t('notes.delete')}
            >
              <Trash2 className="w-[18px] h-[18px]" />
            </ToolbarButton>
          )}

          {/* Fullscreen - Priority 5 */}
          {toolbarVisibility.fullscreen && onToggleFullscreen && canToggleFullscreen && (
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
            "px-3 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-[8px] transition-colors whitespace-nowrap shrink-0",
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
