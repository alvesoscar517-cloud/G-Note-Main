/**
 * IndexedDB wrapper for offline storage
 * This is the SINGLE SOURCE OF TRUTH for offline data
 * Provides structured storage for notes, collections, sync queue, and metadata
 */
import { openDB, type IDBPDatabase } from 'idb'
import type { Note, Collection } from '@/types'

const DB_NAME = 'gnote-offline'
const DB_VERSION = 2 // Bumped for new stores

// Sync queue item structure
export interface SyncQueueItem {
  id: string
  type: 'create' | 'update' | 'delete'
  entityType: 'note' | 'collection'
  entityId: string
  data?: Note | Collection
  timestamp: number
  retries: number
  error?: string
}

// Database schema
interface GNoteDB {
  notes: {
    key: string
    value: Note
    indexes: { 'by-updated': number; 'by-sync-status': string; 'by-collection': string }
  }
  collections: {
    key: string
    value: Collection
    indexes: { 'by-updated': number; 'by-sync-status': string }
  }
  syncQueue: {
    key: string
    value: SyncQueueItem
    indexes: { 'by-timestamp': number; 'by-entityId': string; 'by-entityType': string }
  }
  metadata: {
    key: string
    value: { key: string; value: unknown }
  }
  deletedIds: {
    key: string
    value: { id: string; entityType: 'note' | 'collection'; deletedAt: number }
  }
}

let dbInstance: IDBPDatabase<GNoteDB> | null = null

/**
 * Initialize and get database instance
 */
export async function getDb(): Promise<IDBPDatabase<GNoteDB>> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<GNoteDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Notes store
      if (!db.objectStoreNames.contains('notes')) {
        const notesStore = db.createObjectStore('notes', { keyPath: 'id' })
        notesStore.createIndex('by-updated', 'updatedAt')
        notesStore.createIndex('by-sync-status', 'syncStatus')
        notesStore.createIndex('by-collection', 'collectionId')
      }

      // Collections store (new in v2)
      if (!db.objectStoreNames.contains('collections')) {
        const collectionsStore = db.createObjectStore('collections', { keyPath: 'id' })
        collectionsStore.createIndex('by-updated', 'updatedAt')
        collectionsStore.createIndex('by-sync-status', 'syncStatus')
      }

      // Sync queue store
      if (!db.objectStoreNames.contains('syncQueue')) {
        const queueStore = db.createObjectStore('syncQueue', { keyPath: 'id' })
        queueStore.createIndex('by-timestamp', 'timestamp')
        queueStore.createIndex('by-entityId', 'entityId')
        queueStore.createIndex('by-entityType', 'entityType')
      } else if (oldVersion < 2) {
        // Migrate old syncQueue to new format
        // Old format had 'noteId', new format has 'entityId' and 'entityType'
      }

      // Metadata store for misc data
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'key' })
      }

      // Deleted IDs store (new in v2) - tracks permanently deleted items for sync
      if (!db.objectStoreNames.contains('deletedIds')) {
        db.createObjectStore('deletedIds', { keyPath: 'id' })
      }
    }
  })

  return dbInstance
}

// ============ Notes Operations ============

/**
 * Save a note to IndexedDB
 */
export async function saveNote(note: Note): Promise<void> {
  const db = await getDb()
  await db.put('notes', note)
}

/**
 * Save multiple notes to IndexedDB (transactional)
 */
