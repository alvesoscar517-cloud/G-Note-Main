/**
 * Offline sync manager
 * Handles syncing queued operations when coming back online
 * Supports both notes and collections sync
 */
import { 
  getSyncQueue, 
  removeFromSyncQueue, 
  updateSyncQueueItem,
  clearSyncQueue,
  getSyncQueueCount,
  getDeletedIds,
  removeDeletedId,
  type SyncQueueItem 
} from './offlineDb'
import { driveSync } from './driveSync'
import { useNetworkStore } from '@/stores/networkStore'
import { useAuthStore } from '@/stores/authStore'
import { useNotesStore } from '@/stores/notesStore'
import type { Note, Collection } from '@/types'

const MAX_RETRIES = 3
const RETRY_DELAY_BASE = 1000 // 1 second base delay

let isSyncing = false
let syncTimeout: ReturnType<typeof setTimeout> | null = null

/**
 * Process the sync queue
 * Called when coming back online or manually triggered
 */
export async function processSyncQueue(): Promise<{ success: number; failed: number }> {
  if (isSyncing) {
    console.log('[OfflineSync] Already syncing, skipping...')
    return { success: 0, failed: 0 }
  }

  const { isOnline } = useNetworkStore.getState()
  if (!isOnline) {
    console.log('[OfflineSync] Offline, skipping sync queue processing')
    return { success: 0, failed: 0 }
  }

  const user = useAuthStore.getState().user
  if (!user?.accessToken) {
    console.log('[OfflineSync] No auth token, skipping sync queue processing')
    return { success: 0, failed: 0 }
  }

  isSyncing = true
  let success = 0
  let failed = 0

  try {
    const queue = await getSyncQueue()
    
    if (queue.length === 0) {
      console.log('[OfflineSync] Queue is empty')
      // Still process deleted IDs
      await syncDeletedIds(user.accessToken)
      return { success: 0, failed: 0 }
    }

    console.log(`[OfflineSync] Processing ${queue.length} queued items...`)
    driveSync.setAccessToken(user.accessToken)

    // Process notes first, then collections
    const noteItems = queue.filter(item => item.entityType === 'note')
    const collectionItems = queue.filter(item => item.entityType === 'collection')

    // Process note items
    for (const item of noteItems) {
      try {
        await processNoteQueueItem(item)
        await removeFromSyncQueue(item.id)
        success++
        console.log(`[OfflineSync] Processed note: ${item.type} ${item.entityId}`)
      } catch (error) {
        console.error(`[OfflineSync] Failed to process note item:`, error)
        await handleQueueItemError(item, error)
        failed++
      }
    }

    // Process collection items
    for (const item of collectionItems) {
      try {
        await processCollectionQueueItem(item)
        await removeFromSyncQueue(item.id)
        success++
        console.log(`[OfflineSync] Processed collection: ${item.type} ${item.entityId}`)
      } catch (error) {
        console.error(`[OfflineSync] Failed to process collection item:`, error)
        await handleQueueItemError(item, error)
        failed++
      }
    }

    // Sync deleted IDs
    await syncDeletedIds(user.accessToken)

    // After processing queue, trigger a full sync to ensure consistency
    if (success > 0) {
      console.log('[OfflineSync] Queue processed, triggering full sync...')
      const { syncWithDrive } = useNotesStore.getState()
      await syncWithDrive(user.accessToken)
    }

  } finally {
    isSyncing = false
  }

  return { success, failed }
}

/**
 * Process a note queue item
 */
async function processNoteQueueItem(item: SyncQueueItem): Promise<void> {
  switch (item.type) {
    case 'create':
    case 'update':
      if (item.data) {
        await driveSync.uploadNote(item.data as Note)
      }
      break
    
    case 'delete':
      await driveSync.deleteNoteFile(item.entityId)
      break
    
    default:
      console.warn(`[OfflineSync] Unknown queue item type: ${item.type}`)
  }
}

/**
 * Process a collection queue item
 */
async function processCollectionQueueItem(item: SyncQueueItem): Promise<void> {
  switch (item.type) {
    case 'create':
    case 'update':
      if (item.data) {
        await driveSync.uploadCollection(item.data as Collection)
      }
      break
    
    case 'delete':
      await driveSync.deleteCollectionFile(item.entityId)
      break
    
    default:
      console.warn(`[OfflineSync] Unknown queue item type: ${item.type}`)
  }
}

