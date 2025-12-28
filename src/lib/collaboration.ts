import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'

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

// Custom signaling server URL - can be configured via environment variable
// For production, you should host your own signaling server
// See: https://github.com/yjs/y-webrtc#signaling-server
const SIGNALING_SERVERS = import.meta.env.VITE_SIGNALING_SERVERS
  ? import.meta.env.VITE_SIGNALING_SERVERS.split(',').map((s: string) => s.trim())
  : [
      // Default public servers - may be unreliable
      // Consider self-hosting for production use
    ]

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
  
  // Connect via WebRTC
  // Configure signaling servers via VITE_SIGNALING_SERVERS env variable
  // For production, host your own signaling server for reliability
  const provider = new WebrtcProvider(`notes-app-${roomId}`, doc, {
    signaling: SIGNALING_SERVERS,
    // BroadcastChannel enables same-browser tab collaboration
    // This works even without signaling servers for local testing
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
