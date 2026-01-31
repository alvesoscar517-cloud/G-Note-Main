/**
 * Simple Sync Manager
 * Unified manager for note debouncing and sync scheduling
 * Replaces NoteDebounceManager and SmartSyncManager
 * 
 * Optimizations:
 * - Event-driven sync triggers (no polling)
 * - Sync throttling (min 10s between syncs)
 * - Check pending changes before periodic sync
 */
import type { Note } from '@/types'

// Debounce configuration
const UPDATE_DEBOUNCE_MS = 500 // Local save debounce
const SYNC_IDLE_DELAY_MS = 30000 // Sync after 30s of inactivity
const SYNC_PERIODIC_MS = 5 * 60 * 1000 // Periodic sync every 5 minutes
const MIN_SYNC_INTERVAL_MS = 10000 // Minimum 10s between syncs (throttling)

/**
 * SimpleSyncManager - Handles note debouncing and sync scheduling
 */
class SimpleSyncManager {
  private syncTimer: ReturnType<typeof setTimeout> | null = null
  private periodicTimer: ReturnType<typeof setTimeout> | null = null
  private pendingNotes = new Map<string, Note>()
  private noteTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private isSyncing = false
  private lastSyncTime = 0 // Track last sync for throttling
  private syncCallback: (() => Promise<void>) | null = null
  private saveCallback: ((note: Note) => Promise<void>) | null = null
  private hasPendingChangesCallback: (() => boolean) | null = null

  /**
   * Initialize the manager with callbacks
   */
  initialize(
    syncCallback: () => Promise<void>,
    saveCallback: (note: Note) => Promise<void>,
    hasPendingChangesCallback?: () => boolean
  ): void {
    this.syncCallback = syncCallback
    this.saveCallback = saveCallback
    this.hasPendingChangesCallback = hasPendingChangesCallback || null
  }

  /**
   * Add a pending note update
   * Debounces the save and schedules sync
   */
  addPendingNote(note: Note): void {
    // Cancel existing timer for this note
    const existingTimer = this.noteTimers.get(note.id)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Store pending update
    this.pendingNotes.set(note.id, note)

    // Schedule debounced save
    const timer = setTimeout(async () => {
      const pendingNote = this.pendingNotes.get(note.id)
      if (pendingNote && this.saveCallback) {
        this.noteTimers.delete(note.id)
        this.pendingNotes.delete(note.id)
        await this.saveCallback(pendingNote)
      }
    }, UPDATE_DEBOUNCE_MS)

    this.noteTimers.set(note.id, timer)

    // Schedule sync after idle period
    this.scheduleSync()
  }

  /**
   * Schedule a sync after idle period
   * Resets the timer on each call (debounced sync)
   */
  scheduleSync(): void {
    // Clear existing sync timer
    if (this.syncTimer) {
      clearTimeout(this.syncTimer)
    }

    // Schedule new sync
    this.syncTimer = setTimeout(() => {
      this.sync()
    }, SYNC_IDLE_DELAY_MS)
  }

  /**
   * Start periodic sync
   * Only syncs if there are pending changes (optimization)
   */
  startPeriodicSync(): void {
    this.stopPeriodicSync()
    
    this.periodicTimer = setInterval(() => {
      // Check if there are pending changes before syncing
      if (this.hasPendingChangesCallback) {
        const hasPending = this.hasPendingChangesCallback()
        if (!hasPending) {
          console.log('[SimpleSyncManager] No pending changes, skipping periodic sync')
          return
        }
      }
      
      this.sync()
    }, SYNC_PERIODIC_MS)
  }

  /**
   * Stop periodic sync
   */
  stopPeriodicSync(): void {
    if (this.periodicTimer) {
      clearInterval(this.periodicTimer)
      this.periodicTimer = null
    }
  }

  /**
   * Perform sync now
   * Includes throttling to prevent excessive sync calls
   */
  async sync(): Promise<void> {
    if (!this.canSync()) return

    // Throttling: prevent syncs within MIN_SYNC_INTERVAL_MS
    const now = Date.now()
    if (now - this.lastSyncTime < MIN_SYNC_INTERVAL_MS) {
      console.log('[SimpleSyncManager] Sync throttled (too soon since last sync)')
      return
    }

    this.isSyncing = true
    this.lastSyncTime = now
    
    try {
      // Flush any pending notes first
      await this.flush()

      // Perform sync
      if (this.syncCallback) {
        await this.syncCallback()
      }
    } catch (error) {
      console.error('[SimpleSyncManager] Sync error:', error)
    } finally {
      this.isSyncing = false
    }
  }

  /**
   * Flush all pending note updates immediately
   */
  async flush(): Promise<void> {
    // Cancel all timers
    for (const timer of this.noteTimers.values()) {
      clearTimeout(timer)
    }
    this.noteTimers.clear()

    // Save all pending notes
    const pendingNotes = Array.from(this.pendingNotes.values())
    this.pendingNotes.clear()

    if (pendingNotes.length > 0 && this.saveCallback) {
      await Promise.all(
        pendingNotes.map(note => this.saveCallback!(note))
      )
    }
  }

  /**
   * Stop all timers and clear pending updates
   */
  stop(): void {
    // Clear sync timers
    if (this.syncTimer) {
      clearTimeout(this.syncTimer)
      this.syncTimer = null
    }
    this.stopPeriodicSync()

    // Clear note timers
    for (const timer of this.noteTimers.values()) {
      clearTimeout(timer)
    }
    this.noteTimers.clear()

    // Clear pending notes
    this.pendingNotes.clear()
  }

  /**
   * Check if sync can be performed
   */
  private canSync(): boolean {
    // Don't sync if already syncing
    if (this.isSyncing) {
      return false
    }

    // Don't sync if no callback
    if (!this.syncCallback) {
      return false
    }

    return true
  }

  /**
   * Get pending notes count (for debugging)
   */
  getPendingCount(): number {
    return this.pendingNotes.size
  }

  /**
   * Check if currently syncing
   */
  isSyncInProgress(): boolean {
    return this.isSyncing
  }
}

// Export singleton instance
export const syncManager = new SimpleSyncManager()

// Export for testing
export { SimpleSyncManager }
