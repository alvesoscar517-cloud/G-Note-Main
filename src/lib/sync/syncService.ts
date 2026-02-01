/**
 * Sync Service
 * 
 * Centralized service for all sync-related business logic.
 * This service contains pure functions and stateless operations,
 * making it easy to test and maintain.
 * 
 * Key Responsibilities:
 * - Check if Drive has data
 * - Perform sync operation with Drive
 * - Handle conflict resolution
 * - Process sync results and merge data
 * - Handle sync errors
 */
import type { Note } from '@/types'
import {
    syncWithDrive as engineSyncWithDrive,
    checkHasData as engineCheckHasData,
    deleteNoteDriveFile,
    setSyncAccessToken,
    getRemoteTombstones
} from './syncEngine'
import { syncManager } from './simpleSyncManager'
import {
    getAllTombstones,
    addTombstone
} from '@/lib/db/tombstoneRepository'
import {
    saveNotes,
    deleteNote as deleteNoteFromDb
} from '@/lib/db/noteRepository'
import {
    addToSyncQueue,
    saveNoteWithQueue
} from '@/lib/db/syncQueueRepository'
import { safeDbWrite } from '@/lib/db/utils'

// ============ Types ============

export interface SyncServiceState {
    isSyncing: boolean
    isInitialSync: boolean
    isCheckingDriveData: boolean
    driveHasData: boolean | null
    lastSyncTime: number | null
    syncError: string | null
}

export interface SyncCheckResult {
    hasData: boolean
    noteCount: number
}

export interface SyncProcessResult {
    success: boolean
    mergedNotes: Note[]
    deletedNoteIds: string[]
    error?: string
    errorType?: 'auth' | 'permission' | 'quota' | 'conflict' | 'network' | 'unknown'
}

export interface NoteSyncContext {
    notes: Note[]
    selectedNoteId: string | null
    isModalOpen: boolean
}

// ============ Pure Functions for Data Processing ============

/**
 * Check if a note should be deleted based on remote tombstone
 */
export function shouldDeleteNote(
    noteId: string,
    noteUpdatedAt: number,
    remoteTombstones: Map<string, number>
): boolean {
    const deletedAt = remoteTombstones.get(noteId)
    if (!deletedAt) return false
    return deletedAt > noteUpdatedAt
}

/**
 * Merge synced notes with current state
 * Handles conflict resolution, active note preservation, and tombstone filtering
 */
export function mergeSyncedNotes(
    currentNotes: Note[],
    syncedNotes: Note[],
    remoteTombstones: Map<string, number>,
    localDeletedNotes: Array<{ id: string }>,
    context: { selectedNoteId: string | null; isModalOpen: boolean }
): { mergedNotes: Note[]; deletedNoteIds: string[] } {
    const currentActiveNoteId = context.isModalOpen ? context.selectedNoteId : null
    const syncedNotesMap = new Map(syncedNotes.map(n => [n.id, n]))
    const localDeletedNoteIdSet = new Set(localDeletedNotes.map(d => d.id))
    const deletedNoteIds: string[] = []

    // Filter and merge existing notes
    const mergedNotes = currentNotes
        .filter(currentNote => {
            // Remove notes that have been deleted on remote (tombstone wins if newer)
            if (shouldDeleteNote(currentNote.id, currentNote.updatedAt, remoteTombstones)) {
                console.log(`[SyncService] Removing local note ${currentNote.id} - deleted on remote`)
                deletedNoteIds.push(currentNote.id)
                return false
            }
            return true
        })
        .map(currentNote => {
            const syncedNote = syncedNotesMap.get(currentNote.id)

            // Preserve active note (don't overwrite with synced version)
            if (currentNote.id === currentActiveNoteId) {
                // For active note: preserve local content but merge driveFileId if available
                if (syncedNote?.driveFileId && !currentNote.driveFileId) {
                    return { ...currentNote, driveFileId: syncedNote.driveFileId }
                }
                return currentNote
            }

            if (!syncedNote) return currentNote

            // If local note was modified during sync, keep local version but merge driveFileId
            if (
                currentNote.syncStatus === 'pending' &&
                (currentNote.version || 1) > (syncedNote.version || 1)
            ) {
                // Preserve local changes but get driveFileId from synced version
                if (syncedNote.driveFileId && !currentNote.driveFileId) {
                    return { ...currentNote, driveFileId: syncedNote.driveFileId }
                }
                return currentNote
            }

            return syncedNote
        })

    // Add new notes from sync (from other devices)
    syncedNotes.forEach(syncedNote => {
        const existsLocally = currentNotes.find(n => n.id === syncedNote.id)
        // Don't add if it's the active note (already in local state)
        if (!existsLocally && !localDeletedNoteIdSet.has(syncedNote.id) && syncedNote.id !== currentActiveNoteId) {
            mergedNotes.push(syncedNote)
        }
    })

    return { mergedNotes, deletedNoteIds }
}

/**
 * Parse sync error and determine the type
 */
