/**
 * Drive Types
 * Type definitions for Google Drive sync operations
 */
import type { Note, Collection } from '@/types'

// ============ Index File Types ============

export interface NoteIndexEntry {
  id: string
  fileId: string
  updatedAt: number
  version: number
}

export interface NotesIndex {
  notes: NoteIndexEntry[]
  lastSync: number
}

export interface CollectionIndexEntry {
  id: string
  fileId: string
  updatedAt: number
  version: number
}

export interface CollectionsIndex {
  collections: CollectionIndexEntry[]
  lastSync: number
}

// ============ Tombstone Types ============

export interface TombstoneEntry {
  id: string
  deletedAt: number
}

export interface DeletedIdsIndex {
  // Legacy format support (for backward compatibility)
  noteIds?: string[]
  collectionIds?: string[]
  // New format with timestamps
  noteTombstones?: TombstoneEntry[]
  collectionTombstones?: TombstoneEntry[]
  lastSync: number
}

// ============ Sync Result Types ============

export interface ConflictInfo {
  noteId: string
  localVersion: number
  remoteVersion: number
  resolution: 'local' | 'remote' | 'copy'
}

export interface SyncResult {
  notes: Note[]
  collections: Collection[]
  hasChanges: boolean
  conflicts?: ConflictInfo[]
  staleLocalIds?: string[]
}

// ============ Drive API Types ============

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime?: string
  version?: string
}

export interface DriveFileList {
  files: DriveFile[]
  nextPageToken?: string
}

// ============ Error Types ============

export type DriveErrorCode = 
  | 'DRIVE_QUOTA_EXCEEDED'
  | 'DRIVE_PERMISSION_DENIED'
  | 'DRIVE_CONFLICT_412'
  | 'DRIVE_FILE_CORRUPTED'
  | 'DRIVE_NOT_FOUND'
  | 'DRIVE_AUTH_ERROR'
  | 'DRIVE_NETWORK_ERROR'

export class DriveError extends Error {
  constructor(
    public code: DriveErrorCode,
    message: string,
    public originalError?: unknown
  ) {
    super(message)
    this.name = 'DriveError'
  }
}

// ============ Config Types ============

export interface DriveConfig {
  folderName: string
  notesIndexFile: string
  collectionsIndexFile: string
  deletedIdsFile: string
  tombstoneRetentionMs: number
}

export const DEFAULT_DRIVE_CONFIG: DriveConfig = {
  folderName: 'G-Note',
  notesIndexFile: 'notes-index.json',
  collectionsIndexFile: 'collections-index.json',
  deletedIdsFile: 'deleted-ids.json',
  tombstoneRetentionMs: 30 * 24 * 60 * 60 * 1000 // 30 days
}
