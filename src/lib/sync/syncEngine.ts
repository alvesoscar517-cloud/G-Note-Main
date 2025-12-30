/**
 * Sync Engine
 * Main orchestrator for sync operations
 * Coordinates between local database and Google Drive
 * 
 * This is the NEW sync engine that replaces driveSync.ts
 */
import { driveClient, resetDriveState } from '../drive'
import {
  getOrCreateNotesIndex,
  getOrCreateCollectionsIndex,
  getOrCreateDeletedIdsIndex,
  updateNotesIndex,
  updateCollectionsIndex,
  updateDeletedIdsIndex,
  getOrCreateFolder,
  checkHasData as driveCheckHasData,
  getRemoteTombstones as getDriveTombstones
} from '../drive/driveIndex'
import {
  uploadNote,
  uploadCollection,
  downloadNote,
  downloadCollection,
  deleteNoteFile,
  deleteCollectionFile,
  getNoteFileId,
  getCollectionFileId,
  setNoteFileId,
  setCollectionFileId,
  initFileIdCache,
  batchSetFileIds
} from '../drive/driveFiles'
import {
  resolveNoteConflict,
  resolveCollectionConflict,
  mergeTombstones,
  filterSyncableNotes,
  filterSyncableCollections,
  isNoteEmpty,
  shouldDeleteEntity
} from './conflictResolver'
import { setLastSyncTimestamp } from '../db/metadataRepository'
import type { Note, Collection } from '@/types'
import type { TombstoneEntry } from '../drive/types'
import type { SyncResult, TombstoneData, ConflictInfo } from './types'
import { STALE_DEVICE_THRESHOLD_MS } from './types'

// Storage key for last sync (also in localStorage for quick access)
const LAST_SYNC_KEY = 'gnote-last-sync-timestamp'

// Concurrency settings for parallel operations
const DOWNLOAD_CONCURRENCY = 5
const UPLOAD_CONCURRENCY = 3

/**
 * Check if device has been offline longer than tombstone retention period
 */
function isStaleDevice(): boolean {
  try {
    const stored = localStorage.getItem(LAST_SYNC_KEY)
    const lastSync = stored ? parseInt(stored, 10) : 0
    if (lastSync === 0) return false // First sync
    
    const timeSinceLastSync = Date.now() - lastSync
    return timeSinceLastSync > STALE_DEVICE_THRESHOLD_MS
  } catch {
    return false
  }
}

/**
 * Save last sync timestamp to both localStorage and IndexedDB
 */
async function saveLastSyncTimestamp(timestamp: number): Promise<void> {
  try {
    localStorage.setItem(LAST_SYNC_KEY, timestamp.toString())
  } catch {
    // Ignore localStorage errors
  }
  await setLastSyncTimestamp(timestamp)
}

/**
 * Get IDs of local notes that should be removed due to stale data
 */
function getStaleLocalNoteIds(
  localNoteIds: string[],
  remoteNoteIds: Set<string>,
  syncQueueIds: Set<string>
): string[] {
  if (!isStaleDevice()) return []

  const staleIds: string[] = []
  for (const localId of localNoteIds) {
    // If note exists locally but not on remote, and wasn't created while offline
    if (!remoteNoteIds.has(localId) && !syncQueueIds.has(localId)) {
      staleIds.push(localId)
      console.log(`[SyncEngine] Stale device: removing local note ${localId}`)
    }
  }
  return staleIds
}

/**
 * Helper function to run promises with concurrency limit
 */
async function runWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = []
  const executing: Promise<void>[] = []

  for (const item of items) {
    const promise = fn(item).then(result => {
      results.push(result)
    })
    executing.push(promise)

    if (executing.length >= concurrency) {
      await Promise.race(executing)
      // Remove completed promises
      const completed = executing.filter(p => {
        let resolved = false
        p.then(() => { resolved = true }).catch(() => { resolved = true })
        return resolved
      })
      for (const c of completed) {
        const idx = executing.indexOf(c)
        if (idx > -1) executing.splice(idx, 1)
      }
    }
  }

  await Promise.all(executing)
  return results
}

