/**
 * Drive Index
 * Manages index files (notes-index, collections-index, deleted-ids)
 */
import { driveClient } from './driveClient'
import {
  setNoteFileId,
  setCollectionFileId,
  clearFileIdCaches
} from './driveFiles'
import {
  DEFAULT_DRIVE_CONFIG,
  type NotesIndex,
  type CollectionsIndex,
  type DeletedIdsIndex,
  type TombstoneEntry
} from './types'

// Cached file IDs for index files
let folderId: string | null = null
let notesIndexFileId: string | null = null
let collectionsIndexFileId: string | null = null
let deletedIdsFileId: string | null = null

// Remote tombstone cache
const remoteTombstones = new Map<string, number>()
const remoteDeletedIds = new Set<string>()

/**
 * Reset all cached state
 */
export function resetDriveState(): void {
  folderId = null
  notesIndexFileId = null
  collectionsIndexFileId = null
  deletedIdsFileId = null
  remoteTombstones.clear()
  remoteDeletedIds.clear()
  clearFileIdCaches()
}

/**
 * Get or create the G-Note folder
 */
export async function getOrCreateFolder(): Promise<string> {
  if (folderId) return folderId

  const { folderName } = DEFAULT_DRIVE_CONFIG

  // Search for existing folder
  const query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const result = await driveClient.searchFiles(query)

  if (result.files?.length > 0) {
    folderId = result.files[0].id
    return folderId
  }

  // Create new folder
  folderId = await driveClient.createFolder(folderName)
  return folderId
}

// ============ Notes Index ============

/**
 * Get or create notes index file
 */
export async function getOrCreateNotesIndex(): Promise<NotesIndex> {
  const folder = await getOrCreateFolder()
  const { notesIndexFile } = DEFAULT_DRIVE_CONFIG

  if (!notesIndexFileId) {
    const query = `name='${notesIndexFile}' and '${folder}' in parents and trashed=false`
    const result = await driveClient.searchFiles(query)

    if (result.files?.length > 0) {
      notesIndexFileId = result.files[0].id
    }
  }

  if (notesIndexFileId) {
    try {
      const data = await driveClient.downloadFile<NotesIndex>(notesIndexFileId)
      // Cache file IDs
      data.notes?.forEach(n => setNoteFileId(n.id, n.fileId))
      return data
    } catch {
      // If download fails, create new index
      console.warn('[DriveIndex] Failed to download notes index, creating new')
    }
  }

  // Create empty index
  const emptyIndex: NotesIndex = { notes: [], lastSync: Date.now() }
  notesIndexFileId = await driveClient.createFile(notesIndexFile, emptyIndex, folder)
  return emptyIndex
}

/**
 * Update notes index file
 */
export async function updateNotesIndex(
  notes: Array<{ id: string; fileId: string; updatedAt: number; version: number }>
): Promise<void> {
  const folder = await getOrCreateFolder()
  const { notesIndexFile } = DEFAULT_DRIVE_CONFIG

  const index: NotesIndex = {
    notes,
    lastSync: Date.now()
  }

  if (notesIndexFileId) {
    await driveClient.updateFile(notesIndexFileId, index)
  } else {
    notesIndexFileId = await driveClient.createFile(notesIndexFile, index, folder)
  }
}

// ============ Collections Index ============

/**
 * Get or create collections index file
 */
export async function getOrCreateCollectionsIndex(): Promise<CollectionsIndex> {
  const folder = await getOrCreateFolder()
  const { collectionsIndexFile } = DEFAULT_DRIVE_CONFIG

  if (!collectionsIndexFileId) {
    const query = `name='${collectionsIndexFile}' and '${folder}' in parents and trashed=false`
    const result = await driveClient.searchFiles(query)

    if (result.files?.length > 0) {
      collectionsIndexFileId = result.files[0].id
    }
  }

  if (collectionsIndexFileId) {
    try {
      const data = await driveClient.downloadFile<CollectionsIndex>(collectionsIndexFileId)
      // Cache file IDs
      data.collections?.forEach(c => setCollectionFileId(c.id, c.fileId))
      return data
    } catch {
      console.warn('[DriveIndex] Failed to download collections index, creating new')
    }
  }

  // Create empty index
  const emptyIndex: CollectionsIndex = { collections: [], lastSync: Date.now() }
  collectionsIndexFileId = await driveClient.createFile(collectionsIndexFile, emptyIndex, folder)
  return emptyIndex
}

/**
 * Update collections index file
 */
export async function updateCollectionsIndex(
  collections: Array<{ id: string; fileId: string; updatedAt: number; version: number }>
): Promise<void> {
  const folder = await getOrCreateFolder()
  const { collectionsIndexFile } = DEFAULT_DRIVE_CONFIG

  const index: CollectionsIndex = {
    collections,
    lastSync: Date.now()
  }

  if (collectionsIndexFileId) {
    await driveClient.updateFile(collectionsIndexFileId, index)
  } else {
    collectionsIndexFileId = await driveClient.createFile(collectionsIndexFile, index, folder)
  }
}

// ============ Deleted IDs Index ============

/**
 * Get or create deleted IDs index file
 */
