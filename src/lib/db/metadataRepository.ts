/**
 * Metadata Repository
 * Key-value store for app metadata (last sync time, settings, etc.)
 */
import { db } from './schema'

/**
 * Set a metadata value
 */
export async function setMetadata<T>(key: string, value: T): Promise<void> {
  await db.metadata.put({ key, value })
}

/**
 * Get a metadata value
 */
export async function getMetadata<T>(key: string): Promise<T | undefined> {
  const item = await db.metadata.get(key)
  return item?.value as T | undefined
}

/**
 * Delete a metadata entry
 */
export async function deleteMetadata(key: string): Promise<void> {
  await db.metadata.delete(key)
}

/**
 * Check if a metadata key exists
 */
export async function hasMetadata(key: string): Promise<boolean> {
  const item = await db.metadata.get(key)
  return !!item
}

/**
 * Clear all metadata
 */
export async function clearMetadata(): Promise<void> {
  await db.metadata.clear()
}

// ============ Convenience Methods for Common Keys ============

const KEYS = {
  LAST_SYNC: 'lastSyncTimestamp',
  DRIVE_PAGE_TOKEN: 'drivePageToken',
  USER_PREFERENCES: 'userPreferences'
} as const

/**
 * Get last sync timestamp
 */
export async function getLastSyncTimestamp(): Promise<number> {
  const value = await getMetadata<number>(KEYS.LAST_SYNC)
  return value ?? 0
}

/**
 * Set last sync timestamp
 */
export async function setLastSyncTimestamp(timestamp: number): Promise<void> {
  await setMetadata(KEYS.LAST_SYNC, timestamp)
}

/**
 * Get Drive page token (for incremental sync)
 */
export async function getDrivePageToken(): Promise<string | undefined> {
  return getMetadata<string>(KEYS.DRIVE_PAGE_TOKEN)
}

/**
 * Set Drive page token
 */
export async function setDrivePageToken(token: string): Promise<void> {
  await setMetadata(KEYS.DRIVE_PAGE_TOKEN, token)
}
