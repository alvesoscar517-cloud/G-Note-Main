/**
 * Tombstone Repository
 * Tracks deleted items for sync propagation across devices
 */
import { db, type Tombstone } from './schema'

// Tombstone retention period (30 days)
const TOMBSTONE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Add a tombstone for a deleted entity
 */
export async function addTombstone(
  id: string,
  entityType: 'note' | 'collection'
): Promise<void> {
  await db.tombstones.put({
    id,
    entityType,
    deletedAt: Date.now()
  })
}

/**
 * Get all tombstones
 */
export async function getAllTombstones(): Promise<Tombstone[]> {
  return db.tombstones.toArray()
}

/**
 * Get tombstones by entity type
 */
export async function getTombstonesByType(
  entityType: 'note' | 'collection'
): Promise<Tombstone[]> {
  return db.tombstones.where('entityType').equals(entityType).toArray()
}

/**
 * Get a specific tombstone
 */
export async function getTombstone(id: string): Promise<Tombstone | undefined> {
  return db.tombstones.get(id)
}

/**
 * Check if an entity was deleted locally
 */
export async function isDeletedLocally(id: string): Promise<boolean> {
  const tombstone = await db.tombstones.get(id)
  return !!tombstone
}

/**
 * Remove a tombstone (after successful sync)
 */
export async function removeTombstone(id: string): Promise<void> {
  await db.tombstones.delete(id)
}

/**
 * Remove multiple tombstones
 */
export async function removeTombstones(ids: string[]): Promise<void> {
  await db.tombstones.bulkDelete(ids)
}

/**
 * Prune old tombstones (older than retention period)
 */
export async function pruneOldTombstones(): Promise<number> {
  const cutoffTime = Date.now() - TOMBSTONE_RETENTION_MS
  const oldTombstones = await db.tombstones
    .where('deletedAt')
    .below(cutoffTime)
    .toArray()
  
  if (oldTombstones.length > 0) {
    await db.tombstones.bulkDelete(oldTombstones.map(t => t.id))
  }
  
  return oldTombstones.length
}

/**
 * Get tombstones as a Map for quick lookup
 */
export async function getTombstoneMap(): Promise<Map<string, number>> {
  const tombstones = await db.tombstones.toArray()
  return new Map(tombstones.map(t => [t.id, t.deletedAt]))
}

/**
 * Get tombstones with timestamps for sync
 * Returns format compatible with driveSync
 */
export async function getTombstonesForSync(
  entityType: 'note' | 'collection'
): Promise<{ id: string; deletedAt: number }[]> {
  const tombstones = await getTombstonesByType(entityType)
  return tombstones.map(t => ({ id: t.id, deletedAt: t.deletedAt }))
}

/**
 * Clear all tombstones
 */
export async function clearTombstones(): Promise<void> {
  await db.tombstones.clear()
}

/**
 * Count tombstones
 */
export async function countTombstones(): Promise<number> {
  return db.tombstones.count()
}
