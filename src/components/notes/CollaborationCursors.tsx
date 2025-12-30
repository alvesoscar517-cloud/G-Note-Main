/**
 * CollaborationCursors - Custom cursor rendering for real-time collaboration
 * 
 * This component renders remote user cursors and selections using the Y.js awareness API.
 * It's a custom implementation that works around the y-prosemirror yCursorPlugin issues
 * with y-webrtc provider (where awareness.doc is set asynchronously).
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { Editor } from '@tiptap/react'
import type { WebrtcProvider } from 'y-webrtc'

interface CursorState {
  clientId: number
  user: {
    name: string
    color: string
    colorLight?: string
  }
  cursor: {
    anchor: number
    head: number
  } | null
}

interface CollaborationCursorsProps {
  editor: Editor | null
  provider: WebrtcProvider | null
}

export function CollaborationCursors({ editor, provider }: CollaborationCursorsProps) {
  const [cursors, setCursors] = useState<CursorState[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const editorElement = editor?.view?.dom

  // Update local cursor position in awareness
  const updateLocalCursor = useCallback(() => {
    if (!editor || !provider) return

    const { from, to } = editor.state.selection
    
    provider.awareness.setLocalStateField('cursor', {
      anchor: from,
      head: to
    })
  }, [editor, provider])

  // Listen to editor selection changes
  useEffect(() => {
    if (!editor) return

    const handleSelectionUpdate = () => {
      updateLocalCursor()
    }

    editor.on('selectionUpdate', handleSelectionUpdate)
    editor.on('focus', handleSelectionUpdate)

    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate)
      editor.off('focus', handleSelectionUpdate)
    }
  }, [editor, updateLocalCursor])

  // Listen to awareness changes from other users
  useEffect(() => {
    if (!provider) return

    const handleAwarenessChange = () => {
      const states = provider.awareness.getStates()
      const localClientId = provider.awareness.clientID
      const newCursors: CursorState[] = []

      states.forEach((state, clientId) => {
        // Skip local user
        if (clientId === localClientId) return
        
        if (state.user && state.cursor) {
          newCursors.push({
            clientId,
            user: state.user,
            cursor: state.cursor
          })
        }
      })

      setCursors(newCursors)
    }

    provider.awareness.on('change', handleAwarenessChange)
    // Initial load
    handleAwarenessChange()

    return () => {
      provider.awareness.off('change', handleAwarenessChange)
    }
  }, [provider])

  // Get cursor position in DOM coordinates
  const getCursorCoords = useCallback((pos: number) => {
    if (!editor || !editorElement) return null

    try {
      const coords = editor.view.coordsAtPos(pos)
      const editorRect = editorElement.getBoundingClientRect()
      
      return {
        left: coords.left - editorRect.left,
        top: coords.top - editorRect.top,
        bottom: coords.bottom - editorRect.top
      }
    } catch {
      return null
    }
  }, [editor, editorElement])

  // Get selection rectangles for highlighting
  const getSelectionRects = useCallback((anchor: number, head: number) => {
    if (!editor || !editorElement || anchor === head) return []

    try {
      const from = Math.min(anchor, head)
      const to = Math.max(anchor, head)
      const editorRect = editorElement.getBoundingClientRect()
      
      // Use ProseMirror's coordsAtPos to get positions
      const startCoords = editor.view.coordsAtPos(from)
      const endCoords = editor.view.coordsAtPos(to)
      
      // Single line selection
      if (Math.abs(startCoords.top - endCoords.top) < 5) {
        return [{
          left: startCoords.left - editorRect.left,
          top: startCoords.top - editorRect.top,
          width: endCoords.left - startCoords.left,
          height: startCoords.bottom - startCoords.top
        }]
      }
      
      // Multi-line selection - simplified to just show start and end
      return [
        {
          left: startCoords.left - editorRect.left,
          top: startCoords.top - editorRect.top,
          width: editorRect.width - (startCoords.left - editorRect.left) - 20,
          height: startCoords.bottom - startCoords.top
        },
        {
          left: 0,
          top: endCoords.top - editorRect.top,
          width: endCoords.left - editorRect.left,
          height: endCoords.bottom - endCoords.top
        }
      ]
    } catch {
      return []
    }
  }, [editor, editorElement])

  // Force re-render on editor updates to keep cursors in sync
  const [, forceUpdate] = useState(0)
  
  useEffect(() => {
    if (!editor) return

    const handleUpdate = () => {
      forceUpdate(n => n + 1)
    }

    editor.on('update', handleUpdate)
    editor.on('selectionUpdate', handleUpdate)

    return () => {
      editor.off('update', handleUpdate)
      editor.off('selectionUpdate', handleUpdate)
    }
  }, [editor])

  if (!editor || !provider || cursors.length === 0) {
    return null
  }

  return (
    <div 
      ref={containerRef}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ zIndex: 50 }}
    >
      {/* CSS for cursor blink animation */}
      <style>{`
        @keyframes cursor-blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        .collab-cursor-line {
          animation: cursor-blink 1s ease-in-out infinite;
        }
      `}</style>
      
      {cursors.map((cursorState) => {
        if (!cursorState.cursor) return null

        const { anchor, head } = cursorState.cursor
        const cursorCoords = getCursorCoords(head)
        const selectionRects = getSelectionRects(anchor, head)
        const { user } = cursorState

        if (!cursorCoords) return null

        const hasSelection = anchor !== head

        return (
          <div key={cursorState.clientId}>
            {/* Selection highlight */}
            {selectionRects.map((rect, i) => (
              <div
                key={`selection-${i}`}
                className="absolute transition-all duration-75"
                style={{
                  left: rect.left,
                  top: rect.top,
                  width: rect.width,
                  height: rect.height,
                  backgroundColor: user.colorLight || `${user.color}40`,
                  borderRadius: 2
                }}
              />
            ))}
            
            {/* Cursor line - only blink when no selection */}
            <div
              className={`absolute w-0.5 transition-all duration-75 ${!hasSelection ? 'collab-cursor-line' : ''}`}
              style={{
                left: cursorCoords.left,
                top: cursorCoords.top,
                height: cursorCoords.bottom - cursorCoords.top,
                backgroundColor: user.color
              }}
            />
            
            {/* User name label */}
            <div
              className="absolute px-1.5 py-0.5 rounded text-[10px] font-medium text-white whitespace-nowrap transition-all duration-75 shadow-sm"
              style={{
                left: cursorCoords.left,
                top: cursorCoords.top - 20,
                backgroundColor: user.color,
                transform: 'translateX(-2px)'
              }}
            >
              {user.name}
            </div>
          </div>
        )
      })}
    </div>
  )
}
