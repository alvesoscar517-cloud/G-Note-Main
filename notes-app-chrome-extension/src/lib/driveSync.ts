import type { Note, Collection } from '@/types'
import { useNetworkStore } from '@/stores/networkStore'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const FOLDER_NAME = 'G-Note'
const NOTES_INDEX_FILE = 'notes-index.json'
const COLLECTIONS_INDEX_FILE = 'collections-index.json'
const DELETED_IDS_FILE = 'deleted-ids.json'

interface NotesIndex {
  notes: { id: string; fileId: string; updatedAt: number; version: number }[]
  lastSync: number
}

interface CollectionsIndex {
  collections: { id: string; fileId: string; updatedAt: number; version: number }[]
  lastSync: number
}

interface DeletedIdsIndex {
  noteIds: string[]
  collectionIds: string[]
  lastSync: number
}

class DriveSync {
  private accessToken: string | null = null
  private folderId: string | null = null
  private indexFileId: string | null = null
  private collectionsIndexFileId: string | null = null
  private deletedIdsFileId: string | null = null
  private noteFileIds: Map<string, string> = new Map()
  private collectionFileIds: Map<string, string> = new Map()
  private remoteDeletedIds: Set<string> = new Set()

  setAccessToken(token: string) {
    this.accessToken = token
    this.folderId = null
    this.indexFileId = null
    this.collectionsIndexFileId = null
    this.deletedIdsFileId = null
    this.noteFileIds.clear()
    this.collectionFileIds.clear()
    this.remoteDeletedIds.clear()
  }

  /**
   * Quick check if Drive has any app data (folder exists with notes)
   * This is a lightweight check that doesn't download all data
   * Returns: { hasData: boolean, noteCount: number }
   */
  async checkHasData(): Promise<{ hasData: boolean; noteCount: number }> {
    if (!this.accessToken) {
      return { hasData: false, noteCount: 0 }
    }

    if (!this.checkOnline()) {
      return { hasData: false, noteCount: 0 }
    }

    try {
      // Find the G-Note folder (or old NotesApp folder)
      let folderId: string | null = null
      
      const searchUrl = `${DRIVE_API}/files?q=name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`
      const searchRes = await this.request(searchUrl)
      const searchData = await searchRes.json()

      if (searchData.files?.length > 0) {
        folderId = searchData.files[0].id
      } else {
        // Check for old folder name 'NotesApp'
        const oldFolderUrl = `${DRIVE_API}/files?q=name='NotesApp' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`
        const oldFolderRes = await this.request(oldFolderUrl)
        const oldFolderData = await oldFolderRes.json()
        
        if (oldFolderData.files?.length > 0) {
          folderId = oldFolderData.files[0].id
        }
      }

      if (!folderId) {
        return { hasData: false, noteCount: 0 }
      }

      // Cache folderId for later use
      this.folderId = folderId

      // Check if notes-index.json exists and has notes
      const indexUrl = `${DRIVE_API}/files?q=name='${NOTES_INDEX_FILE}' and '${folderId}' in parents and trashed=false&fields=files(id)`
      const indexRes = await this.request(indexUrl)
      const indexData = await indexRes.json()

      if (!indexData.files?.length) {
        return { hasData: false, noteCount: 0 }
      }

      // Download and check the index
      const indexFileId = indexData.files[0].id
      this.indexFileId = indexFileId
      
      const contentRes = await this.request(`${DRIVE_API}/files/${indexFileId}?alt=media`)
      const indexContent = await contentRes.json()

      const noteCount = indexContent.notes?.length || 0
      return { hasData: noteCount > 0, noteCount }
    } catch (error) {
      console.error('[DriveSync] checkHasData error:', error)
      return { hasData: false, noteCount: 0 }
    }
  }

  /**
   * Check if we're online before making network requests
   */
  private checkOnline(): boolean {
    return useNetworkStore.getState().isOnline
  }

  private async request(url: string, options: RequestInit = {}) {
    if (!this.accessToken) throw new Error('Not authenticated')
    
    // Check network status
    if (!this.checkOnline()) {
      throw new Error('No network connection')
    }
    
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...options.headers
      }
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      const status = response.status
      
      // Handle permission errors (403) - user didn't grant Drive access
      if (status === 403) {
        const errorReason = error.error?.errors?.[0]?.reason || ''
        if (errorReason === 'insufficientPermissions' || 
            errorReason === 'forbidden' ||
            error.error?.message?.includes('insufficient')) {
          throw new Error('DRIVE_PERMISSION_DENIED')
        }
      }
      
