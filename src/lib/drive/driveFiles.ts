/**
 * Drive Files
 * File operations for notes and collections
 */
import { driveClient } from './driveClient'
import { DriveError } from './types'
import type { Note, Collection } from '@/types'
import {
  saveFileId,
  saveFileIds,
  deleteFileId,
  loadFileIdsToMemory
} from '@/lib/db/fileIdCacheRepository'

// Memory cache for file IDs (loaded from IndexedDB on init)
let noteFileIds = new Map<string, string>()
let collectionFileIds = new Map<string, string>()
let cacheInitialized = false

/**
 * Initialize file ID cache from IndexedDB
 */
export async function initFileIdCache(): Promise<void> {
  if (cacheInitialized) return
  
  try {
    const { noteFileIds: notes, collectionFileIds: collections } = await loadFileIdsToMemory()
    noteFileIds = notes
    collectionFileIds = collections
    cacheInitialized = true
    console.log(`[DriveFiles] Loaded ${notes.size} note IDs, ${collections.size} collection IDs from cache`)
  } catch (error) {
    console.error('[DriveFiles] Failed to load file ID cache:', error)
  }
}

/**
 * Clear file ID caches (memory and IndexedDB)
 */
export function clearFileIdCaches(): void {
  noteFileIds.clear()
  collectionFileIds.clear()
  cacheInitialized = false
}

/**
 * Set note file ID in cache (memory + IndexedDB)
 */
export function setNoteFileId(noteId: string, fileId: string): void {
  noteFileIds.set(noteId, fileId)
  // Persist to IndexedDB asynchronously
  saveFileId(noteId, fileId, 'note').catch(console.error)
}

/**
 * Get note file ID from cache
 */
export function getNoteFileId(noteId: string): string | undefined {
  return noteFileIds.get(noteId)
}

/**
 * Set collection file ID in cache (memory + IndexedDB)
 */
export function setCollectionFileId(collectionId: string, fileId: string): void {
  collectionFileIds.set(collectionId, fileId)
  // Persist to IndexedDB asynchronously
  saveFileId(collectionId, fileId, 'collection').catch(console.error)
}

/**
 * Get collection file ID from cache
 */
export function getCollectionFileId(collectionId: string): string | undefined {
  return collectionFileIds.get(collectionId)
}

/**
 * Batch set file IDs (for sync optimization)
 */
export async function batchSetFileIds(
  items: Array<{ entityId: string; fileId: string; entityType: 'note' | 'collection' }>
): Promise<void> {
  // Update memory cache
  for (const item of items) {
    if (item.entityType === 'note') {
      noteFileIds.set(item.entityId, item.fileId)
    } else {
      collectionFileIds.set(item.entityId, item.fileId)
    }
  }
  // Persist to IndexedDB
  await saveFileIds(items)
}

// ============ Note Operations ============

/**
 * Upload a note to Drive
 */
export async function uploadNote(note: Note, folderId: string): Promise<string> {
  const existingFileId = noteFileIds.get(note.id)

  if (existingFileId) {
    await driveClient.updateFile(existingFileId, note)
    return existingFileId
  }

  const fileName = `note-${note.id}.json`
  const fileId = await driveClient.createFile(fileName, note, folderId)
  noteFileIds.set(note.id, fileId)
  return fileId
}

/**
 * Download a note from Drive
 */
export async function downloadNote(fileId: string): Promise<Note | null> {
  try {
    const text = await driveClient.downloadFileAsText(fileId)
    
    try {
      return JSON.parse(text)
    } catch (parseError) {
      console.error(`[DriveFiles] Corrupted note file ${fileId}:`, parseError)
      return null
    }
  } catch (error) {
    if (error instanceof DriveError && error.code === 'DRIVE_NOT_FOUND') {
      return null
    }
    throw error
  }
}

/**
 * Delete a note file from Drive
 */
export async function deleteNoteFile(noteId: string): Promise<void> {
  const fileId = noteFileIds.get(noteId)
  if (!fileId) return

  try {
    await driveClient.deleteFile(fileId)
  } catch (error) {
    // Ignore 404 errors - file already deleted
    if (error instanceof DriveError && error.code === 'DRIVE_NOT_FOUND') {
      console.log(`[DriveFiles] Note file ${fileId} already deleted`)
    } else {
      throw error
    }
  }

  noteFileIds.delete(noteId)
  // Remove from IndexedDB cache
  deleteFileId(noteId).catch(console.error)
}

// ============ Collection Operations ============

/**
 * Upload a collection to Drive
 */
export async function uploadCollection(
  collection: Collection,
  folderId: string
): Promise<string> {
  const existingFileId = collectionFileIds.get(collection.id)

  if (existingFileId) {
    await driveClient.updateFile(existingFileId, collection)
    return existingFileId
  }

  const fileName = `collection-${collection.id}.json`
  const fileId = await driveClient.createFile(fileName, collection, folderId)
  collectionFileIds.set(collection.id, fileId)
  return fileId
}

/**
 * Download a collection from Drive
 */
export async function downloadCollection(fileId: string): Promise<Collection | null> {
  try {
    const text = await driveClient.downloadFileAsText(fileId)
    
    try {
      return JSON.parse(text)
    } catch (parseError) {
      console.error(`[DriveFiles] Corrupted collection file ${fileId}:`, parseError)
      return null
    }
  } catch (error) {
    if (error instanceof DriveError && error.code === 'DRIVE_NOT_FOUND') {
      return null
    }
    throw error
  }
}

/**
 * Delete a collection file from Drive
 */
export async function deleteCollectionFile(collectionId: string): Promise<void> {
  const fileId = collectionFileIds.get(collectionId)
  if (!fileId) return

  try {
    await driveClient.deleteFile(fileId)
  } catch (error) {
    if (error instanceof DriveError && error.code === 'DRIVE_NOT_FOUND') {
      console.log(`[DriveFiles] Collection file ${fileId} already deleted`)
    } else {
      throw error
    }
  }

  collectionFileIds.delete(collectionId)
  // Remove from IndexedDB cache
  deleteFileId(collectionId).catch(console.error)
}
