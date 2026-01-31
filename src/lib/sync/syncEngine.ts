/**
 * Sync Engine
 * Main orchestrator for sync operations
 * Coordinates between local database and Google Drive
 * 
 * This is the NEW sync engine that replaces driveSync.ts
 * 
 * Note: Collection support has been removed. Any collection files
 * encountered during sync are skipped with a warning (see Task 7.2).
 */
import { driveClient, resetDriveState } from '../drive'
import {
  getOrCreateNotesIndex,
  getOrCreateDeletedIdsIndex,
  updateNotesIndex,
  updateDeletedIdsIndex,
  getOrCreateFolder,
  checkHasData as driveCheckHasData,
  getRemoteTombstones as getDriveTombstones
} from '../drive/driveIndex'
import {
  uploadNote,
  downloadNote,
  deleteNoteFile,
  getNoteFileId,
  initFileIdCache,
  batchSetFileIds
} from '../drive/driveFiles'
import {
  resolveNoteConflict,
  mergeTombstones,
  filterSyncableNotes,
  isNoteEmpty,
  shouldDeleteEntity
} from './conflictResolver'
import { setLastSyncTimestamp } from '../db/metadataRepository'
import type { Note } from '@/types'
import type { TombstoneEntry } from '../drive/types'
import type { SyncResult, TombstoneData, ConflictInfo } from './types'

// Storage key for last sync (also in localStorage for quick access)
const LAST_SYNC_KEY = 'gnote-last-sync-timestamp'

// Concurrency settings for parallel operations
const DOWNLOAD_CONCURRENCY = 5
const UPLOAD_CONCURRENCY = 3

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
 * Check if an entry ID looks like a collection ID
 * Collection IDs typically don't follow the same pattern as note IDs
 * This is a defensive check to skip any collection entries that might remain in the index
 */
function isLikelyCollectionEntry(id: string): boolean {
  // Collection IDs in the old system often had specific prefixes or patterns
  // This is a defensive check - in practice, collection entries should already be removed
  return id.startsWith('collection-') || id.startsWith('col-')
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
    // Skip collection entries if any remain in the index
    if (isLikelyCollectionEntry(entry.id)) {
      console.warn(`[SyncEngine] Skipping collection entry ${entry.id} during sync`)
      return false
    }
    
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
 * Main sync function
 * Syncs local notes with Google Drive
 */
export async function syncWithDrive(
  accessToken: string,
  localNotes: Note[],
  localDeletedNoteIds: TombstoneData[]
): Promise<SyncResult> {
  // Set access token
  driveClient.setAccessToken(accessToken)

  // Initialize file ID cache from IndexedDB
  await initFileIdCache()

  const now = Date.now()
  const conflicts: ConflictInfo[] = []

  // ============ Load Remote Tombstones ============
  const remoteDeletedIndex = await getOrCreateDeletedIdsIndex()

  // Build tombstone maps
  const remoteNoteTombstones: TombstoneData[] = (remoteDeletedIndex.noteTombstones || [])
    .map(t => ({ id: t.id, deletedAt: t.deletedAt }))

  // Merge tombstones
  const allNoteTombstones = mergeTombstones(localDeletedNoteIds, remoteNoteTombstones)

  // Filter local data
  const validLocalNotes = filterSyncableNotes(localNotes, allNoteTombstones)

  // ============ Sync Notes ============
  const notesIndex = await getOrCreateNotesIndex()

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

  // Add remote notes first
  for (const note of remoteNotes) {
    const tombstoneTime = allNoteTombstones.get(note.id)
    if (!tombstoneTime || !shouldDeleteEntity(note.updatedAt, tombstoneTime)) {
      mergedNotesMap.set(note.id, note)
    }
  }

  // Merge local notes
  for (const localNote of validLocalNotes) {
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

  // ============ Update Deleted IDs Index ============
  const finalNoteTombstones: TombstoneEntry[] = Array.from(allNoteTombstones.entries())
    .map(([id, deletedAt]) => ({ id, deletedAt }))

  await updateDeletedIdsIndex(finalNoteTombstones, [])

  // ============ Check for Changes ============
  const notesChanged =
    JSON.stringify(mergedNotes.map(n => n.id).sort()) !==
    JSON.stringify(localNotes.map(n => n.id).sort())

  // Mark as synced
  const syncedNotes = mergedNotes.map(note => ({
    ...note,
    syncStatus: 'synced' as const,
    driveFileId: getNoteFileId(note.id)
  }))

  // Save last sync timestamp
  await saveLastSyncTimestamp(now)

  return {
    success: true,
    notesChanged,
    syncedNotes,
    conflicts: conflicts.length > 0 ? conflicts : undefined
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
 * Upload a single note to Drive
 */
export async function uploadSingleNote(note: Note): Promise<string> {
  const folderId = await getOrCreateFolder()
  return uploadNote(note, folderId)
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
