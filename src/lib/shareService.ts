import type { Note } from '@/types'

const API_URL = import.meta.env.VITE_API_URL || ''
const MAX_FILE_SIZE = 1 * 1024 * 1024 // 1MB

export type ShareError = 
  | 'FILE_TOO_LARGE' 
  | 'USER_NOT_FOUND' 
  | 'NETWORK_ERROR' 
  | 'UNKNOWN_ERROR'

export interface ShareResult {
  success: boolean
  error?: ShareError
  message?: string
  shareId?: string
}

export interface SharedNote extends Note {
  shareId: string
  sharedBy: string
  sharedByName: string
  sharedAt: number
}

class ShareService {
  // Check if note size is within limit (check locally before sending)
  checkNoteSize(note: Note): { valid: boolean; size: number } {
    const noteJson = JSON.stringify(note)
    const size = new Blob([noteJson]).size
    return {
      valid: size <= MAX_FILE_SIZE,
      size
    }
  }

  // Check if user exists in the system
  async checkUserExists(email: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/share/check-user/${encodeURIComponent(email)}`)
      if (!response.ok) return false
      const data = await response.json()
      return data.exists
    } catch {
      return false
    }
  }

  // Share note via email (using Firestore backend)
  async shareViaEmail(
    note: Note, 
    recipientEmail: string, 
    senderEmail: string,
    senderName?: string
  ): Promise<ShareResult> {
    // Check size locally first
    const sizeCheck = this.checkNoteSize(note)
    if (!sizeCheck.valid) {
      return {
        success: false,
        error: 'FILE_TOO_LARGE',
        message: `Note is too large (${(sizeCheck.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 1MB.`
      }
    }

    try {
      const response = await fetch(`${API_URL}/share/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          note: {
            id: note.id,
            title: note.title,
            content: note.content,
            createdAt: note.createdAt,
            updatedAt: note.updatedAt,
            style: note.style,
            isPinned: false,
            syncStatus: 'pending',
            version: 1
          },
          recipientEmail,
          senderEmail,
          senderName
        })
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.error === 'FILE_TOO_LARGE') {
          return { success: false, error: 'FILE_TOO_LARGE', message: data.message }
        }
        if (data.error === 'USER_NOT_FOUND') {
          return { success: false, error: 'USER_NOT_FOUND', message: data.message }
        }
        return { success: false, error: 'UNKNOWN_ERROR', message: data.message || data.error }
      }

      return { success: true, shareId: data.shareId }
    } catch (error) {
      console.error('Share error:', error)
      return { success: false, error: 'NETWORK_ERROR', message: 'Network error' }
    }
  }

  // Get shared notes received by user
  async getReceivedNotes(userId: string): Promise<SharedNote[]> {
    try {
      const response = await fetch(`${API_URL}/share/received/${userId}`)
      if (!response.ok) return []
      const data = await response.json()
      return data.notes || []
    } catch {
      return []
    }
  }

  // Accept a shared note (downloads it and deletes from server)
  async acceptSharedNote(shareId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/share/received/${shareId}/accept`, {
        method: 'POST'
      })
      return response.ok
    } catch {
      return false
    }
  }

  // Decline/delete a shared note
  async declineSharedNote(shareId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/share/received/${shareId}`, {
        method: 'DELETE'
      })
      return response.ok
    } catch {
      return false
    }
  }
}

export const shareService = new ShareService()