      // Handle auth errors (401)
      if (status === 401) {
        throw new Error(`401: ${error.error?.message || 'Authentication failed'}`)
      }
      
      throw new Error(`${status}: ${error.error?.message || 'Drive API error'}`)
    }

    return response
  }

  private async getOrCreateFolder(): Promise<string> {
    if (this.folderId) return this.folderId

    // First, try to find the new folder name
    const searchUrl = `${DRIVE_API}/files?q=name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`
    const searchRes = await this.request(searchUrl)
    const searchData = await searchRes.json()

    if (searchData.files?.length > 0) {
      const id: string = searchData.files[0].id
      this.folderId = id
      return id
    }

    // Check for old folder name 'NotesApp' and rename it to 'G-Note'
    const oldFolderUrl = `${DRIVE_API}/files?q=name='NotesApp' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`
    const oldFolderRes = await this.request(oldFolderUrl)
    const oldFolderData = await oldFolderRes.json()

    if (oldFolderData.files?.length > 0) {
      const oldFolderId: string = oldFolderData.files[0].id
      // Rename old folder to new name
      await this.request(`${DRIVE_API}/files/${oldFolderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: FOLDER_NAME })
      })
      this.folderId = oldFolderId
      return oldFolderId
    }

    const createRes = await this.request(`${DRIVE_API}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder'
      })
    })
    const createData = await createRes.json()
    const newId: string = createData.id
    this.folderId = newId
    return newId
  }

  // ============ Notes Index ============

  private async getOrCreateNotesIndex(): Promise<NotesIndex> {
    const folderId = await this.getOrCreateFolder()
    
    if (!this.indexFileId) {
      const searchUrl = `${DRIVE_API}/files?q=name='${NOTES_INDEX_FILE}' and '${folderId}' in parents and trashed=false&fields=files(id)`
      const searchRes = await this.request(searchUrl)
      const searchData = await searchRes.json()
      
      if (searchData.files?.length > 0) {
        this.indexFileId = searchData.files[0].id
      }
    }

    if (this.indexFileId) {
      const response = await this.request(`${DRIVE_API}/files/${this.indexFileId}?alt=media`)
      const data = await response.json()
      data.notes?.forEach((n: { id: string; fileId: string }) => this.noteFileIds.set(n.id, n.fileId))
      return data
    }

    const emptyIndex: NotesIndex = { notes: [], lastSync: Date.now() }
    await this.uploadFile(NOTES_INDEX_FILE, emptyIndex, folderId)
    return emptyIndex
  }

  private async updateNotesIndex(notes: Note[]): Promise<void> {
    const folderId = await this.getOrCreateFolder()
    const index: NotesIndex = {
      notes: notes.map(n => ({
        id: n.id,
        fileId: this.noteFileIds.get(n.id) || '',
        updatedAt: n.updatedAt,
        version: n.version || 1
      })),
      lastSync: Date.now()
    }

    if (this.indexFileId) {
      await this.updateFile(this.indexFileId, index)
    } else {
      const fileId = await this.uploadFile(NOTES_INDEX_FILE, index, folderId)
      this.indexFileId = fileId
    }
  }

  // ============ Collections Index ============

  private async getOrCreateCollectionsIndex(): Promise<CollectionsIndex> {
    const folderId = await this.getOrCreateFolder()
    
    if (!this.collectionsIndexFileId) {
      const searchUrl = `${DRIVE_API}/files?q=name='${COLLECTIONS_INDEX_FILE}' and '${folderId}' in parents and trashed=false&fields=files(id)`
      const searchRes = await this.request(searchUrl)
      const searchData = await searchRes.json()
      
      if (searchData.files?.length > 0) {
        this.collectionsIndexFileId = searchData.files[0].id
      }
    }

    if (this.collectionsIndexFileId) {
      const response = await this.request(`${DRIVE_API}/files/${this.collectionsIndexFileId}?alt=media`)
      const data = await response.json()
      data.collections?.forEach((c: { id: string; fileId: string }) => this.collectionFileIds.set(c.id, c.fileId))
      return data
    }

    const emptyIndex: CollectionsIndex = { collections: [], lastSync: Date.now() }
    await this.uploadFile(COLLECTIONS_INDEX_FILE, emptyIndex, folderId)
    return emptyIndex
  }

  private async updateCollectionsIndex(collections: Collection[]): Promise<void> {
    const folderId = await this.getOrCreateFolder()
    const index: CollectionsIndex = {
      collections: collections.map(c => ({
        id: c.id,
        fileId: this.collectionFileIds.get(c.id) || '',
        updatedAt: c.updatedAt,
        version: c.version || 1
      })),
      lastSync: Date.now()
    }

    if (this.collectionsIndexFileId) {
      await this.updateFile(this.collectionsIndexFileId, index)
    } else {
      const fileId = await this.uploadFile(COLLECTIONS_INDEX_FILE, index, folderId)
      this.collectionsIndexFileId = fileId
    }
  }

  // ============ Deleted IDs Index ============

  private async getOrCreateDeletedIdsIndex(): Promise<DeletedIdsIndex> {
    const folderId = await this.getOrCreateFolder()
    
    if (!this.deletedIdsFileId) {
      const searchUrl = `${DRIVE_API}/files?q=name='${DELETED_IDS_FILE}' and '${folderId}' in parents and trashed=false&fields=files(id)`
      const searchRes = await this.request(searchUrl)
      const searchData = await searchRes.json()
      
      if (searchData.files?.length > 0) {
        this.deletedIdsFileId = searchData.files[0].id
      }
    }

    if (this.deletedIdsFileId) {
      const response = await this.request(`${DRIVE_API}/files/${this.deletedIdsFileId}?alt=media`)
      const data = await response.json()
      // Cache remote deleted IDs
      data.noteIds?.forEach((id: string) => this.remoteDeletedIds.add(id))
      data.collectionIds?.forEach((id: string) => this.remoteDeletedIds.add(id))
      return data
    }

    const emptyIndex: DeletedIdsIndex = { noteIds: [], collectionIds: [], lastSync: Date.now() }
    return emptyIndex
  }

  private async updateDeletedIdsIndex(noteIds: string[], collectionIds: string[]): Promise<void> {
    const folderId = await this.getOrCreateFolder()
    const index: DeletedIdsIndex = {
      noteIds,
      collectionIds,
      lastSync: Date.now()
    }

    if (this.deletedIdsFileId) {
      await this.updateFile(this.deletedIdsFileId, index)
    } else {
      const fileId = await this.uploadFile(DELETED_IDS_FILE, index, folderId)
      this.deletedIdsFileId = fileId
    }
  }

  /**
   * Check if an ID was deleted on another device
   */
  isDeletedRemotely(id: string): boolean {
    return this.remoteDeletedIds.has(id)
  }

  // ============ File Operations ============

  private async uploadFile(name: string, content: unknown, parentId: string): Promise<string> {
    const metadata = { name, mimeType: 'application/json', parents: [parentId] }
    const form = new FormData()
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
    form.append('file', new Blob([JSON.stringify(content)], { type: 'application/json' }))

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.accessToken}` },
      body: form
    })

    if (!response.ok) throw new Error('Failed to upload file')
    const data = await response.json()
    return data.id
  }

  private async updateFile(fileId: string, content: unknown): Promise<void> {
    const form = new FormData()
    form.append('metadata', new Blob([JSON.stringify({ mimeType: 'application/json' })], { type: 'application/json' }))
    form.append('file', new Blob([JSON.stringify(content)], { type: 'application/json' }))

    const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${this.accessToken}` },
      body: form
    })

    if (!response.ok) throw new Error('Failed to update file')
  }

  // ============ Note Operations ============

  async uploadNote(note: Note): Promise<string> {
    const folderId = await this.getOrCreateFolder()
    const existingFileId = this.noteFileIds.get(note.id)

    if (existingFileId) {
      await this.updateFile(existingFileId, note)
      return existingFileId
    }

    const fileName = `note-${note.id}.json`
    const fileId = await this.uploadFile(fileName, note, folderId)
    this.noteFileIds.set(note.id, fileId)
    return fileId
  }

  async downloadNote(fileId: string): Promise<Note | null> {
    try {
      const response = await this.request(`${DRIVE_API}/files/${fileId}?alt=media`)
      return await response.json()
    } catch {
      return null
    }
  }

  getNoteFileId(noteId: string): string | undefined {
    return this.noteFileIds.get(noteId)
  }

  async deleteNoteFile(noteId: string): Promise<void> {
    const fileId = this.noteFileIds.get(noteId)
    if (!fileId) return
    
    try {
      await this.request(`${DRIVE_API}/files/${fileId}`, { method: 'DELETE' })
    } catch (error) {
      // Ignore 404 errors - file already deleted
      const errorMsg = error instanceof Error ? error.message : ''
      if (!errorMsg.includes('404') && !errorMsg.includes('File not found') && !errorMsg.includes('not found')) {
        throw error
      }
      // File not found means it's already deleted, which is fine
      console.log(`[DriveSync] File ${fileId} already deleted or not found, skipping`)
    }
    
    this.noteFileIds.delete(noteId)
  }

  // ============ Collection Operations ============

  async uploadCollection(collection: Collection): Promise<string> {
    const folderId = await this.getOrCreateFolder()
    const existingFileId = this.collectionFileIds.get(collection.id)

    if (existingFileId) {
      await this.updateFile(existingFileId, collection)
      return existingFileId
    }

    const fileName = `collection-${collection.id}.json`
    const fileId = await this.uploadFile(fileName, collection, folderId)
    this.collectionFileIds.set(collection.id, fileId)
    return fileId
  }

  async downloadCollection(fileId: string): Promise<Collection | null> {
    try {
      const response = await this.request(`${DRIVE_API}/files/${fileId}?alt=media`)
      return await response.json()
    } catch {
      return null
    }
  }

  getCollectionFileId(collectionId: string): string | undefined {
    return this.collectionFileIds.get(collectionId)
  }

  async deleteCollectionFile(collectionId: string): Promise<void> {
    const fileId = this.collectionFileIds.get(collectionId)
    if (!fileId) return
    
    try {
      await this.request(`${DRIVE_API}/files/${fileId}`, { method: 'DELETE' })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : ''
      if (!errorMsg.includes('404')) throw error
    }
    
    this.collectionFileIds.delete(collectionId)
  }

  // ============ Main Sync ============

  async sync(
    localNotes: Note[], 
    localCollections: Collection[],
    localDeletedNoteIds: string[],
    localDeletedCollectionIds: string[]
  ): Promise<{ 
    notes: Note[]
    collections: Collection[]
    hasChanges: boolean 
  }> {
    try {
      const isNoteEmpty = (note: Note) => !note.title.trim() && !note.content.trim()
      
      // Load remote deleted IDs first
      const remoteDeletedIndex = await this.getOrCreateDeletedIdsIndex()
      const remoteDeletedNoteIds = new Set(remoteDeletedIndex.noteIds || [])
      const remoteDeletedCollectionIds = new Set(remoteDeletedIndex.collectionIds || [])

      // Merge local and remote deleted IDs
      const allDeletedNoteIds = new Set([...localDeletedNoteIds, ...remoteDeletedNoteIds])
      const allDeletedCollectionIds = new Set([...localDeletedCollectionIds, ...remoteDeletedCollectionIds])

      // Filter out empty and deleted notes
      const validLocalNotes = localNotes.filter(note => 
        !isNoteEmpty(note) && !allDeletedNoteIds.has(note.id)
      )
      const validLocalCollections = localCollections.filter(c => 
        !allDeletedCollectionIds.has(c.id)
      )
      
      // ============ Sync Notes ============
      const notesIndex = await this.getOrCreateNotesIndex()
      
      const remoteNotes: Note[] = []
      for (const entry of notesIndex.notes) {
        // Skip if deleted
        if (allDeletedNoteIds.has(entry.id)) continue
        
        if (entry.fileId) {
          const note = await this.downloadNote(entry.fileId)
          if (note && !isNoteEmpty(note)) {
            remoteNotes.push(note)
            this.noteFileIds.set(note.id, entry.fileId)
          }
        }
      }

      // Merge notes with version-aware conflict resolution
      const mergedNotesMap = new Map<string, Note>()
      
      // Add remote notes first
      remoteNotes.forEach(note => {
        if (!allDeletedNoteIds.has(note.id)) {
          mergedNotesMap.set(note.id, note)
        }
      })
      
      // Merge local notes with conflict resolution
      validLocalNotes.forEach(localNote => {
        const remoteNote = mergedNotesMap.get(localNote.id)
        if (!remoteNote) {
          mergedNotesMap.set(localNote.id, localNote)
        } else {
          // Version-aware conflict resolution
          const localVersion = localNote.version || 1
          const remoteVersion = remoteNote.version || 1
          
          if (localVersion > remoteVersion) {
            // Local has newer version
            mergedNotesMap.set(localNote.id, localNote)
          } else if (localVersion === remoteVersion) {
            // Same version - use timestamp as tiebreaker
            // Prefer local if timestamps are close (within 5 seconds)
            const timeDiff = Math.abs(localNote.updatedAt - remoteNote.updatedAt)
            if (timeDiff < 5000 || localNote.updatedAt >= remoteNote.updatedAt) {
              mergedNotesMap.set(localNote.id, localNote)
            }
          }
          // Otherwise keep remote (already in map)
        }
      })

      const mergedNotes = Array.from(mergedNotesMap.values())
      
      // Upload changed notes
      for (const note of mergedNotes) {
        const remoteEntry = notesIndex.notes.find(n => n.id === note.id)
        const noteVersion = note.version || 1
        const remoteVersion = remoteEntry?.version || 0
        
        if (!remoteEntry || noteVersion > remoteVersion || note.updatedAt > remoteEntry.updatedAt) {
          await this.uploadNote(note)
        }
      }

      // Delete notes that are in remote but deleted locally
      for (const entry of notesIndex.notes) {
        if (allDeletedNoteIds.has(entry.id)) {
          await this.deleteNoteFile(entry.id)
        }
      }

      await this.updateNotesIndex(mergedNotes)

      // ============ Sync Collections ============
      const collectionsIndex = await this.getOrCreateCollectionsIndex()
      
      const remoteCollections: Collection[] = []
      for (const entry of collectionsIndex.collections) {
        if (allDeletedCollectionIds.has(entry.id)) continue
        
        if (entry.fileId) {
          const collection = await this.downloadCollection(entry.fileId)
          if (collection) {
            remoteCollections.push(collection)
            this.collectionFileIds.set(collection.id, entry.fileId)
          }
        }
      }

      // Merge collections
      const mergedCollectionsMap = new Map<string, Collection>()
      
      remoteCollections.forEach(c => {
        if (!allDeletedCollectionIds.has(c.id)) {
          mergedCollectionsMap.set(c.id, c)
        }
      })
      
      validLocalCollections.forEach(localCollection => {
        const remoteCollection = mergedCollectionsMap.get(localCollection.id)
        if (!remoteCollection) {
          mergedCollectionsMap.set(localCollection.id, localCollection)
        } else {
          const localVersion = localCollection.version || 1
          const remoteVersion = remoteCollection.version || 1
          
          if (localVersion > remoteVersion) {
            mergedCollectionsMap.set(localCollection.id, localCollection)
          } else if (localVersion === remoteVersion) {
            const timeDiff = Math.abs(localCollection.updatedAt - remoteCollection.updatedAt)
            if (timeDiff < 5000 || localCollection.updatedAt >= remoteCollection.updatedAt) {
              mergedCollectionsMap.set(localCollection.id, localCollection)
            }
          }
        }
      })

      const mergedCollections = Array.from(mergedCollectionsMap.values())
      
      // Upload changed collections
      for (const collection of mergedCollections) {
        const remoteEntry = collectionsIndex.collections.find(c => c.id === collection.id)
        const collectionVersion = collection.version || 1
        const remoteVersion = remoteEntry?.version || 0
        
        if (!remoteEntry || collectionVersion > remoteVersion || collection.updatedAt > remoteEntry.updatedAt) {
          await this.uploadCollection(collection)
        }
      }

      // Delete collections that are deleted locally
      for (const entry of collectionsIndex.collections) {
        if (allDeletedCollectionIds.has(entry.id)) {
          await this.deleteCollectionFile(entry.id)
        }
      }

      await this.updateCollectionsIndex(mergedCollections)

      // ============ Update Deleted IDs Index ============
      await this.updateDeletedIdsIndex(
        Array.from(allDeletedNoteIds),
        Array.from(allDeletedCollectionIds)
      )

      // Check for changes
      const hasChanges = 
        JSON.stringify(mergedNotes.map(n => n.id).sort()) !== JSON.stringify(localNotes.map(n => n.id).sort()) ||
        JSON.stringify(mergedCollections.map(c => c.id).sort()) !== JSON.stringify(localCollections.map(c => c.id).sort())

      // Mark as synced
      const syncedNotes = mergedNotes.map(note => ({ 
        ...note, 
        syncStatus: 'synced' as const,
        driveFileId: this.noteFileIds.get(note.id)
      }))
      
      const syncedCollections = mergedCollections.map(collection => ({
        ...collection,
        syncStatus: 'synced' as const
      }))
      
      return { notes: syncedNotes, collections: syncedCollections, hasChanges }
    } catch (error) {
      console.error('Sync error:', error)
      throw error
    }
  }
}

export const driveSync = new DriveSync()
