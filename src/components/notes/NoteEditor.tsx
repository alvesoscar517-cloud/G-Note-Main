import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { EditorContent } from '@tiptap/react'
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
  ArrowLeft,
  Table as TableIcon
} from 'lucide-react'
import { useNotesStore } from '@/stores/notesStore'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
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
import { EditorSkeleton, Skeleton } from '@/components/ui/Skeleton'
import { useNetworkRequiredOverlay } from '@/components/ui/OfflineIndicator'
import { useResponsiveToolbar } from '@/hooks/useResponsiveToolbar'
import { TableInsertDialog } from './table/TableInsertDialog'
import { EditorContextMenu } from './EditorContextMenu'
import { TablePropertiesDialog } from './table/TablePropertiesDialog'
import { DrawingModal } from './DrawingModal'
import { ImageAnalysisModal } from './ImageAnalysisModal'
import { CollaborationCursors } from './CollaborationCursors'
import { useScrollableDrag } from '@/hooks/useScrollableDrag'
import { useCollaboration } from '@/hooks/useCollaboration'
import { useNoteEditor } from '@/hooks/useNoteEditor'
import { useNoteAI } from '@/hooks/useNoteAI'
import type { Note, NoteStyle } from '@/types'

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
  isFreeMode?: boolean // Hide close button and lock fullscreen in free mode
  onLockedFeatureClick?: (featureName: string) => void // Callback when locked feature is clicked in free mode
  customUpdateHandler?: (updates: Partial<Note>) => void // Custom update handler for free mode (bypasses store)
}

