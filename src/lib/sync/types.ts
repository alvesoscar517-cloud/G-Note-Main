/**
 * Sync Types
 * Type definitions for sync operations
 */
import type { Note } from '@/types'

// ============ Sync Status ============

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline'

export interface SyncState {
  status: SyncStatus
  lastSyncTime: number
  pendingCount: number
  error?: string
}

// ============ Sync Operation Types ============

export type SyncOperationType = 'create' | 'update' | 'delete'
export type SyncEntityType = 'note' | 'collection'

export interface SyncOperation {
  id: string
  type: SyncOperationType
  entityType: SyncEntityType
  entityId: string
  data?: Note
  priority: number
  timestamp: number
  retries: number
}

// ============ Sync Result Types ============

export interface SyncResult {
  success: boolean
  notesChanged: boolean
  syncedNotes: Note[]
  errors?: SyncError[]
  conflicts?: ConflictInfo[]
}

export interface SyncError {
  entityId: string
  entityType: SyncEntityType
  error: string
  retryable: boolean
}

// ============ Conflict Resolution ============

export type ConflictResolution = 'local' | 'remote' | 'merge'

export interface ConflictInfo {
  entityId: string
  entityType: SyncEntityType
  localVersion: number
  remoteVersion: number
  localUpdatedAt: number
  remoteUpdatedAt: number
  resolution: ConflictResolution
}

// ============ Sync Queue Config ============

export interface SyncQueueConfig {
  concurrency: number      // Max concurrent operations
  interval: number         // Rate limiting interval (ms)
  intervalCap: number      // Max operations per interval
  retryLimit: number       // Max retries per operation
  retryDelay: number       // Base delay between retries (ms)
}

export const DEFAULT_SYNC_CONFIG: SyncQueueConfig = {
  concurrency: 3,
  interval: 1000,
  intervalCap: 10,
  retryLimit: 3,
  retryDelay: 1000
}

// ============ Tombstone Types ============

export interface TombstoneData {
  id: string
  deletedAt: number
}
