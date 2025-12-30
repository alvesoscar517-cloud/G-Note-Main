/**
 * Database Schema Definition using Dexie
 * Defines all tables and indexes for offline storage
 */
import Dexie, { type Table } from 'dexie'
import type { Note, Collection } from '@/types'

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

// ============ Database Class ============
export class GNoteDatabase extends Dexie {
  notes!: Table<Note, string>
  collections!: Table<Collection, string>
  syncQueue!: Table<SyncQueueItem, string>
  tombstones!: Table<Tombstone, string>
  metadata!: Table<MetadataItem, string>
  fileIdCache!: Table<FileIdCacheItem, string>

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
  }
}

// Singleton database instance
export const db = new GNoteDatabase()