export function NoteEditor({ note, onClose, onTogglePin, isPinned, isFullscreen, canToggleFullscreen = true, onToggleFullscreen, isFreeMode = false, onLockedFeatureClick, customUpdateHandler }: NoteEditorProps) {
  const { t } = useTranslation()
  const { updateNote, deleteNote } = useNotesStore()
  const { user } = useAuthStore()
  const isOnline = useAppStore(state => state.isOnline)

  // Network required overlay for offline handling
  const { OverlayComponent: NetworkOverlay } = useNetworkRequiredOverlay()

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showTableInsertDialog, setShowTableInsertDialog] = useState(false)
  const [showTablePropertiesDialog, setShowTablePropertiesDialog] = useState(false)
  const [showDrawingModal, setShowDrawingModal] = useState(false)
  const [showLinkDialog, setShowLinkDialog] = useState(false)

  const [roomId, setRoomId] = useState<string | null>(null)
  const [isRoomHost, setIsRoomHost] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  // Use hooks
  const {
    provider,
    ydoc,
    isProviderReady,
    collaborators,
    awarenessDoc
  } = useCollaboration({
    roomId,
    userInfo: user ? { name: user.name, avatar: user.avatar } : null
  })

  // Determine if collaboration mode is fully ready
  const isCollaborationReady = !!(
    roomId &&
    ydoc &&
    provider &&
    isProviderReady &&
    awarenessDoc
  )

  const {
    editor,
    lastSavedContentRef,
    debouncedUpdate
  } = useNoteEditor({
    note,
    roomId,
    isCollaborationReady,
    provider,
    ydoc,
    awarenessDoc,
    isRoomHost,
    customUpdateHandler
  })

  const {
    isAILoading,
    isAskAILoading,
    isStreaming,
    isContinuing,
    showAIChatView,
    setShowAIChatView,
    chatMessages,
    isSummarizing,
    aiContextText,
    setAiContextText,
    aiError,
    showCreditsError,
    setShowCreditsError,
    showImageAnalysis,
    setShowImageAnalysis,
    isAnalyzingImage,
    handleAIAction,
    onAnalyzeImage,
    askAI,
    editorContainerRef,
    getEditorText
  } = useNoteAI({
    editor,
    note,
    t
  })

  // Get live driveFileId from store (optimized: only subscribe to driveFileId changes)
  const liveDriveFileId = useNotesStore(state =>
    state.notes.find(n => n.id === note.id)?.driveFileId
  ) ?? note.driveFileId

  // Responsive toolbar visibility
  const toolbarVisibility = useResponsiveToolbar(toolbarRef)

  // Scrollable drag for toolbar
  const toolbarScrollRef = useScrollableDrag<HTMLDivElement>()

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
    if (isFreeMode) {
      // In free mode, reset note content instead of deleting
      updateNote(note.id, {
        title: '',
        content: '',
        style: undefined
      })
      setShowDeleteDialog(false)
    } else {
      // Normal mode: delete the note
      deleteNote(note.id)
      onClose()
    }
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
    if (editor && note.id) {
      const content = editor.getHTML()
      if (content !== lastSavedContentRef.current) {
        lastSavedContentRef.current = content
        updateNote(note.id, { content })
      }
    }
    setRoomId(null)
    setIsRoomHost(false)
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
      if (customUpdateHandler) {
        customUpdateHandler({ style })
      } else {
        updateNote(note.id, { style })
      }
    }
  }

  const handleImportDocument = useCallback((title: string, content: string) => {
    if (!editor || !note) return

    // Update title if imported file has one and current note is untitled
    if (title && !note.title) {
      if (customUpdateHandler) {
        customUpdateHandler({ title })
      } else {
        updateNote(note.id, { title })
      }
    }

    // Set content to editor (should rely on editor prop, but here we update editor and sync)
    editor.commands.setContent(content)
    debouncedUpdate(note.id, content)
  }, [editor, note, updateNote, debouncedUpdate, customUpdateHandler])


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

      <AIChatView
        open={showAIChatView}
        onClose={() => setShowAIChatView(false)}
        noteContent={aiContextText || getEditorText()}
        contextText={aiContextText}
        onClearContext={() => setAiContextText('')}
        initialMessages={chatMessages}
        isLoading={isAskAILoading}
        onSendMessage={askAI}
        onInsufficientCredits={() => {
          setShowAIChatView(false)
          setShowCreditsError(true)
        }}
      />

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
        driveFileId={liveDriveFileId}
        onRestore={handleRestoreVersion}
      />

      <DrawingErrorBoundary onReset={() => setShowDrawingModal(false)}>
        <DrawingModal
          open={showDrawingModal}
          onClose={() => setShowDrawingModal(false)}
          onSave={(imageDataUrl) => {
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

      {/* Collaboration indicator - Mobile */}
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

      {/* Scrollable Content Area */}
      <div
        ref={editorContainerRef}
        className="flex-1 overflow-y-auto px-4 relative"
      >
        <div className="flex items-center gap-2 pt-4 pb-2 min-w-0">
          {!isFreeMode && (
            <button
              onClick={onClose}
              className={cn(
                "p-1.5 -ml-2 rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shrink-0",
                isFullscreen ? "flex" : "md:hidden"
              )}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="flex-1 min-w-0">
            <EditableTitle
              value={note.title}
              onChange={(value) => {
                if (customUpdateHandler) {
                  customUpdateHandler({ title: value })
                } else {
                  updateNote(note.id, { title: value })
                }
              }}
              placeholder={t('notes.title')}
              className="text-xl font-medium text-neutral-900 dark:text-white"
            />
          </div>

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

          {!isFreeMode && (
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
          )}
        </div>

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
              {isContinuing && (
                <div className="px-4 py-2 space-y-2 animate-pulse opacity-50">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-4/6" />
                </div>
              )}
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
        <InsufficientCreditsModal
          open={showCreditsError}
          onClose={() => setShowCreditsError(false)}
          onBuyCredits={() => {
            onClose()
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('open-credits-modal'))
            }, 100)
          }}
        />

        {aiError && (
          <div className="absolute inset-x-0 bottom-full mb-2 px-4 z-20">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2 text-sm text-red-700 dark:text-red-300">
              {aiError}
            </div>
          </div>
        )}

        <div ref={toolbarScrollRef} className="flex items-center gap-1 overflow-x-auto scrollbar-none h-10 sm:h-8" style={{ touchAction: 'pan-x' }}>
          {toolbarVisibility.ai && (
            isFreeMode && onLockedFeatureClick ? (
              <ToolbarButton
                onClick={() => onLockedFeatureClick(t('ai.title'))}
                tooltip={t('freeNote.featureLocked')}
              >
                <Sparkles className="w-[18px] h-[18px]" />
              </ToolbarButton>
            ) : (
              <AIMenu
                onAction={handleAIAction}
                disabled={!isOnline || isAILoading || isStreaming}
              />
            )
          )}

          {toolbarVisibility.voice && (
            <SpeechButton
              onTranscript={(text, isFinal, replaceLength) => {
                if (editor) {
                  if (replaceLength && replaceLength > 0) {
                    const { from } = editor.state.selection
                    const deleteFrom = Math.max(0, from - replaceLength)
                    editor.chain()
                      .deleteRange({ from: deleteFrom, to: from })
                      .insertContent(text + (isFinal ? ' ' : ''))
                      .run()
                  } else {
                    editor.commands.insertContent(text + (isFinal ? ' ' : ''))
                  }
                }
              }}
              disabled={isAILoading || isStreaming}
            />
          )}

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

          {toolbarVisibility.table && (
            <ToolbarButton
              onClick={() => setShowTableInsertDialog(true)}
              active={editor?.isActive('table')}
              tooltip={t('editor.insertTable')}
            >
              <TableIcon className="w-[18px] h-[18px]" />
            </ToolbarButton>
          )}

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

          {toolbarVisibility.horizontalRule && (
            <ToolbarButton
              onClick={() => editor?.chain().setHorizontalRule().run()}
              tooltip={t('editor.horizontalRule')}
            >
              <Minus className="w-[18px] h-[18px]" />
            </ToolbarButton>
          )}

          {toolbarVisibility.clearFormatting && (
            <ToolbarButton
              onClick={() => editor?.chain().clearNodes().unsetAllMarks().run()}
              tooltip={t('editor.clearFormatting')}
            >
              <RemoveFormatting className="w-[18px] h-[18px]" />
            </ToolbarButton>
          )}

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

          {toolbarVisibility.exportImport && (
            <NoteActionsMenu
              noteTitle={note.title}
              noteContent={editor?.getHTML() || note.content}
              onImport={handleImportDocument}
              disabled={isAILoading || isStreaming}
            />
          )}

          {toolbarVisibility.share && (
            <ToolbarButton
              onClick={
                isFreeMode && onLockedFeatureClick
                  ? () => onLockedFeatureClick(t('share.title'))
                  : !isOnline && !roomId
                    ? undefined
                    : () => roomId ? handleStopSharing() : setShowShareDialog(true)
              }
              active={!!roomId}
              disabled={!isFreeMode && (!isOnline && !roomId)}
              tooltip={
                isFreeMode
                  ? t('freeNote.featureLocked')
                  : !isOnline && !roomId
                    ? t('offline.networkRequired')
                    : roomId ? t('editor.stopSharing') : t('editor.collaborate')
              }
            >
              {roomId ? <Users className="w-[18px] h-[18px]" /> : <Share2 className="w-[18px] h-[18px]" />}
            </ToolbarButton>
          )}

          {toolbarVisibility.history && (
            <ToolbarButton
              onClick={
                isFreeMode && onLockedFeatureClick
                  ? () => onLockedFeatureClick(t('versionHistory.title'))
                  : !isOnline
                    ? undefined
                    : () => setShowVersionHistory(true)
              }
              disabled={!isFreeMode && !isOnline}
              tooltip={isFreeMode ? t('freeNote.featureLocked') : !isOnline ? t('offline.networkRequired') : t('editor.versionHistory')}
            >
              <History className="w-[18px] h-[18px]" />
            </ToolbarButton>
          )}

          {toolbarVisibility.delete && (
            <ToolbarButton
              onClick={() => setShowDeleteDialog(true)}
              tooltip={t('notes.delete')}
            >
              <Trash2 className="w-[18px] h-[18px]" />
            </ToolbarButton>
          )}

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

        {!isFreeMode && (
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
        )}
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
  const button = (
    <button
      onPointerDown={(e) => {
        // Prevent focus loss on both mouse and touch interactions
        e.preventDefault()
      }}
      onClick={() => {
        if (onClick && !disabled) {
          onClick()
        }
      }}
      disabled={disabled}
      className={cn(
        // Mobile: comfortable touch target (40x40 is enough when grouped)
        // Fixed size on mobile (w-10 = 40px), auto on desktop
        'flex items-center justify-center rounded-full transition-colors flex-shrink-0',
        'w-10 h-10 aspect-square',
        'sm:w-8 sm:h-8',
        'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700',
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