/**
 * Batch download notes with concurrency limit
 */
async function batchDownloadNotes(
  entries: Array<{ id: string; fileId: string; updatedAt: number }>,
  allNoteTombstones: Map<string, number>
): Promise<{ notes: Note[]; fileIdMappings: Array<{ entityId: string; fileId: string; entityType: 'note' }> }> {
  const notes: Note[] = []
  const fileIdMappings: Array<{ entityId: string; fileId: string; entityType: 'note' }> = []

  // Filter entries that should be downloaded
  const toDownload = entries.filter(entry => {
    const tombstoneTime = allNoteTombstones.get(entry.id)
    return !tombstoneTime || !shouldDeleteEntity(entry.updatedAt, tombstoneTime)
  })

  // Download in parallel with concurrency limit
  const downloadPromises = toDownload.map(entry => async () => {
    if (!entry.fileId) return null
    
    try {
      const note = await downloadNote(entry.fileId)
      if (note && !isNoteEmpty(note)) {
        const noteTombstone = allNoteTombstones.get(note.id)
        if (!noteTombstone || !shouldDeleteEntity(note.updatedAt, noteTombstone)) {
          return { note, entry }
        }
      }
    } catch (error) {
      console.error(`[SyncEngine] Failed to download note ${entry.id}:`, error)
    }
    return null
  })

  // Execute with concurrency
  const chunks: Array<() => Promise<{ note: Note; entry: typeof toDownload[0] } | null>>[] = []
  for (let i = 0; i < downloadPromises.length; i += DOWNLOAD_CONCURRENCY) {
    chunks.push(downloadPromises.slice(i, i + DOWNLOAD_CONCURRENCY))
  }

  for (const chunk of chunks) {
    const results = await Promise.all(chunk.map(fn => fn()))
    for (const result of results) {
      if (result) {
        notes.push(result.note)
        fileIdMappings.push({
          entityId: result.note.id,
          fileId: result.entry.fileId,
          entityType: 'note'
        })
      }
    }
  }

  return { notes, fileIdMappings }
}

/**
 * Batch download collections with concurrency limit
 */
async function batchDownloadCollections(
  entries: Array<{ id: string; fileId: string; updatedAt: number }>,
  allCollectionTombstones: Map<string, number>
): Promise<{ collections: Collection[]; fileIdMappings: Array<{ entityId: string; fileId: string; entityType: 'collection' }> }> {
  const collections: Collection[] = []
  const fileIdMappings: Array<{ entityId: string; fileId: string; entityType: 'collection' }> = []

  const toDownload = entries.filter(entry => {
    const tombstoneTime = allCollectionTombstones.get(entry.id)
    return !tombstoneTime || !shouldDeleteEntity(entry.updatedAt, tombstoneTime)
  })

  const chunks: Array<typeof toDownload[0]>[] = []
  for (let i = 0; i < toDownload.length; i += DOWNLOAD_CONCURRENCY) {
    chunks.push(toDownload.slice(i, i + DOWNLOAD_CONCURRENCY))
  }

  for (const chunk of chunks) {
    const results = await Promise.all(
      chunk.map(async entry => {
        if (!entry.fileId) return null
        
        try {
          const collection = await downloadCollection(entry.fileId)
          if (collection) {
            const collectionTombstone = allCollectionTombstones.get(collection.id)
            if (!collectionTombstone || !shouldDeleteEntity(collection.updatedAt, collectionTombstone)) {
              return { collection, entry }
            }
          }
        } catch (error) {
          console.error(`[SyncEngine] Failed to download collection ${entry.id}:`, error)
        }
        return null
      })
    )

    for (const result of results) {
      if (result) {
        collections.push(result.collection)
        fileIdMappings.push({
          entityId: result.collection.id,
          fileId: result.entry.fileId,
          entityType: 'collection'
        })
      }
    }
  }

  return { collections, fileIdMappings }
}

/**
 * Batch upload notes with concurrency limit
 */
