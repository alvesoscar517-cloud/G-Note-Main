import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import { Extension } from '@tiptap/core'
import { ySyncPlugin, yUndoPlugin, yCursorPlugin } from 'y-prosemirror'

export interface CollaboratorInfo {
  name: string
  color: string
}

export interface CollaborationRoom {
  doc: Y.Doc
  provider: WebrtcProvider
  roomId: string
  type: Y.XmlFragment
  awareness: WebrtcProvider['awareness']
}

// Store active collaborations
const activeRooms = new Map<string, CollaborationRoom>()

// Generate a shareable room ID
export function generateRoomId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Create or join a collaboration room
export function joinRoom(roomId: string, userName: string, userColor: string): CollaborationRoom {
  // Check if already connected to this room
  if (activeRooms.has(roomId)) {
    return activeRooms.get(roomId)!
  }

  // Create new Y.Doc
  const doc = new Y.Doc()
  
  // Get the XML fragment for ProseMirror content
  const type = doc.getXmlFragment('prosemirror')
  
  // Connect via WebRTC with public signaling servers
  const provider = new WebrtcProvider(`notes-app-${roomId}`, doc, {
    signaling: [
      'wss://signaling.yjs.dev',
      'wss://y-webrtc-signaling-eu.herokuapp.com',
      'wss://y-webrtc-signaling-us.herokuapp.com'
    ]
  })

  // Set user awareness (cursor, name, etc.)
  provider.awareness.setLocalStateField('user', {
    name: userName,
    color: userColor,
    colorLight: userColor + '40' // Add transparency for selection highlight
  })

  const room: CollaborationRoom = {
    doc,
    provider,
    roomId,
    type,
    awareness: provider.awareness
  }

  // Store for reuse
  activeRooms.set(roomId, room)

  return room
}

// Leave a collaboration room
export function leaveRoom(roomId: string): void {
  const room = activeRooms.get(roomId)
  if (room) {
    room.provider.disconnect()
    room.provider.destroy()
    room.doc.destroy()
    activeRooms.delete(roomId)
  }
}

// Get connected peers count
export function getPeersCount(roomId: string): number {
  const room = activeRooms.get(roomId)
  if (!room) return 0
  return room.provider.awareness.getStates().size
}

// Get list of collaborators
export function getCollaborators(roomId: string): CollaboratorInfo[] {
  const room = activeRooms.get(roomId)
  if (!room) return []
  
  const collaborators: CollaboratorInfo[] = []
  room.provider.awareness.getStates().forEach((state) => {
    if (state.user) {
      collaborators.push({
        name: state.user.name || 'Anonymous',
        color: state.user.color || '#888'
      })
    }
  })
  return collaborators
}

// Check if connected to a room
export function isConnected(roomId: string): boolean {
  const room = activeRooms.get(roomId)
  return room?.provider.connected ?? false
}

// Generate a random color for user cursor
export function generateUserColor(): string {
  const colors = [
    '#f87171', '#fb923c', '#fbbf24', '#a3e635',
    '#34d399', '#22d3d8', '#60a5fa', '#a78bfa',
    '#f472b6', '#e879f9'
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}

// TipTap Collaboration Extension using y-prosemirror
export interface CollaborationOptions {
  document: Y.Doc
  field: string
}

export const Collaboration = Extension.create<CollaborationOptions>({
  name: 'collaboration',

  addOptions() {
    return {
      document: new Y.Doc(),
      field: 'prosemirror',
    }
  },

  addProseMirrorPlugins() {
    const fragment = this.options.document.getXmlFragment(this.options.field)
    return [
      ySyncPlugin(fragment),
      yUndoPlugin(),
    ]
  },
})

// TipTap Collaboration Cursor Extension
export interface CollaborationCursorOptions {
  provider: WebrtcProvider
  user: {
    name: string
    color: string
  }
}

export const CollaborationCursor = Extension.create<CollaborationCursorOptions>({
  name: 'collaborationCursor',

  addOptions() {
    return {
      provider: null as unknown as WebrtcProvider,
      user: {
        name: 'Anonymous',
        color: '#888888',
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      yCursorPlugin(this.options.provider.awareness),
    ]
  },
})
