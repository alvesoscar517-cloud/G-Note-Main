/**
 * File ID Cache Repository
 * Persists Drive file IDs to IndexedDB for faster sync after reload
 */
import { db, type FileIdCacheItem } from './schema'

/**
 * Save a file ID mapping
 */
export async function saveFileId(
  entityId: string,
  fileId: string,
  entityType: 'note' | 'collection'
): Promise<void> {
  await db.fileIdCache.put({
    entityId,
    fileId,
    entityType,
    updatedAt: Date.now()
  })
}

/**
 * Save multiple file ID mappings
 */
export async function saveFileIds(
  items: Array<{ entityId: string; fileId: string; entityType: 'note' | 'collection' }>
): Promise<void> {
  const cacheItems: FileIdCacheItem[] = items.map(item => ({
    ...item,
    updatedAt: Date.now()
  }))
  await db.fileIdCache.bulkPut(cacheItems)
}

/**
 * Get file ID for an entity
 */
export async function getFileId(entityId: string): Promise<string | undefined> {
  const item = await db.fileIdCache.get(entityId)
  return item?.fileId
}

/**
 * Get all file IDs for a type
 */
export async function getFileIdsByType(
  entityType: 'note' | 'collection'
): Promise<Map<string, string>> {
  const items = await db.fileIdCache.where('entityType').equals(entityType).toArray()
  return new Map(items.map(item => [item.entityId, item.fileId]))
}

/**
 * Get all file IDs as a map
 */
export async function getAllFileIds(): Promise<Map<string, string>> {
  const items = await db.fileIdCache.toArray()
  return new Map(items.map(item => [item.entityId, item.fileId]))
}

/**
 * Delete a file ID mapping
 */
export async function deleteFileId(entityId: string): Promise<void> {
  await db.fileIdCache.delete(entityId)
}

/**
 * Delete multiple file ID mappings
 */
export async function deleteFileIds(entityIds: string[]): Promise<void> {
  await db.fileIdCache.bulkDelete(entityIds)
}

/**
 * Clear all file ID cache
 */
export async function clearFileIdCache(): Promise<void> {
  await db.fileIdCache.clear()
}

/**
 * Load file IDs into memory cache (for driveFiles.ts)
 */
export async function loadFileIdsToMemory(): Promise<{
  noteFileIds: Map<string, string>
  collectionFileIds: Map<string, string>
}> {
  const items = await db.fileIdCache.toArray()
  
  const noteFileIds = new Map<string, string>()
  const collectionFileIds = new Map<string, string>()
  
  for (const item of items) {
    if (item.entityType === 'note') {
      noteFileIds.set(item.entityId, item.fileId)
    } else {
      collectionFileIds.set(item.entityId, item.fileId)
    }
  }
  
  return { noteFileIds, collectionFileIds }
}