async function batchUploadNotes(
  notes: Note[],
  notesIndex: { notes: Array<{ id: string; version?: number; updatedAt: number }> },
  folderId: string
): Promise<void> {
  const toUpload = notes.filter(note => {
    const remoteEntry = notesIndex.notes.find(n => n.id === note.id)
    const noteVersion = note.version || 1
    const remoteVersion = remoteEntry?.version || 0
    return !remoteEntry || noteVersion > remoteVersion || note.updatedAt > remoteEntry.updatedAt
  })

  if (toUpload.length === 0) return

  console.log(`[SyncEngine] Uploading ${toUpload.length} notes...`)

  const chunks: Note[][] = []
  for (let i = 0; i < toUpload.length; i += UPLOAD_CONCURRENCY) {
    chunks.push(toUpload.slice(i, i + UPLOAD_CONCURRENCY))
  }

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(note => uploadNote(note, folderId).catch(error => {
        console.error(`[SyncEngine] Failed to upload note ${note.id}:`, error)
      }))
    )
  }
}

/**
 * Batch upload collections with concurrency limit
 */
async function batchUploadCollections(
  collections: Collection[],
  collectionsIndex: { collections: Array<{ id: string; version?: number; updatedAt: number }> },
  folderId: string
): Promise<void> {
  const toUpload = collections.filter(collection => {
    const remoteEntry = collectionsIndex.collections.find(c => c.id === collection.id)
    const collectionVersion = collection.version || 1
    const remoteVersion = remoteEntry?.version || 0
    return !remoteEntry || collectionVersion > remoteVersion || collection.updatedAt > remoteEntry.updatedAt
  })

  if (toUpload.length === 0) return

  console.log(`[SyncEngine] Uploading ${toUpload.length} collections...`)

  const chunks: Collection[][] = []
  for (let i = 0; i < toUpload.length; i += UPLOAD_CONCURRENCY) {
    chunks.push(toUpload.slice(i, i + UPLOAD_CONCURRENCY))
  }

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(collection => uploadCollection(collection, folderId).catch(error => {
        console.error(`[SyncEngine] Failed to upload collection ${collection.id}:`, error)
      }))
    )
  }
}

/**
 * Main sync function
 * Syncs local notes and collections with Google Drive
 */