export function parseSyncError(error: unknown): {
    message: string
    type: 'auth' | 'permission' | 'quota' | 'conflict' | 'network' | 'unknown'
    retryable: boolean
} {
    const errorMessage = error instanceof Error ? error.message : 'Sync failed'

    const isAuthError =
        errorMessage.includes('401') ||
        errorMessage.includes('authentication') ||
        errorMessage.includes('credential')

    const isPermissionError =
        errorMessage === 'DRIVE_PERMISSION_DENIED' ||
        errorMessage.includes('403') ||
        errorMessage.includes('insufficient')

    const isQuotaError = errorMessage === 'DRIVE_QUOTA_EXCEEDED'

    const isConflictError =
        errorMessage === 'DRIVE_CONFLICT_412' ||
        errorMessage === 'DRIVE_CONFLICT_MAX_RETRIES'

    if (isQuotaError) {
        return { message: 'DRIVE_QUOTA_EXCEEDED', type: 'quota', retryable: false }
    }

    if (isConflictError) {
        return { message: errorMessage, type: 'conflict', retryable: true }
    }

    if (isPermissionError) {
        return { message: 'DRIVE_PERMISSION_DENIED', type: 'permission', retryable: false }
    }

    if (isAuthError) {
        return { message: 'Refreshing session...', type: 'auth', retryable: true }
    }

    return { message: errorMessage, type: 'unknown', retryable: false }
}

// ============ Service Class ============

/**
 * SyncService - Singleton service for sync operations
 */
class SyncService {
    private static instance: SyncService

    private constructor() { }

    static getInstance(): SyncService {
        if (!SyncService.instance) {
            SyncService.instance = new SyncService()
        }
        return SyncService.instance
    }

    /**
     * Initialize sync manager with callbacks
     */
    initializeSyncManager(
        syncCallback: () => Promise<void>,
        saveCallback: (note: Note) => Promise<void>,
        hasPendingChangesCallback?: () => boolean
    ): void {
        syncManager.initialize(syncCallback, saveCallback, hasPendingChangesCallback)
        syncManager.startPeriodicSync()
    }

    /**
     * Create save callback for sync manager
     */
    createSaveCallback(): (note: Note) => Promise<void> {
        return async (note: Note) => {
            await safeDbWrite(
                () => saveNoteWithQueue(note, {
                    type: 'update',
                    entityType: 'note',
                    entityId: note.id,
                    data: note
                }),
                () => console.error('[SyncService] Storage quota exceeded while saving note')
            )
        }
    }

    /**
     * Check if Drive has data (lightweight check before full sync)
     */
    async checkDriveHasData(accessToken: string): Promise<SyncCheckResult> {
        setSyncAccessToken(accessToken)
        const result = await engineCheckHasData(accessToken)
        console.log(`[SyncService] Drive has data: ${result.hasData}, noteCount: ${result.noteCount}`)
        return {
            hasData: result.hasData,
            noteCount: result.noteCount
        }
    }

    /**
     * Perform sync with Drive
     * This is the main sync operation
     */
    async syncWithDrive(
        accessToken: string,
        context: NoteSyncContext
    ): Promise<SyncProcessResult> {
        const { notes, selectedNoteId, isModalOpen } = context

        try {
            // Flush any pending updates before sync
            await syncManager.flush()

            setSyncAccessToken(accessToken)

            // Get tombstones from IndexedDB (for accurate offline delete tracking)
            const tombstones = await getAllTombstones()
            const localDeletedNotes = tombstones
                .filter(d => d.entityType === 'note')
                .map(d => ({ id: d.id, deletedAt: d.deletedAt }))

            // Filter out active note from sync to prevent conflicts while editing
            const activeNoteId = isModalOpen ? selectedNoteId : null
            const notesToSync = activeNoteId
                ? notes.filter(n => n.id !== activeNoteId)
                : notes

            if (activeNoteId) {
                console.log(`[SyncService] Excluding active note ${activeNoteId} from sync (being edited)`)
            }

            // Sync with engine
            const result = await engineSyncWithDrive(
                accessToken,
                notesToSync,
                localDeletedNotes
            )

            const { syncedNotes } = result

            // Get remote tombstones to filter out deleted notes
            const remoteTombstones = getRemoteTombstones()

            // Merge synced data with current state
            const { mergedNotes, deletedNoteIds } = mergeSyncedNotes(
                notes,
                syncedNotes,
                remoteTombstones,
                localDeletedNotes,
                { selectedNoteId, isModalOpen }
            )

            // Delete from IndexedDB
            if (deletedNoteIds.length > 0) {
                await Promise.all(deletedNoteIds.map(id => deleteNoteFromDb(id).catch(console.error)))
            }

            // Save synced data to IndexedDB
            await saveNotes(mergedNotes)

            return {
                success: true,
                mergedNotes,
                deletedNoteIds
            }
        } catch (error) {
            console.error('[SyncService] Sync failed:', error)
            const parsedError = parseSyncError(error)

            return {
                success: false,
                mergedNotes: notes,
                deletedNoteIds: [],
                error: parsedError.message,
                errorType: parsedError.type
            }
        }
    }

    /**
     * Delete a note file from Drive
     */
    async deleteNoteDriveFile(noteId: string, isOnline: boolean): Promise<void> {
        if (isOnline) {
            await deleteNoteDriveFile(noteId)
        } else {
            await addToSyncQueue({ type: 'delete', entityType: 'note', entityId: noteId })
        }
    }

    /**
     * Track deletion for sync
     */
    async trackDeletion(noteId: string): Promise<void> {
        await addTombstone(noteId, 'note')
    }

    /**
     * Schedule sync after changes
     */
    scheduleSync(): void {
        syncManager.scheduleSync()
    }

    /**
     * Add pending note update
     */
    addPendingNote(note: Note): void {
        syncManager.addPendingNote(note)
    }

    /**
     * Flush pending updates
     */
    async flush(): Promise<void> {
        await syncManager.flush()
    }

    /**
     * Stop sync manager
     */
    stop(): void {
        syncManager.stop()
    }
}

// Export singleton instance
export const syncService = SyncService.getInstance()

// Export class for testing
export { SyncService }
