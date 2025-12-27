import type { Note } from '@/types'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const SHARED_FOLDER_NAME = 'G-Note-Shared'

class DriveShare {
  private accessToken: string | null = null
  private sharedFolderId: string | null = null

  setAccessToken(token: string) {
    this.accessToken = token
    this.sharedFolderId = null
  }

  private async request(url: string, options: RequestInit = {}) {
    if (!this.accessToken) throw new Error('Not authenticated')
    
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...options.headers
      }
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error?.message || `Drive API error: ${response.status}`)
    }

    return response
  }

  // Get or create shared notes folder
  private async getOrCreateSharedFolder(): Promise<string> {
    if (this.sharedFolderId) return this.sharedFolderId

    // Search for existing folder with new name
    const searchUrl = `${DRIVE_API}/files?q=name='${SHARED_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`
    const searchRes = await this.request(searchUrl)
    const searchData = await searchRes.json()

    if (searchData.files?.length > 0) {
      this.sharedFolderId = searchData.files[0].id
      return this.sharedFolderId!
    }

    // Check for old folder name 'NotesApp-Shared' and rename it
    const oldFolderUrl = `${DRIVE_API}/files?q=name='NotesApp-Shared' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`
    const oldFolderRes = await this.request(oldFolderUrl)
    const oldFolderData = await oldFolderRes.json()

    if (oldFolderData.files?.length > 0) {
      const oldFolderId: string = oldFolderData.files[0].id
      // Rename old folder to new name
      await this.request(`${DRIVE_API}/files/${oldFolderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: SHARED_FOLDER_NAME })
      })
      this.sharedFolderId = oldFolderId
      return oldFolderId
    }

    // Create new folder
    const createRes = await this.request(`${DRIVE_API}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: SHARED_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder'
      })
    })
    const createData = await createRes.json()
    this.sharedFolderId = createData.id
    return this.sharedFolderId!
  }

  // Create a shareable file for a note
  async createShareableNote(note: Note): Promise<string> {
    const folderId = await this.getOrCreateSharedFolder()
    
    const metadata = {
      name: `note-${note.id}.json`,
      mimeType: 'application/json',
      parents: [folderId]
    }

    const noteData = {
      ...note,
      isShared: true,
      sharedAt: Date.now()
    }

    const form = new FormData()
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
    form.append('file', new Blob([JSON.stringify(noteData)], { type: 'application/json' }))

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.accessToken}` },
      body: form
    })

    if (!response.ok) throw new Error('Failed to create shareable note')
    
    const data = await response.json()
    return data.id
  }

  // Update shared note file
  async updateSharedNote(fileId: string, note: Note): Promise<void> {
    const noteData = {
      ...note,
      isShared: true,
      updatedAt: Date.now()
    }

    const form = new FormData()
    form.append('metadata', new Blob([JSON.stringify({ mimeType: 'application/json' })], { type: 'application/json' }))
    form.append('file', new Blob([JSON.stringify(noteData)], { type: 'application/json' }))

    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${this.accessToken}` },
      body: form
    })
  }

  // Share note with email
  async shareWithEmail(fileId: string, email: string, role: 'reader' | 'writer' = 'reader'): Promise<void> {
    await this.request(`${DRIVE_API}/files/${fileId}/permissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'user',
        role: role,
        emailAddress: email
      })
    })
  }

  // Get notes shared with me
  async getSharedWithMe(): Promise<Note[]> {
    const query = `sharedWithMe = true and mimeType = 'application/json' and name contains 'note-' and trashed = false`
    const url = `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name,owners)`
    
    const response = await this.request(url)
    const data = await response.json()
    
    const notes: Note[] = []
    
    for (const file of data.files || []) {
      try {
        const contentRes = await this.request(`${DRIVE_API}/files/${file.id}?alt=media`)
        const noteData = await contentRes.json()
        notes.push({
          ...noteData,
          driveFileId: file.id,
          isShared: true,
          sharedBy: file.owners?.[0]?.emailAddress || 'Unknown'
        })
      } catch (e) {
        console.error('Failed to load shared note:', e)
      }
    }
    
    return notes
  }

  // Share note publicly (anyone with link) - creates new or updates existing
  async sharePublic(note: Note, existingFileId?: string): Promise<string> {
    const noteData = {
      id: note.id,
      title: note.title,
      content: note.content,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      style: note.style,
      isPublic: true,
      sharedAt: Date.now()
    }

    // If already shared, just update the existing file
    if (existingFileId) {
      const form = new FormData()
      form.append('metadata', new Blob([JSON.stringify({ mimeType: 'application/json' })], { type: 'application/json' }))
      form.append('file', new Blob([JSON.stringify(noteData)], { type: 'application/json' }))

      const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${this.accessToken}` },
        body: form
      })

      if (!response.ok) throw new Error('Failed to update public note')
      return existingFileId
    }

    // Create new public file
    const folderId = await this.getOrCreateSharedFolder()
    
    const metadata = {
      name: `note-public-${note.id}.json`,
      mimeType: 'application/json',
      parents: [folderId]
    }

    const form = new FormData()
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
    form.append('file', new Blob([JSON.stringify(noteData)], { type: 'application/json' }))

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.accessToken}` },
      body: form
    })

    if (!response.ok) throw new Error('Failed to create public note')
    
    const data = await response.json()
    const fileId = data.id

    // Make it public - anyone with link can view
    await this.request(`${DRIVE_API}/files/${fileId}/permissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'anyone',
        role: 'reader'
      })
    })

    return fileId
  }

  // Get public note by file ID (no auth needed)
  static async getPublicNote(fileId: string): Promise<Note | null> {
    try {
      const apiUrl = import.meta.env.VITE_API_URL
      if (!apiUrl) {
        console.error('Missing VITE_API_URL')
        return null
      }
      
      // Fetch via backend to avoid CORS
      const response = await fetch(`${apiUrl}/drive/public/${fileId}`)
      
      if (!response.ok) {
        console.error('Failed to fetch public note:', response.status)
        return null
      }
      
      return await response.json()
    } catch (err) {
      console.error('Error fetching public note:', err)
      return null
    }
  }

  // Remove sharing (delete the shared file)
  async unshare(fileId: string): Promise<void> {
    await this.request(`${DRIVE_API}/files/${fileId}`, {
      method: 'DELETE'
    })
  }
}

export const driveShare = new DriveShare()
