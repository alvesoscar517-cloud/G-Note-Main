/**
 * Collection Repository
 * CRUD operations for collections using Dexie
 */
import { db } from './schema'
import type { Collection } from '@/types'

/**
 * Save a single collection
 */
export async function saveCollection(collection: Collection): Promise<void> {
  await db.collections.put(collection)
}

/**
 * Save multiple collections in a transaction
 */
export async function saveCollections(collections: Collection[]): Promise<void> {
  await db.collections.bulkPut(collections)
}

/**
 * Get a collection by ID
 */
export async function getCollection(id: string): Promise<Collection | undefined> {
  return db.collections.get(id)
}

/**
 * Get all collections
 */
export async function getAllCollections(): Promise<Collection[]> {
  return db.collections.toArray()
}

/**
 * Get collections by sync status
 */
export async function getCollectionsBySyncStatus(
  status: 'synced' | 'pending' | 'error'
): Promise<Collection[]> {
  return db.collections.where('syncStatus').equals(status).toArray()
}

/**
 * Delete a collection by ID
 */
export async function deleteCollection(id: string): Promise<void> {
  await db.collections.delete(id)
}

/**
 * Delete multiple collections
 */
export async function deleteCollections(ids: string[]): Promise<void> {
  await db.collections.bulkDelete(ids)
}

/**
 * Update collection sync status
 */
export async function updateCollectionSyncStatus(
  id: string,
  syncStatus: 'synced' | 'pending' | 'error'
): Promise<void> {
  await db.collections.update(id, { syncStatus })
}

/**
 * Count all collections
 */
export async function countCollections(): Promise<number> {
  return db.collections.count()
}

/**
 * Clear all collections
 */
export async function clearCollections(): Promise<void> {
  await db.collections.clear()
}
