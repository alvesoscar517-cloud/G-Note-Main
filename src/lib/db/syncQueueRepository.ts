/**
 * Sync Queue Repository
 * Manages pending sync operations with deduplication and priority
 * 
 * NOTE: This repository primarily handles notes. Collection support is kept
 * only for migration cleanup purposes (to handle any pending collection sync
 * operations during the collection removal migration).
 */
import { db, type SyncQueueItem, type Collection } from './schema'
import type { Note } from '@/types'
import { v4 as uuidv4 } from 'uuid'

// Re-export SyncQueueItem type for convenience
export type { SyncQueueItem } from './schema'

// Priority levels
export const PRIORITY = {
  LOW: 0,
  NORMAL: 1,
  HIGH: 2,      // Currently open note
  URGENT: 3     // User explicitly requested sync
} as const

// Type for adding items to queue (priority is optional with default)
// NOTE: entityType should be 'note' for normal operations.
// Collection support is kept for migration cleanup only.
export type AddToQueueItem = Omit<SyncQueueItem, 'id' | 'timestamp' | 'retries' | 'priority'> & {
  priority?: number
}

/**
 * Add item to sync queue with deduplication
 * If an item for the same entity exists, merge operations intelligently
 */
export async function addToSyncQueue(item: AddToQueueItem): Promise<void> {
  const { entityType, entityId, type, data, priority = PRIORITY.NORMAL } = item

  // Check for existing item with same entity
  const existing = await db.syncQueue
    .where('[entityType+entityId]')
    .equals([entityType, entityId])
    .first()

  if (existing) {
    // Merge logic:
    // - If existing is 'delete', ignore new updates (delete wins)
    // - create + update = create with new data
    // - create/update + delete = delete
    // - update + update = update with new data
    if (existing.type === 'delete') {
      return // Delete already queued, ignore
    }

    const mergedType = type === 'delete' 
      ? 'delete' 
      : existing.type === 'create' 
        ? 'create' 
        : type

    await db.syncQueue.update(existing.id, {
      type: mergedType,
      data: type === 'delete' ? undefined : data,
      timestamp: Date.now(),
      priority: Math.max(existing.priority, priority) // Keep higher priority
    })
    return
  }

  // Create new queue item
  const queueItem: SyncQueueItem = {
    id: uuidv4(),
    entityType,
    entityId,
    type,
    data,
    timestamp: Date.now(),
    retries: 0,
    priority
  }

  await db.syncQueue.add(queueItem)
}

/**
 * Get all items in sync queue, ordered by priority (desc) then timestamp (asc)
 */
export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const items = await db.syncQueue.toArray()
  // Sort: higher priority first, then older items first
  return items.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority
    return a.timestamp - b.timestamp
  })
}

/**
 * Get sync queue items by entity type
 * 
 * NOTE: Collection support is kept for migration cleanup only.
 * New code should only use 'note' as entityType.
 */
export async function getSyncQueueByType(
  entityType: 'note' | 'collection'
): Promise<SyncQueueItem[]> {
  return db.syncQueue.where('entityType').equals(entityType).toArray()
}

/**
 * Get all note sync queue items (primary use case)
 * This is the recommended function for normal sync operations.
 */
export async function getNoteSyncQueue(): Promise<SyncQueueItem[]> {
  return getSyncQueueByType('note')
}

/**
 * Get sync queue item by entity
 * 
 * NOTE: Collection support is kept for migration cleanup only.
 * New code should only use 'note' as entityType.
 */
export async function getSyncQueueItem(
  entityType: 'note' | 'collection',
  entityId: string
): Promise<SyncQueueItem | undefined> {
  return db.syncQueue
    .where('[entityType+entityId]')
    .equals([entityType, entityId])
    .first()
}

/**
 * Remove item from sync queue
 */
export async function removeFromSyncQueue(id: string): Promise<void> {
  await db.syncQueue.delete(id)
}

/**
 * Remove item by entity
 * 
 * NOTE: Collection support is kept for migration cleanup only.
 * New code should only use 'note' as entityType.
 */
export async function removeFromSyncQueueByEntity(
  entityType: 'note' | 'collection',
  entityId: string
): Promise<void> {
  await db.syncQueue
    .where('[entityType+entityId]')
    .equals([entityType, entityId])
    .delete()
}

/**
 * Update sync queue item (e.g., increment retries, add error)
 */
export async function updateSyncQueueItem(
  id: string,
  updates: Partial<SyncQueueItem>
): Promise<void> {
  await db.syncQueue.update(id, updates)
}

/**
 * Increment retry count and optionally set error
 */
export async function incrementRetry(id: string, error?: string): Promise<void> {
  const item = await db.syncQueue.get(id)
  if (item) {
    await db.syncQueue.update(id, {
      retries: item.retries + 1,
      error
    })
  }
}

/**
 * Update priority for an entity (e.g., when user opens a note)
 * 
 * NOTE: Collection support is kept for migration cleanup only.
 * New code should only use 'note' as entityType.
 */
export async function updatePriority(
  entityType: 'note' | 'collection',
  entityId: string,
  priority: number
): Promise<void> {
  const item = await getSyncQueueItem(entityType, entityId)
  if (item) {
    await db.syncQueue.update(item.id, { priority })
  }
}

/**
 * Get count of items in sync queue
 */
export async function getSyncQueueCount(): Promise<number> {
  return db.syncQueue.count()
}

/**
 * Clear all items from sync queue
 */
export async function clearSyncQueue(): Promise<void> {
  await db.syncQueue.clear()
}

/**
 * Get all entity IDs currently in sync queue
 */
export async function getSyncQueueEntityIds(): Promise<Set<string>> {
  const items = await db.syncQueue.toArray()
  return new Set(items.map(item => item.entityId))
}

/**
 * Atomic: Save note and add to sync queue in one transaction
 */
export async function saveNoteWithQueue(
  note: Note,
  queueItem: AddToQueueItem
): Promise<void> {
  await db.transaction('rw', [db.notes, db.syncQueue], async () => {
    await db.notes.put(note)
    await addToSyncQueue(queueItem)
  })
}

/**
 * Atomic: Save collection and add to sync queue in one transaction
 * 
 * @deprecated This function is kept for migration cleanup only.
 * Collections are being removed from the application.
 * New code should not use this function.
 */
export async function saveCollectionWithQueue(
  collection: Collection,
  queueItem: AddToQueueItem
): Promise<void> {
  // Check if collections table still exists (for backward compatibility)
  if (!db.collections) {
    console.warn('[SyncQueue] Attempted to save collection but collections table has been removed')
    return
  }
  
  await db.transaction('rw', [db.collections, db.syncQueue], async () => {
    await db.collections!.put(collection)
    await addToSyncQueue(queueItem)
  })
}