export async function saveNotes(notes: Note[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('notes', 'readwrite')
  await Promise.all([
    ...notes.map(note => tx.store.put(note)),
    tx.done
  ])
}

/**
 * Get a note by ID
 */
export async function getNote(id: string): Promise<Note | undefined> {
  const db = await getDb()
  return db.get('notes', id)
}

/**
 * Get all notes from IndexedDB
 */
export async function getAllNotes(): Promise<Note[]> {
  const db = await getDb()
  return db.getAll('notes')
}

/**
 * Delete a note from IndexedDB
 */
export async function deleteNote(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('notes', id)
}

/**
 * Get notes by sync status
 */
export async function getNotesBySyncStatus(status: 'synced' | 'pending' | 'error'): Promise<Note[]> {
  const db = await getDb()
  return db.getAllFromIndex('notes', 'by-sync-status', status)
}

/**
 * Get notes by collection ID
 */
export async function getNotesByCollection(collectionId: string): Promise<Note[]> {
  const db = await getDb()
  return db.getAllFromIndex('notes', 'by-collection', collectionId)
}

// ============ Collections Operations ============

/**
 * Save a collection to IndexedDB
 */
export async function saveCollection(collection: Collection): Promise<void> {
  const db = await getDb()
  await db.put('collections', collection)
}

/**
 * Save multiple collections to IndexedDB (transactional)
 */
export async function saveCollections(collections: Collection[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('collections', 'readwrite')
  await Promise.all([
    ...collections.map(c => tx.store.put(c)),
    tx.done
  ])
}

/**
 * Get a collection by ID
 */
export async function getCollection(id: string): Promise<Collection | undefined> {
  const db = await getDb()
  return db.get('collections', id)
}

/**
 * Get all collections from IndexedDB
 */
export async function getAllCollections(): Promise<Collection[]> {
  const db = await getDb()
  return db.getAll('collections')
}

/**
 * Delete a collection from IndexedDB
 */
export async function deleteCollection(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('collections', id)
}

// ============ Deleted IDs Operations ============

/**
 * Add a deleted ID to track for sync
 */
export async function addDeletedId(id: string, entityType: 'note' | 'collection'): Promise<void> {
  const db = await getDb()
  await db.put('deletedIds', { id, entityType, deletedAt: Date.now() })
}

/**
 * Get all deleted IDs
 */
export async function getDeletedIds(): Promise<{ id: string; entityType: 'note' | 'collection'; deletedAt: number }[]> {
  const db = await getDb()
  return db.getAll('deletedIds')
}

/**
 * Remove a deleted ID (after successful sync)
 */
export async function removeDeletedId(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('deletedIds', id)
}

/**
 * Check if an ID was deleted locally
 */
export async function isDeletedLocally(id: string): Promise<boolean> {
  const db = await getDb()
  const item = await db.get('deletedIds', id)
  return !!item
}

// ============ Sync Queue Operations ============

/**
 * Add item to sync queue with deduplication
 */
export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retries'>): Promise<void> {
  const db = await getDb()
  
  // Check if there's already a pending item for this entity
  const existingItems = await db.getAllFromIndex('syncQueue', 'by-entityId', item.entityId)
  
  // Filter by entity type
  const sameTypeItems = existingItems.filter(e => e.entityType === item.entityType)
  
  // If there's an existing item, update it instead of creating new
  if (sameTypeItems.length > 0) {
    const existing = sameTypeItems[0]
    
    // If existing is delete, ignore new updates
    if (existing.type === 'delete') {
      return
    }
    
    // Merge logic:
    // - create + update = create with new data
    // - create/update + delete = delete
    // - update + update = update with new data
    const newItem: SyncQueueItem = {
      ...existing,
      type: item.type === 'delete' ? 'delete' : existing.type === 'create' ? 'create' : item.type,
      data: item.type === 'delete' ? undefined : item.data,
      timestamp: Date.now()
    }
    await db.put('syncQueue', newItem)
    return
  }
  
  // Create new queue item
  const queueItem: SyncQueueItem = {
    id: `${item.entityType}-${item.entityId}-${Date.now()}`,
    ...item,
    timestamp: Date.now(),
    retries: 0
  }
  await db.put('syncQueue', queueItem)
}

/**
 * Get all items in sync queue ordered by timestamp
 */
export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await getDb()
  return db.getAllFromIndex('syncQueue', 'by-timestamp')
}

/**
 * Get sync queue items by entity type
 */
export async function getSyncQueueByType(entityType: 'note' | 'collection'): Promise<SyncQueueItem[]> {
  const db = await getDb()
  return db.getAllFromIndex('syncQueue', 'by-entityType', entityType)
}

/**
 * Remove item from sync queue
 */
export async function removeFromSyncQueue(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('syncQueue', id)
}

/**
 * Update sync queue item (e.g., increment retries)
 */