export async function getOrCreateDeletedIdsIndex(): Promise<DeletedIdsIndex> {
  const folder = await getOrCreateFolder()
  const { deletedIdsFile, tombstoneRetentionMs } = DEFAULT_DRIVE_CONFIG

  if (!deletedIdsFileId) {
    const query = `name='${deletedIdsFile}' and '${folder}' in parents and trashed=false`
    const result = await driveClient.searchFiles(query)

    if (result.files?.length > 0) {
      deletedIdsFileId = result.files[0].id
    }
  }

  if (deletedIdsFileId) {
    try {
      const data = await driveClient.downloadFile<DeletedIdsIndex>(deletedIdsFileId)
      const now = Date.now()
      const cutoffTime = now - tombstoneRetentionMs

      // Migrate legacy format and prune old tombstones
      let noteTombstones: TombstoneEntry[] = data.noteTombstones || []
      let collectionTombstones: TombstoneEntry[] = data.collectionTombstones || []

      // Migrate legacy noteIds
      if (data.noteIds?.length && !data.noteTombstones?.length) {
        const legacyDeletedAt = data.lastSync || now
        noteTombstones = data.noteIds.map(id => ({ id, deletedAt: legacyDeletedAt }))
      }
      if (data.collectionIds?.length && !data.collectionTombstones?.length) {
        const legacyDeletedAt = data.lastSync || now
        collectionTombstones = data.collectionIds.map(id => ({ id, deletedAt: legacyDeletedAt }))
      }

      // Prune old tombstones
      noteTombstones = noteTombstones.filter(t => t.deletedAt > cutoffTime)
      collectionTombstones = collectionTombstones.filter(t => t.deletedAt > cutoffTime)

      // Cache tombstones
      remoteTombstones.clear()
      remoteDeletedIds.clear()
      noteTombstones.forEach(t => {
        remoteDeletedIds.add(t.id)
        remoteTombstones.set(t.id, t.deletedAt)
      })
      collectionTombstones.forEach(t => {
        remoteDeletedIds.add(t.id)
        remoteTombstones.set(t.id, t.deletedAt)
      })

      return { noteTombstones, collectionTombstones, lastSync: data.lastSync }
    } catch {
      console.warn('[DriveIndex] Failed to download deleted IDs index')
    }
  }

  // Return empty index (don't create file until needed)
  return { noteTombstones: [], collectionTombstones: [], lastSync: Date.now() }
}

/**
 * Update deleted IDs index file
 */
export async function updateDeletedIdsIndex(
  noteTombstones: TombstoneEntry[],
  collectionTombstones: TombstoneEntry[]
): Promise<void> {
  const folder = await getOrCreateFolder()
  const { deletedIdsFile, tombstoneRetentionMs } = DEFAULT_DRIVE_CONFIG
  const now = Date.now()
  const cutoffTime = now - tombstoneRetentionMs

  // Prune old tombstones
  const prunedNoteTombstones = noteTombstones.filter(t => t.deletedAt > cutoffTime)
  const prunedCollectionTombstones = collectionTombstones.filter(t => t.deletedAt > cutoffTime)

  const index: DeletedIdsIndex = {
    noteTombstones: prunedNoteTombstones,
    collectionTombstones: prunedCollectionTombstones,
    // Keep legacy format for backward compatibility
    noteIds: prunedNoteTombstones.map(t => t.id),
    collectionIds: prunedCollectionTombstones.map(t => t.id),
    lastSync: now
  }

  if (deletedIdsFileId) {
    await driveClient.updateFile(deletedIdsFileId, index)
  } else {
    deletedIdsFileId = await driveClient.createFile(deletedIdsFile, index, folder)
  }
}

// ============ Tombstone Helpers ============

/**
 * Check if an ID was deleted remotely
 */
export function isDeletedRemotely(id: string): boolean {
  return remoteDeletedIds.has(id)
}

/**
 * Get tombstone timestamp
 */
export function getTombstoneTimestamp(id: string): number | undefined {
  return remoteTombstones.get(id)
}

/**
 * Check if a local note should be deleted based on tombstone
 */
export function shouldDeleteLocalNote(noteId: string, localUpdatedAt: number): boolean {
  const deletedAt = remoteTombstones.get(noteId)
  if (!deletedAt) return false
  return deletedAt > localUpdatedAt
}

/**
 * Get all remote tombstones
 */
export function getRemoteTombstones(): Map<string, number> {
  return new Map(remoteTombstones)
}

// ============ Quick Check ============

/**
 * Quick check if Drive has any app data
 */
export async function checkHasData(): Promise<{ hasData: boolean; noteCount: number }> {
  try {
    const folder = await getOrCreateFolder()
    const { notesIndexFile } = DEFAULT_DRIVE_CONFIG

    const query = `name='${notesIndexFile}' and '${folder}' in parents and trashed=false`
    const result = await driveClient.searchFiles(query)

    if (!result.files?.length) {
      return { hasData: false, noteCount: 0 }
    }

    const indexFileId = result.files[0].id
    const indexContent = await driveClient.downloadFile<NotesIndex>(indexFileId)
    const noteCount = indexContent.notes?.length || 0

    return { hasData: noteCount > 0, noteCount }
  } catch (error) {
    console.error('[DriveIndex] checkHasData error:', error)
    return { hasData: false, noteCount: 0 }
  }
}
