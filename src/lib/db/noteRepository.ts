/**
 * Note Repository
 * CRUD operations for notes using Dexie
 */
import { db } from './schema'
import type { Note } from '@/types'

/**
 * Save a single note
 */
export async function saveNote(note: Note): Promise<void> {
  await db.notes.put(note)
}

/**
 * Save multiple notes in a transaction
 */
export async function saveNotes(notes: Note[]): Promise<void> {
  await db.notes.bulkPut(notes)
}

/**
 * Get a note by ID
 */
export async function getNote(id: string): Promise<Note | undefined> {
  return db.notes.get(id)
}

/**
 * Get all notes
 */
export async function getAllNotes(): Promise<Note[]> {
  return db.notes.toArray()
}

/**
 * Get notes by user ID
 */
export async function getNotesByUserId(userId: string): Promise<Note[]> {
  return db.notes.where('userId').equals(userId).toArray()
}

/**
 * Assign user ID to notes that don't have one
 * Used for migration when enabling multi-user support
 */
export async function assignUserIdToOrphanedNotes(userId: string): Promise<number> {
  return db.notes
    .filter(note => !note.userId)
    .modify({ userId })
}

/**
 * Get notes by collection ID
 */
export async function getNotesByCollection(collectionId: string): Promise<Note[]> {
  return db.notes.where('collectionId').equals(collectionId).toArray()
}

/**
 * Get notes by sync status
 */
export async function getNotesBySyncStatus(
  status: 'synced' | 'pending' | 'error'
): Promise<Note[]> {
  return db.notes.where('syncStatus').equals(status).toArray()
}

/**
 * Get notes that are not deleted
 */
export async function getActiveNotes(): Promise<Note[]> {
  return db.notes.filter(note => !note.isDeleted).toArray()
}

/**
 * Delete a note by ID
 */
export async function deleteNote(id: string): Promise<void> {
  await db.notes.delete(id)
}

/**
 * Delete multiple notes
 */
export async function deleteNotes(ids: string[]): Promise<void> {
  await db.notes.bulkDelete(ids)
}

/**
 * Update note sync status
 */
export async function updateNoteSyncStatus(
  id: string,
  syncStatus: 'synced' | 'pending' | 'error'
): Promise<void> {
  await db.notes.update(id, { syncStatus })
}

/**
 * Count all notes
 */
export async function countNotes(): Promise<number> {
  return db.notes.count()
}

/**
 * Clear all notes
 */
export async function clearNotes(): Promise<void> {
  await db.notes.clear()
}