export async function updateSyncQueueItem(id: string, updates: Partial<SyncQueueItem>): Promise<void> {
  const db = await getDb()
  const item = await db.get('syncQueue', id)
  if (item) {
    await db.put('syncQueue', { ...item, ...updates })
  }
}

/**
 * Clear all items from sync queue
 */
export async function clearSyncQueue(): Promise<void> {
  const db = await getDb()
  await db.clear('syncQueue')
}

/**
 * Get sync queue count
 */
export async function getSyncQueueCount(): Promise<number> {
  const db = await getDb()
  return db.count('syncQueue')
}

// ============ Metadata Operations ============

/**
 * Set metadata value
 */
export async function setMetadata(key: string, value: unknown): Promise<void> {
  const db = await getDb()
  await db.put('metadata', { key, value })
}

/**
 * Get metadata value
 */
export async function getMetadata<T>(key: string): Promise<T | undefined> {
  const db = await getDb()
  const result = await db.get('metadata', key)
  return result?.value as T | undefined
}

// ============ Utility Functions ============

/**
 * Check if IndexedDB is available
 */
export function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

/**
 * Clear all data (for logout/reset)
 */
export async function clearAllData(): Promise<void> {
  const db = await getDb()
  await Promise.all([
    db.clear('notes'),
    db.clear('collections'),
    db.clear('syncQueue'),
    db.clear('metadata'),
    db.clear('deletedIds')
  ])
}

/**
 * Atomic transaction for saving note and queueing sync
 * Ensures data consistency even if app crashes
 */
export async function saveNoteWithQueue(
  note: Note, 
  queueItem: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retries'>
): Promise<void> {
  const db = await getDb()
  
  // Use separate operations instead of transaction to avoid index issues
  try {
    // Save note first
    await db.put('notes', note)
    
    // Then handle queue
    const existingItems = await db.getAllFromIndex('syncQueue', 'by-entityId', queueItem.entityId)
    const sameTypeItems = existingItems.filter(e => e.entityType === queueItem.entityType)
    
    if (sameTypeItems.length > 0) {
      const existing = sameTypeItems[0]
      if (existing.type !== 'delete') {
        const newItem: SyncQueueItem = {
          ...existing,
          type: queueItem.type === 'delete' ? 'delete' : existing.type === 'create' ? 'create' : queueItem.type,
          data: queueItem.type === 'delete' ? undefined : queueItem.data,
          timestamp: Date.now()
        }
        await db.put('syncQueue', newItem)
      }
    } else {
      const newQueueItem: SyncQueueItem = {
        id: `${queueItem.entityType}-${queueItem.entityId}-${Date.now()}`,
        ...queueItem,
        timestamp: Date.now(),
        retries: 0
      }
      await db.put('syncQueue', newQueueItem)
    }
  } catch (error) {
    console.error('Error saving note with queue:', error)
    throw error
  }
}

/**
 * Atomic transaction for saving collection and queueing sync
 */
export async function saveCollectionWithQueue(
  collection: Collection,
  queueItem: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retries'>
): Promise<void> {
  const db = await getDb()
  
  // Use separate operations instead of transaction to avoid index issues
  try {
    // Save collection first
    await db.put('collections', collection)
    
    // Then handle queue
    const existingItems = await db.getAllFromIndex('syncQueue', 'by-entityId', queueItem.entityId)
    const sameTypeItems = existingItems.filter(e => e.entityType === queueItem.entityType)
    
    if (sameTypeItems.length > 0) {
      const existing = sameTypeItems[0]
      if (existing.type !== 'delete') {
        const newItem: SyncQueueItem = {
          ...existing,
          type: queueItem.type === 'delete' ? 'delete' : existing.type === 'create' ? 'create' : queueItem.type,
          data: queueItem.type === 'delete' ? undefined : queueItem.data,
          timestamp: Date.now()
        }
        await db.put('syncQueue', newItem)
      }
    } else {
      const newQueueItem: SyncQueueItem = {
        id: `${queueItem.entityType}-${queueItem.entityId}-${Date.now()}`,
        ...queueItem,
        timestamp: Date.now(),
        retries: 0
      }
      await db.put('syncQueue', newQueueItem)
    }
  } catch (error) {
    console.error('Error saving collection with queue:', error)
    throw error
  }
}
