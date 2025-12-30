/**
 * Sync Queue Manager
 * P-Queue based sync queue with priority and rate limiting
 */
import PQueue from 'p-queue'
import { DEFAULT_SYNC_CONFIG, type SyncQueueConfig } from './types'

// Queue instance
let queue: PQueue | null = null

/**
 * Initialize or get the sync queue
 */
export function getSyncQueue(config: Partial<SyncQueueConfig> = {}): PQueue {
  if (!queue) {
    const mergedConfig = { ...DEFAULT_SYNC_CONFIG, ...config }
    
    queue = new PQueue({
      concurrency: mergedConfig.concurrency,
      interval: mergedConfig.interval,
      intervalCap: mergedConfig.intervalCap,
      autoStart: false // Manual start when online
    })

    // Log queue events for debugging
    queue.on('active', () => {
      console.log(`[SyncQueue] Active: ${queue?.pending} pending, ${queue?.size} in queue`)
    })

    queue.on('idle', () => {
      console.log('[SyncQueue] Queue is idle')
    })

    queue.on('error', (error) => {
      console.error('[SyncQueue] Queue error:', error)
    })
  }

  return queue
}

/**
 * Start the queue (when online)
 */
export function startQueue(): void {
  const q = getSyncQueue()
  if (q.isPaused) {
    q.start()
    console.log('[SyncQueue] Queue started')
  }
}

/**
 * Pause the queue (when offline)
 */
export function pauseQueue(): void {
  const q = getSyncQueue()
  q.pause()
  console.log('[SyncQueue] Queue paused')
}

/**
 * Clear all pending operations
 */
export function clearQueue(): void {
  const q = getSyncQueue()
  q.clear()
  console.log('[SyncQueue] Queue cleared')
}

/**
 * Get queue statistics
 */
export function getQueueStats(): {
  size: number
  pending: number
  isPaused: boolean
} {
  const q = getSyncQueue()
  return {
    size: q.size,
    pending: q.pending,
    isPaused: q.isPaused
  }
}

/**
 * Add operation to queue with priority
 * Higher priority = executed first
 */
export async function addToQueue<T>(
  operation: () => Promise<T>,
  priority: number = 0
): Promise<T> {
  const q = getSyncQueue()
  return q.add(operation, { priority })
}

/**
 * Wait for queue to be idle
 */
export async function waitForIdle(): Promise<void> {
  const q = getSyncQueue()
  await q.onIdle()
}

/**
 * Check if queue is empty
 */
export function isQueueEmpty(): boolean {
  const q = getSyncQueue()
  return q.size === 0 && q.pending === 0
}

/**
 * Reset queue (for testing or logout)
 */
export function resetQueue(): void {
  if (queue) {
    queue.clear()
    queue = null
  }
}