/**
 * Handle queue item error with retry logic
 */
async function handleQueueItemError(item: SyncQueueItem, error: unknown): Promise<void> {
  if (item.retries >= MAX_RETRIES) {
    // Max retries reached, mark as failed and remove
    await removeFromSyncQueue(item.id)
    console.log(`[OfflineSync] Max retries reached for ${item.entityId}, removing from queue`)
  } else {
    // Increment retry count
    await updateSyncQueueItem(item.id, {
      retries: item.retries + 1,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * Sync deleted IDs to Drive
 * This ensures deletions are propagated across devices
 */
async function syncDeletedIds(accessToken: string): Promise<void> {
  try {
    const deletedIds = await getDeletedIds()
    if (deletedIds.length === 0) return

    console.log(`[OfflineSync] Syncing ${deletedIds.length} deleted IDs...`)
    driveSync.setAccessToken(accessToken)

    for (const item of deletedIds) {
      try {
        if (item.entityType === 'note') {
          await driveSync.deleteNoteFile(item.id)
        } else {
          await driveSync.deleteCollectionFile(item.id)
        }
        await removeDeletedId(item.id)
        console.log(`[OfflineSync] Synced deletion: ${item.entityType} ${item.id}`)
      } catch (error) {
        // If file doesn't exist on Drive, that's fine - remove from local tracking
        const errorMsg = error instanceof Error ? error.message : ''
        if (errorMsg.includes('404') || errorMsg.includes('not found')) {
          await removeDeletedId(item.id)
        } else {
          console.error(`[OfflineSync] Failed to sync deletion:`, error)
        }
      }
    }
  } catch (error) {
    console.error('[OfflineSync] Failed to sync deleted IDs:', error)
  }
}

/**
 * Schedule sync queue processing with exponential backoff
 */
export function scheduleSyncRetry(attempt: number = 0): void {
  if (syncTimeout) {
    clearTimeout(syncTimeout)
  }

  const delay = RETRY_DELAY_BASE * Math.pow(2, attempt)
  const maxDelay = 30000 // Max 30 seconds

  syncTimeout = setTimeout(async () => {
    const { isOnline } = useNetworkStore.getState()
    if (isOnline) {
      const result = await processSyncQueue()
      if (result.failed > 0 && attempt < MAX_RETRIES) {
        scheduleSyncRetry(attempt + 1)
      }
    }
  }, Math.min(delay, maxDelay))
}

/**
 * Initialize offline sync listeners
 */
export function initOfflineSync(): () => void {
  // Subscribe to network status changes
  const unsubscribe = useNetworkStore.subscribe(
    state => state.isOnline,
    async (isOnline, wasOnline) => {
      if (isOnline && !wasOnline) {
        console.log('[OfflineSync] Back online, processing sync queue...')
        // Small delay to ensure network is stable
        setTimeout(() => {
          processSyncQueue()
        }, 1000)
      }
    }
  )

  // Check if there are pending items on init
  getSyncQueueCount().then(count => {
    if (count > 0) {
      console.log(`[OfflineSync] Found ${count} pending items in queue`)
      const { isOnline } = useNetworkStore.getState()
      if (isOnline) {
        processSyncQueue()
      }
    }
  })

  return unsubscribe
}

/**
 * Get current sync queue status
 */
export async function getSyncQueueStatus(): Promise<{
  count: number
  items: SyncQueueItem[]
  noteCount: number
  collectionCount: number
}> {
  const items = await getSyncQueue()
  return {
    count: items.length,
    items,
    noteCount: items.filter(i => i.entityType === 'note').length,
    collectionCount: items.filter(i => i.entityType === 'collection').length
  }
}

/**
 * Clear failed items from queue
 */
export async function clearFailedItems(): Promise<void> {
  const queue = await getSyncQueue()
  for (const item of queue) {
    if (item.retries >= MAX_RETRIES) {
      await removeFromSyncQueue(item.id)
    }
  }
}

/**
 * Force clear entire sync queue (use with caution)
 */
export async function forceClearQueue(): Promise<void> {
  await clearSyncQueue()
  console.log('[OfflineSync] Queue cleared')
}

/**
 * Check if sync is currently in progress
 */
export function isSyncInProgress(): boolean {
  return isSyncing
}
