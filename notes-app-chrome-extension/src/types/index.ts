export interface NoteStyle {
  backgroundColor?: string
  backgroundImage?: string      // URL or base64
  backgroundFilter?: string     // Filter name: 'clarendon', 'gingham'...
  backgroundOpacity?: number    // 0-1, to keep text readable
}

export interface AIChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface Note {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
  isPinned: boolean
  syncStatus: 'synced' | 'pending' | 'error'
  version: number              // Optimistic locking - increment on each update
  driveFileId?: string
  isShared?: boolean
  sharedBy?: string
  sharedByName?: string        // Name of the person who shared
  shareId?: string             // Firestore document ID for shared notes
  style?: NoteStyle
  isDeleted?: boolean
  deletedAt?: number
  publicFileId?: string  // ID of the public shared file on Drive
  aiChatHistory?: AIChatMessage[]  // AI chat history for this note
  userId?: string // ID of the user who owns this note (for multi-user support)
}

export interface User {
  id: string
  email: string
  name: string
  avatar: string
  accessToken: string
  tokenExpiry?: number
  aiCredits?: number
}

export interface CreditPackage {
  id: string
  name: string
  credits: number
  price: number
  priceDisplay: string
  description: string
  badge?: string
  variantId: string
  checkoutUrl: string
}

export interface AICreditsInfo {
  used: number
  remaining: number
}

export type Theme = 'light' | 'dark' | 'system'
