import { useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { MobileScrollableTable } from '@/components/notes/table/MobileScrollableTable'
import { initTableScrollIndicators } from '@/components/notes/table/tableScrollIndicators'
import { ResizableImage } from '@/components/notes/ResizableImageExtension'
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
import Collaboration from '@tiptap/extension-collaboration'
import { useDebouncedCallback } from 'use-debounce'
import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import type { Note } from '@/types'
import { useNotesStore } from '@/stores/notesStore'

export interface UseNoteEditorProps {
    note: Note
    roomId: string | null
    isCollaborationReady: boolean
    provider: WebrtcProvider | null
    ydoc: Y.Doc | null
    awarenessDoc: Y.Doc | null
    isRoomHost: boolean
    customUpdateHandler?: (updates: Partial<Note>) => void
}

export function useNoteEditor({
    note,
    roomId,
    isCollaborationReady,
    provider,
    ydoc,
    awarenessDoc,
    isRoomHost,
    customUpdateHandler
}: UseNoteEditorProps) {
    const { t } = useTranslation()
    const { updateNote } = useNotesStore()

    // Track note ID to detect when note changes
    const currentNoteIdRef = useRef(note.id)
    const isFirstRender = useRef(true)

    // Track last saved content to avoid unnecessary saves
    const lastSavedContentRef = useRef<string>(note.content || '')

    // Store note.id in ref to use in editor callback (avoids stale closure)
    const noteIdRef = useRef(note.id)
    noteIdRef.current = note.id

    // Disable history when roomId is set (even before full collaboration ready)
    const shouldDisableHistory = !!roomId

    // Debounced update note content
    // Use ref to avoid stale closure with customUpdateHandler
    const customUpdateHandlerRef = useRef(customUpdateHandler)
    customUpdateHandlerRef.current = customUpdateHandler

    const debouncedUpdate = useDebouncedCallback((id: string, content: string) => {
        lastSavedContentRef.current = content
        if (customUpdateHandlerRef.current) {
            customUpdateHandlerRef.current({ content })
        } else {
            updateNote(id, { content })
        }
    }, 300)

    // Use ref for translation to avoid extensions recreation on language change
    const tRef = useRef(t)
    tRef.current = t

    // Memoize extensions - only recreate when collaboration state changes
    const extensions = useMemo(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const baseExtensions: any[] = [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
                codeBlock: false,
                // Disable history when in collaboration mode (y-prosemirror handles it)
                ...(shouldDisableHistory ? { history: false } : {}),
                link: false,
                underline: false,
            }),
            CodeBlockLowlight.configure({
                lowlight: createLowlight(common),
                defaultLanguage: 'javascript',
                HTMLAttributes: {
                    class: 'hljs'
                }
            }),
            Placeholder.configure({
                placeholder: tRef.current('notes.placeholder')
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
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-blue-500 underline cursor-pointer'
                }
            }),
            Underline,
            Markdown.configure({
                html: true,
                transformPastedText: true,
                transformCopiedText: false,
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
        if (isCollaborationReady && ydoc && provider && awarenessDoc) {
            baseExtensions.push(
                Collaboration.configure({
                    document: ydoc,
                    field: 'prosemirror',
                })
            )
        }

        return baseExtensions
        // Minimal dependencies - only what actually affects extensions
    }, [isCollaborationReady, shouldDisableHistory, ydoc, provider, awarenessDoc])

    // Editor instantiation
    const editor = useEditor({
        extensions,
        content: isCollaborationReady ? '' : (note.content || ''),
        onUpdate: ({ editor }) => {
            // Only trigger local updates if NOT in collaboration mode
            if (noteIdRef.current && !roomId) {
                debouncedUpdate(noteIdRef.current, editor.getHTML())
            }
        },
        editorProps: {
            attributes: {
                class: 'focus:outline-none'
            }
        },
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

    // Collaboration initialization logic
    useEffect(() => {
        if (!roomId || !provider || !editor || !ydoc || !isCollaborationReady) {
            return
        }

        const fragment = ydoc.getXmlFragment('prosemirror')
        let initTimeout: ReturnType<typeof setTimeout> | null = null
        let peerWaitTimeout: ReturnType<typeof setTimeout> | null = null

        console.log('[Collab] Collaboration ready, isHost:', isRoomHost, 'fragment length:', fragment.length)

        const initialContent = lastSavedContentRef.current || note.content

        if (isRoomHost && initialContent) {
            console.log('[Collab] Host initializing content...')

            const setInitialContent = () => {
                const currentFragment = ydoc.getXmlFragment('prosemirror')
                if (currentFragment.length === 0) {
                    console.log('[Collab] Setting initial content to Y.js document')
                    editor.commands.setContent(initialContent)
                } else {
                    console.log('[Collab] Fragment already has content, skipping init')
                }
            }

            initTimeout = setTimeout(setInitialContent, 500)

            peerWaitTimeout = setTimeout(() => {
                const currentFragment = ydoc.getXmlFragment('prosemirror')
                if (currentFragment.length === 0 && initialContent) {
                    console.log('[Collab] Re-setting content after peer wait')
                    editor.commands.setContent(initialContent)
                }
            }, 2000)
        } else if (!isRoomHost) {
            console.log('[Collab] Guest waiting for sync from host...')
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
            const finalContent = editor.getHTML()
            if (noteIdRef.current && finalContent !== lastSavedContentRef.current) {
                lastSavedContentRef.current = finalContent
                updateNote(noteIdRef.current, { content: finalContent })
            }
            clearInterval(autoSaveInterval)
        }
    }, [roomId, provider, editor, ydoc, isCollaborationReady, updateNote, isRoomHost, note.content])

    // Save on page unload or visibility change
    useEffect(() => {
        const saveCurrentContent = () => {
            if (editor && noteIdRef.current) {
                const content = editor.getHTML()
                if (content !== lastSavedContentRef.current) {
                    lastSavedContentRef.current = content
                    // Use sync update via store
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
            saveCurrentContent()
        }
    }, [editor])

    // Initialize scroll indicators
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

    return {
        editor,
        lastSavedContentRef,
        debouncedUpdate
    }
}
