/**
 * Database Layer - Main Export
 * Re-exports database instance and all repositories
 */
export { db, GNoteDatabase } from './schema'
export type { SyncQueueItem, Tombstone, MetadataItem, FileIdCacheItem } from './schema'

export * from './noteRepository'
export * from './collectionRepository'
export * from './syncQueueRepository'
export * from './tombstoneRepository'
export * from './metadataRepository'
export * from './fileIdCacheRepository'
export * from './utils'

// Re-export priority constants
export { PRIORITY } from './syncQueueRepository'
