/**
 * Database Utilities
 * Helper functions for database operations
 */
import { db } from './schema'

/**
 * Check if IndexedDB is available
 */
export function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

/**
 * Check if error is a quota exceeded error
 */
export function isQuotaExceededError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.name === 'QuotaExceededError' ||
      error.message.includes('quota') ||
      error.message.includes('storage')
    )
  }
  return false
}

/**
 * Safe database write with quota handling
 * Returns true if successful, false if quota exceeded
 */
export async function safeDbWrite<T>(
  operation: () => Promise<T>,
  onQuotaExceeded?: () => void
): Promise<{ success: boolean; result?: T; error?: Error }> {
  try {
    const result = await operation()
    return { success: true, result }
  } catch (error) {
    if (isQuotaExceededError(error)) {
      console.error('[DB] Storage quota exceeded')
      onQuotaExceeded?.()
      return { success: false, error: error as Error }
    }
    throw error
  }
}

/**
 * Clear all data from all tables
 * Use for logout or reset
 */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', 
    [db.notes, db.collections, db.syncQueue, db.tombstones, db.metadata],
    async () => {
      await Promise.all([
        db.notes.clear(),
        db.collections.clear(),
        db.syncQueue.clear(),
        db.tombstones.clear(),
        db.metadata.clear()
      ])
    }
  )
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(): Promise<{
  notes: number
  collections: number
  syncQueue: number
  tombstones: number
}> {
  const [notes, collections, syncQueue, tombstones] = await Promise.all([
    db.notes.count(),
    db.collections.count(),
    db.syncQueue.count(),
    db.tombstones.count()
  ])
  
  return { notes, collections, syncQueue, tombstones }
}

/**
 * Export all data (for backup)
 */
export async function exportAllData(): Promise<{
  notes: unknown[]
  collections: unknown[]
  metadata: unknown[]
}> {
  const [notes, collections, metadata] = await Promise.all([
    db.notes.toArray(),
    db.collections.toArray(),
    db.metadata.toArray()
  ])
  
  return { notes, collections, metadata }
}

/**
 * Check database health
 */
export async function checkDatabaseHealth(): Promise<{
  isHealthy: boolean
  error?: string
}> {
  try {
    // Try a simple read operation
    await db.metadata.count()
    return { isHealthy: true }
  } catch (error) {
    return {
      isHealthy: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