export async function syncWithDrive(
  accessToken: string,
  localNotes: Note[],
  localCollections: Collection[],
  localDeletedNoteIds: TombstoneData[],
  localDeletedCollectionIds: TombstoneData[],
  syncQueueIds?: Set<string>
): Promise<SyncResult> {
  // Set access token
  driveClient.setAccessToken(accessToken)

  // Initialize file ID cache from IndexedDB
  await initFileIdCache()

  const now = Date.now()
  const conflicts: ConflictInfo[] = []
  const staleLocalIds: string[] = []

  // Check if device is stale
  const isStale = isStaleDevice()
  if (isStale) {
    console.warn('[SyncEngine] Device has been offline > 30 days. Using remote authority mode.')
  }

  // ============ Load Remote Tombstones ============
  const remoteDeletedIndex = await getOrCreateDeletedIdsIndex()

  // Build tombstone maps
  const remoteNoteTombstones: TombstoneData[] = (remoteDeletedIndex.noteTombstones || [])
    .map(t => ({ id: t.id, deletedAt: t.deletedAt }))
  const remoteCollectionTombstones: TombstoneData[] = (remoteDeletedIndex.collectionTombstones || [])
    .map(t => ({ id: t.id, deletedAt: t.deletedAt }))

  // Merge tombstones
  const allNoteTombstones = mergeTombstones(localDeletedNoteIds, remoteNoteTombstones)
  const allCollectionTombstones = mergeTombstones(localDeletedCollectionIds, remoteCollectionTombstones)

  // Filter local data
  const validLocalNotes = filterSyncableNotes(localNotes, allNoteTombstones)
  const validLocalCollections = filterSyncableCollections(localCollections, allCollectionTombstones)

  // ============ Sync Notes ============
  const notesIndex = await getOrCreateNotesIndex()
  const remoteNoteIds = new Set(notesIndex.notes.map(n => n.id))

  // Handle stale device
  if (isStale && syncQueueIds) {
    const localNoteIds = localNotes.map(n => n.id)
    const staleNotes = getStaleLocalNoteIds(localNoteIds, remoteNoteIds, syncQueueIds)
    staleLocalIds.push(...staleNotes)
  }

  // Download remote notes in parallel
  const folderId = await getOrCreateFolder()
  const { notes: remoteNotes, fileIdMappings: noteFileIdMappings } = await batchDownloadNotes(
    notesIndex.notes,
    allNoteTombstones
  )

  // Batch set file IDs
  if (noteFileIdMappings.length > 0) {
    await batchSetFileIds(noteFileIdMappings)
  }

  // Merge notes with conflict resolution
  const mergedNotesMap = new Map<string, Note>()
  const staleIdSet = new Set(staleLocalIds)

  // Add remote notes first
  for (const note of remoteNotes) {
    const tombstoneTime = allNoteTombstones.get(note.id)
    if (!tombstoneTime || !shouldDeleteEntity(note.updatedAt, tombstoneTime)) {
      mergedNotesMap.set(note.id, note)
    }
  }

  // Merge local notes
  for (const localNote of validLocalNotes) {
    // Skip stale notes
    if (staleIdSet.has(localNote.id)) continue

    const remoteNote = mergedNotesMap.get(localNote.id)
    if (!remoteNote) {
      mergedNotesMap.set(localNote.id, localNote)
    } else {
      // Resolve conflict
      const { winner, conflict } = resolveNoteConflict(localNote, remoteNote)
      mergedNotesMap.set(localNote.id, winner)
      conflicts.push(conflict)
    }
  }

  const mergedNotes = Array.from(mergedNotesMap.values())

  // Upload changed notes in parallel
  await batchUploadNotes(mergedNotes, notesIndex, folderId)

  // Delete notes that should be deleted
  const notesToDelete = notesIndex.notes.filter(entry => {
    const tombstoneTime = allNoteTombstones.get(entry.id)
    return tombstoneTime && shouldDeleteEntity(entry.updatedAt, tombstoneTime)
  })
  
  await Promise.all(notesToDelete.map(entry => deleteNoteFile(entry.id).catch(console.error)))

  // Update notes index
  await updateNotesIndex(
    mergedNotes.map(n => ({
      id: n.id,
      fileId: getNoteFileId(n.id) || '',
      updatedAt: n.updatedAt,
      version: n.version || 1
    }))
  )

  // ============ Sync Collections ============
  const collectionsIndex = await getOrCreateCollectionsIndex()

  // Download remote collections in parallel
  const { collections: remoteCollections, fileIdMappings: collectionFileIdMappings } = await batchDownloadCollections(
    collectionsIndex.collections,
    allCollectionTombstones
  )

  // Batch set file IDs
  if (collectionFileIdMappings.length > 0) {
    await batchSetFileIds(collectionFileIdMappings)
  }

  // Merge collections
  const mergedCollectionsMap = new Map<string, Collection>()

  for (const collection of remoteCollections) {
    const tombstoneTime = allCollectionTombstones.get(collection.id)
    if (!tombstoneTime || !shouldDeleteEntity(collection.updatedAt, tombstoneTime)) {
      mergedCollectionsMap.set(collection.id, collection)
    }
  }

  for (const localCollection of validLocalCollections) {
    const remoteCollection = mergedCollectionsMap.get(localCollection.id)
    if (!remoteCollection) {
      mergedCollectionsMap.set(localCollection.id, localCollection)
    } else {
      const { winner, conflict } = resolveCollectionConflict(localCollection, remoteCollection)
      mergedCollectionsMap.set(localCollection.id, winner)
      conflicts.push(conflict)
    }
  }

  const mergedCollections = Array.from(mergedCollectionsMap.values())

  // Upload changed collections in parallel
  await batchUploadCollections(mergedCollections, collectionsIndex, folderId)

  // Delete collections that should be deleted
  const collectionsToDelete = collectionsIndex.collections.filter(entry => {
    const tombstoneTime = allCollectionTombstones.get(entry.id)
    return tombstoneTime && shouldDeleteEntity(entry.updatedAt, tombstoneTime)
  })
  
  await Promise.all(collectionsToDelete.map(entry => deleteCollectionFile(entry.id).catch(console.error)))

  // Update collections index
  await updateCollectionsIndex(
    mergedCollections.map(c => ({
      id: c.id,
      fileId: getCollectionFileId(c.id) || '',
      updatedAt: c.updatedAt,
      version: c.version || 1
    }))
  )

  // ============ Update Deleted IDs Index ============
  const finalNoteTombstones: TombstoneEntry[] = Array.from(allNoteTombstones.entries())
    .map(([id, deletedAt]) => ({ id, deletedAt }))
  const finalCollectionTombstones: TombstoneEntry[] = Array.from(allCollectionTombstones.entries())
    .map(([id, deletedAt]) => ({ id, deletedAt }))

  await updateDeletedIdsIndex(finalNoteTombstones, finalCollectionTombstones)

  // ============ Check for Changes ============
  const notesChanged =
    JSON.stringify(mergedNotes.map(n => n.id).sort()) !==
    JSON.stringify(localNotes.map(n => n.id).sort())
  const collectionsChanged =
    JSON.stringify(mergedCollections.map(c => c.id).sort()) !==
    JSON.stringify(localCollections.map(c => c.id).sort())

  // Mark as synced
  const syncedNotes = mergedNotes.map(note => ({
    ...note,
    syncStatus: 'synced' as const,
    driveFileId: getNoteFileId(note.id)
  }))

  const syncedCollections = mergedCollections.map(collection => ({
    ...collection,
    syncStatus: 'synced' as const
  }))

  // Save last sync timestamp
  await saveLastSyncTimestamp(now)

  return {
    success: true,
    notesChanged,
    collectionsChanged,
    syncedNotes,
    syncedCollections,
    conflicts: conflicts.length > 0 ? conflicts : undefined,
    staleLocalIds: staleLocalIds.length > 0 ? staleLocalIds : undefined
  }
}

