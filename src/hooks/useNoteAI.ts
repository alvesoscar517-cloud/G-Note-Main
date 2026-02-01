import { useState, useRef, useEffect } from 'react'
import { Editor } from '@tiptap/react'
import { marked } from 'marked'
import * as AI from '@/lib/ai'
import { InsufficientCreditsError } from '@/lib/ai'
import { useAppStore, NetworkRequiredError } from '@/stores/appStore'
import { useNotesStore } from '@/stores/notesStore'
import { useNetworkRequiredOverlay } from '@/components/ui/OfflineIndicator'
import type { Note, AIChatMessage } from '@/types'

export interface UseNoteAIProps {
    editor: Editor | null
    note: Note
    t: (key: string) => string
}

export function useNoteAI({ editor, note, t }: UseNoteAIProps) {
    const { updateNote } = useNotesStore()
    const isOnline = useAppStore(state => state.isOnline)
    const { showOverlay: showNetworkOverlay } = useNetworkRequiredOverlay()

    // AI states
    const [isAILoading, setIsAILoading] = useState(false) // For actions that modify editor
    const [isAskAILoading, setIsAskAILoading] = useState(false) // For chat
    const [isStreaming, setIsStreaming] = useState(false)
    const [isContinuing, setIsContinuing] = useState(false)
    const [showAIChatView, setShowAIChatView] = useState(false) // Fullscreen chat view
    const [chatMessages, setChatMessages] = useState<AIChatMessage[]>(note.aiChatHistory || []) // Chat history from note
    const [isSummarizing, setIsSummarizing] = useState(false)
    const [aiContextText, setAiContextText] = useState('') // Text to use for AI query
    const [aiError, setAiError] = useState<string | null>(null)
    const [showCreditsError, setShowCreditsError] = useState(false)
    const [showImageAnalysis, setShowImageAnalysis] = useState(false)
    const [isAnalyzingImage, setIsAnalyzingImage] = useState(false)

    const editorContainerRef = useRef<HTMLDivElement>(null)

    // Clear AI error after 5 seconds
    useEffect(() => {
        if (aiError) {
            const timer = setTimeout(() => setAiError(null), 5000)
            return () => clearTimeout(timer)
        }
    }, [aiError])

    // Ref to track if we need to save chat history (avoids JSON.stringify on every render)
    const chatHistorySaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const lastSavedChatHistoryRef = useRef<string>(JSON.stringify(note.aiChatHistory || []))

    // Sync chat history when note changes
    useEffect(() => {
        setChatMessages(note.aiChatHistory || [])
        lastSavedChatHistoryRef.current = JSON.stringify(note.aiChatHistory || [])
    }, [note.id])

    // Save chat history to note when messages change (debounced and optimized)
    useEffect(() => {
        if (chatMessages.length === 0 || !note.id) return

        const currentJson = JSON.stringify(chatMessages)
        if (currentJson === lastSavedChatHistoryRef.current) return

        if (chatHistorySaveRef.current) {
            clearTimeout(chatHistorySaveRef.current)
        }

        chatHistorySaveRef.current = setTimeout(() => {
            lastSavedChatHistoryRef.current = currentJson
            updateNote(note.id, { aiChatHistory: chatMessages })
        }, 1000) // Increased debounce to 1s

        return () => {
            if (chatHistorySaveRef.current) {
                clearTimeout(chatHistorySaveRef.current)
            }
        }
    }, [chatMessages, note.id, updateNote])

    // Helper to scroll editor (if container ref attached)
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
            const match = line.match(/^[\s]*[-*][\s]+(.+)$/) || line.match(/^[\s]*\d+\.[\s]+(.+)$/)
            if (match) {
                const text = match[1].trim()
                taskItems.push(`<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>${text}</p></div></li>`)
            }
        }

        if (taskItems.length > 0) {
            return `<ul data-type="taskList">${taskItems.join('')}</ul>`
        }
        return `<p>${markdown}</p>`
    }

    const getEditorText = () => {
        return editor?.getText() || ''
    }

    const handleAIAction = async (action: AI.AIAction, extra?: string) => {
        if (!editor || isAILoading || isStreaming) return

        if (!isOnline) {
            showNetworkOverlay(t('ai.title'))
            return
        }

        const selection = editor.state.selection
        const isSelectionMode = !selection.empty
        const startPos = selection.from
        let endPos = selection.to

        const content = isSelectionMode
            ? editor.state.doc.textBetween(selection.from, selection.to, '\n')
            : getEditorText()

        if (!content.trim()) return

        if (action === 'ask') {
            setShowAIChatView(true)
            return
        }

        if (action === 'ocr') {
            setShowImageAnalysis(true)
            return
        }

        const replaceActions = ['improve', 'translate', 'extract-tasks', 'tone']

        if (action === 'summarize') {
            setIsSummarizing(true)
            if (editorContainerRef.current) {
                editorContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' })
            }
        } else {
            setIsAILoading(true)
            if (replaceActions.includes(action)) {
                if (isSelectionMode) {
                    editor.commands.deleteSelection()
                    endPos = startPos
                } else {
                    editor.commands.setContent('')
                }
            }
        }

        const applyUpdate = (fullText: string, asTaskList = false) => {
            let html = ''
            if (asTaskList) {
                html = convertToTaskList(fullText)
            } else {
                html = marked.parse(fullText, { async: false }) as string
            }

            if (isSelectionMode) {
                editor.commands.setTextSelection({ from: startPos, to: endPos })
                editor.commands.insertContent(html)
                endPos = editor.state.selection.to
            } else {
                editor.commands.setContent(html)
                scrollToBottom()
            }
        }

        let lastUpdate = 0
        const updateEditor = (fullText: string, asTaskList = false) => {
            const now = Date.now()
            if (now - lastUpdate > 50) {
                applyUpdate(fullText, asTaskList)
                lastUpdate = now
            }
        }

        try {
            let result: string
            let accumulatedText = ''
            let isFirstChunk = true

            switch (action) {
                case 'summarize':
                    // eslint-disable-next-line no-case-declarations
                    result = await AI.summarize(content)
                    // eslint-disable-next-line no-case-declarations
                    const summaryHtml = `<p><strong>${t('ai.summary')}</strong>: ${result}</p><hr />`
                    editor.commands.insertContentAt(0, summaryHtml)
                    setIsSummarizing(false)
                    updateNote(note.id, { content: editor.getHTML() })
                    break

                case 'continue':
                    setIsAILoading(false)
                    setIsContinuing(true)
                    setTimeout(() => scrollToBottom(), 100)
                    accumulatedText = '\n\n'
                    await AI.continueWritingStream(content, (chunk) => {
                        if (isFirstChunk) {
                            setIsContinuing(false)
                            setIsStreaming(true)
                            isFirstChunk = false
                        }
                        accumulatedText += chunk
                        const fullNewContent = content + accumulatedText
                        updateEditor(fullNewContent)
                    })
                    applyUpdate(content + accumulatedText)
                    setIsStreaming(false)
                    setIsContinuing(false)
                    updateNote(note.id, { content: editor.getHTML() })
                    break

                case 'improve':
                    accumulatedText = ''
                    await AI.improveWritingStream(content, (chunk) => {
                        if (isFirstChunk) {
                            setIsAILoading(false)
                            setIsStreaming(true)
                            isFirstChunk = false
                        }
                        accumulatedText += chunk
                        updateEditor(accumulatedText)
                    })
                    applyUpdate(accumulatedText)
                    setIsStreaming(false)
                    setIsAILoading(false)
                    updateNote(note.id, { content: editor.getHTML() })
                    break

                case 'translate':
                    if (!extra) {
                        setIsAILoading(false)
                        return
                    }
                    accumulatedText = ''
                    await AI.translateStream(content, extra, (chunk) => {
                        if (isFirstChunk) {
                            setIsAILoading(false)
                            setIsStreaming(true)
                            isFirstChunk = false
                        }
                        accumulatedText += chunk
                        updateEditor(accumulatedText)
                    })
                    applyUpdate(accumulatedText)
                    setIsStreaming(false)
                    setIsAILoading(false)
                    updateNote(note.id, { content: editor.getHTML() })
                    break

                case 'tone':
                    if (!extra) {
                        setIsAILoading(false)
                        return
                    }
                    accumulatedText = ''
                    await AI.changeToneStream(content, extra, (chunk) => {
                        if (isFirstChunk) {
                            setIsAILoading(false)
                            setIsStreaming(true)
                            isFirstChunk = false
                        }
                        accumulatedText += chunk
                        updateEditor(accumulatedText)
                    })
                    applyUpdate(accumulatedText)
                    setIsStreaming(false)
                    setIsAILoading(false)
                    updateNote(note.id, { content: editor.getHTML() })
                    break

                case 'extract-tasks':
                    accumulatedText = ''
                    await AI.extractTasksStream(content, (chunk) => {
                        if (isFirstChunk) {
                            setIsAILoading(false)
                            setIsStreaming(true)
                            isFirstChunk = false
                        }
                        accumulatedText += chunk
                        updateEditor(accumulatedText, true)
                    })
                    applyUpdate(accumulatedText, true)
                    setIsStreaming(false)
                    setIsAILoading(false)
                    updateNote(note.id, { content: editor.getHTML() })
                    break
            }
        } catch (error) {
            console.error('AI error:', error)
            if (error instanceof InsufficientCreditsError) {
                setShowCreditsError(true)
                if (replaceActions.includes(action)) {
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

    const askAI = async (question: string, onStream?: (id: string, text: string) => void) => {
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

            let accumulated = ''

            // Trigger visual streaming immediately to show loading dots
            if (onStream) onStream(aiMessageId, '')

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
    }

    const onAnalyzeImage = async (file: File, type: string) => {
        if (!editor || isStreaming) return

        if (!isOnline) {
            showNetworkOverlay(t('ai.title'))
            return
        }

        setIsAnalyzingImage(true)
        setIsStreaming(true)

        const selection = editor.state.selection
        const isSelectionMode = !selection.empty
        const startPos = selection.from
        let endPos = selection.to

        if (isSelectionMode) {
            editor.commands.deleteSelection()
            endPos = startPos
        }

        const applyUpdate = (fullText: string) => {
            const html = marked.parse(fullText, { async: false }) as string
            editor.commands.setTextSelection({ from: startPos, to: endPos })
            editor.commands.insertContent(html)
            endPos = editor.state.selection.to
        }

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
            let isFirstChunk = true

            if (type === 'whiteboard') {
                accumulatedText += '\n'
            }

            await AI.analyzeImageStream(file, type, (chunk) => {
                if (isFirstChunk) {
                    setShowImageAnalysis(false)
                    isFirstChunk = false
                }
                accumulatedText += chunk
                updateEditor(accumulatedText)
            })

            applyUpdate(accumulatedText)
            setIsStreaming(false)
            setIsAnalyzingImage(false)
            setShowImageAnalysis(false)
            updateNote(note.id, { content: editor.getHTML() })

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

    return {
        isAILoading,
        setIsAILoading,
        isAskAILoading,
        isStreaming,
        isContinuing,
        showAIChatView,
        setShowAIChatView,
        chatMessages,
        setChatMessages,
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
    }
}
