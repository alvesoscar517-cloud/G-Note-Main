/**
 * Database Schema Definition using Dexie
 * Defines all tables and indexes for offline storage
 */
import Dexie, { type Table } from 'dexie'
import type { Note } from '@/types'

// ============ Legacy Types (for migration support) ============

/**
 * Collection interface - kept for migration and backup purposes only
 * This type is no longer used in the application but is needed for:
 * - Migration backup/restore operations
 * - Sync queue backward compatibility
 */
export interface Collection {
  id: string
  name: string
  color: string
  noteIds: string[]
  isExpanded: boolean
  createdAt: number
  updatedAt: number
  version: number
  syncStatus: 'synced' | 'pending' | 'error'
  driveFileId?: string
}

// ============ Sync Queue Types ============
export interface SyncQueueItem {
  id: string
  type: 'create' | 'update' | 'delete'
  entityType: 'note' | 'collection'
  entityId: string
  data?: Note | Collection
  timestamp: number
  retries: number
  priority: number  // Higher = more urgent (e.g., currently open note)
  error?: string
}

// ============ Tombstone Types ============
export interface Tombstone {
  id: string
  entityType: 'note' | 'collection'
  deletedAt: number
}

// ============ Metadata Types ============
export interface MetadataItem {
  key: string
  value: unknown
}

// ============ File ID Cache Types ============
export interface FileIdCacheItem {
  entityId: string
  fileId: string
  entityType: 'note' | 'collection'
  updatedAt: number
}

// ============ Migration Backup Types ============
export interface MigrationBackup {
  timestamp: number
  notes: Note[]
  collections: Collection[]
  version: number
}

// ============ Database Class ============
export class GNoteDatabase extends Dexie {
  notes!: Table<Note, string>
  collections?: Table<Collection, string>  // Optional - removed in version 10
  syncQueue!: Table<SyncQueueItem, string>
  tombstones!: Table<Tombstone, string>
  metadata!: Table<MetadataItem, string>
  fileIdCache!: Table<FileIdCacheItem, string>
  migrationBackup!: Table<MigrationBackup, number>

  constructor() {
    super('gnote-offline')
    
    // Version 7: New schema with Dexie
    // Maintains backward compatibility with existing data
    this.version(7).stores({
      // Notes: indexed by id, collectionId, updatedAt, syncStatus, isDeleted
      notes: 'id, collectionId, updatedAt, syncStatus, isDeleted',
      
      // Collections: indexed by id, updatedAt, syncStatus
      collections: 'id, updatedAt, syncStatus',
      
      // Sync Queue: indexed by id, entityType, priority, timestamp
      // Compound index [entityType+entityId] for deduplication
      syncQueue: 'id, entityType, entityId, priority, timestamp, [entityType+entityId]',
      
      // Tombstones: indexed by id, entityType, deletedAt
      tombstones: 'id, entityType, deletedAt',
      
      // Metadata: simple key-value store
      metadata: 'key'
    })
    
    // Version 8: Add file ID cache for persistence
    this.version(8).stores({
      notes: 'id, collectionId, updatedAt, syncStatus, isDeleted',
      collections: 'id, updatedAt, syncStatus',
      syncQueue: 'id, entityType, entityId, priority, timestamp, [entityType+entityId]',
      tombstones: 'id, entityType, deletedAt',
      metadata: 'key',
      fileIdCache: 'entityId, entityType'
    })

    // Version 9: Add migration backup table for collection removal migration
    this.version(9).stores({
      notes: 'id, collectionId, updatedAt, syncStatus, isDeleted',
      collections: 'id, updatedAt, syncStatus',
      syncQueue: 'id, entityType, entityId, priority, timestamp, [entityType+entityId]',
      tombstones: 'id, entityType, deletedAt',
      metadata: 'key',
      fileIdCache: 'entityId, entityType',
      migrationBackup: 'timestamp'
    })

    // Version 10: Remove collections table and collectionId index from notes
    this.version(10).stores({
      // Remove collectionId index from notes
      notes: 'id, updatedAt, syncStatus, isDeleted',
      
      // Remove collections table by setting it to null
      collections: null,
      
      syncQueue: 'id, entityType, entityId, priority, timestamp, [entityType+entityId]',
      tombstones: 'id, entityType, deletedAt',
      metadata: 'key',
      fileIdCache: 'entityId, entityType',
      migrationBackup: 'timestamp'
    }).upgrade(async () => {
      // Migration logic is handled by RemoveCollectionMigration
      // This upgrade hook just logs the schema change
      console.log('[Schema] Upgraded to version 10 - collections table removed, collectionId index removed from notes')
    })
  }
}

// Singleton database instance
export const db = new GNoteDatabase()