/**
 * Check if Drive has any app data (lightweight check)
 */
export async function checkHasData(accessToken: string): Promise<{ hasData: boolean; noteCount: number }> {
  driveClient.setAccessToken(accessToken)
  return driveCheckHasData()
}

/**
 * Get remote tombstones map
 */
export function getRemoteTombstones(): Map<string, number> {
  return getDriveTombstones()
}

/**
 * Delete a note file from Drive
 */
export async function deleteNoteDriveFile(noteId: string): Promise<void> {
  await deleteNoteFile(noteId)
}

/**
 * Delete a collection file from Drive
 */
export async function deleteCollectionDriveFile(collectionId: string): Promise<void> {
  await deleteCollectionFile(collectionId)
}

/**
 * Upload a single note to Drive
 */
export async function uploadSingleNote(note: Note): Promise<string> {
  const folderId = await getOrCreateFolder()
  return uploadNote(note, folderId)
}

/**
 * Upload a single collection to Drive
 */
export async function uploadSingleCollection(collection: Collection): Promise<string> {
  const folderId = await getOrCreateFolder()
  return uploadCollection(collection, folderId)
}

/**
 * Reset sync engine state
 */
export function resetSyncEngine(): void {
  resetDriveState()
}

/**
 * Set access token for sync operations
 */
export function setSyncAccessToken(token: string): void {
  driveClient.setAccessToken(token)
}

/**
 * Get note file ID from cache
 */
export function getSyncNoteFileId(noteId: string): string | undefined {
  return getNoteFileId(noteId)
}

/**
 * Get collection file ID from cache
 */
export function getSyncCollectionFileId(collectionId: string): string | undefined {
  return getCollectionFileId(collectionId)
}
