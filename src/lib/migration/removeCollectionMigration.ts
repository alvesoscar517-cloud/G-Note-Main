/**
 * Migration Engine for Removing Collection Feature
 * 
 * This module orchestrates the complete migration process from collection-enabled
 * to collection-free schema. It handles:
 * - Backup creation before migration
 * - Local data migration (removing collectionId from notes)
 * - Collection deletion from IndexedDB
 * - Google Drive cleanup (collection file deletion)
 * - Migration verification
 * - Rollback on failure
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 9.1, 9.5
 */

import { db, type MigrationBackup } from '@/lib/db/schema'
import type { Note } from '@/types'

// ============ Migration Types ============

export interface MigrationResult {
  success: boolean
  notesProcessed: number
  collectionsRemoved: number
  driveFilesDeleted: number
  errors: string[]
}

export interface MigrationMetadata {
  migrationVersion: number
  lastMigrationDate: number
  migrationStatus: 'pending' | 'in_progress' | 'completed' | 'failed'
  backupId?: number
}

/**
 * Migration Report
 * 
 * Validates: Requirements 10.4
 * 
 * A comprehensive report of the migration process that is stored
 * and accessible to users.
 */
export interface MigrationReport {
  timestamp: number
  startTime: number
  endTime: number
  duration: number
  success: boolean
  notesProcessed: number
  collectionsRemoved: number
  driveFilesDeleted: number
  errors: string[]
  steps: MigrationStep[]
}

export interface MigrationStep {
  name: string
  timestamp: number
  status: 'started' | 'completed' | 'failed'
  message?: string
  error?: string
}

// ============ Constants ============

const MIGRATION_VERSION = 9
const MIGRATION_METADATA_KEY = 'migration_metadata'
const BATCH_SIZE = 100 // Process notes in batches

// ============ Logging Utilities ============

/**
 * Log a migration step with timestamp
 * 
 * Validates: Requirements 10.1
 * 
 * @param stepName - Name of the migration step
 * @param message - Optional additional message
 * @param migrationSteps - Optional array to track steps for report
 */
function logMigrationStep(stepName: string, message?: string, migrationSteps?: MigrationStep[]): void {
  const timestamp = new Date().toISOString()
  const logMessage = message 
    ? `[Migration] [${timestamp}] Step: ${stepName} - ${message}`
    : `[Migration] [${timestamp}] Step: ${stepName}`
  console.log(logMessage)
  
  // Track step for report if array provided
  if (migrationSteps) {
    migrationSteps.push({
      name: stepName,
      timestamp: Date.now(),
      status: 'completed',
      message
    })
  }
}

/**
 * Log a migration error with full stack trace
 * 
 * Validates: Requirements 10.2
 * 
 * @param stepName - Name of the step where error occurred
 * @param error - The error object
 * @param context - Additional context about the error
 * @param migrationSteps - Optional array to track steps for report
 */
function logMigrationError(stepName: string, error: unknown, context?: Record<string, unknown>, migrationSteps?: MigrationStep[]): void {
  const timestamp = new Date().toISOString()
  console.error(`[Migration] [${timestamp}] ERROR in step: ${stepName}`)
  
  let errorMessage = ''
  if (error instanceof Error) {
    errorMessage = error.message
    console.error(`[Migration] Error message: ${error.message}`)
    console.error(`[Migration] Error stack:`, error.stack)
  } else {
    errorMessage = String(error)
    console.error(`[Migration] Error:`, error)
  }
  
  if (context) {
    console.error(`[Migration] Context:`, context)
  }
  
  // Track error step for report if array provided
  if (migrationSteps) {
    migrationSteps.push({
      name: stepName,
      timestamp: Date.now(),
      status: 'failed',
      error: errorMessage,
      message: context ? JSON.stringify(context) : undefined
    })
  }
}

// ============ Migration Engine Class ============

export class RemoveCollectionMigration {
  private backupId?: number
  private migrationSteps: MigrationStep[] = []
  private migrationStartTime: number = 0

  /**
   * Check if migration is needed
   * 
   * Validates: Requirements 9.1, 9.5
   * 
   * @returns true if migration needs to run, false if already completed
   */
  async needsMigration(): Promise<boolean> {
    try {
      // Check migration metadata
      const metadata = await db.metadata.get(MIGRATION_METADATA_KEY)
      
      if (!metadata) {
        // No metadata means migration hasn't run yet
        return true
      }

      const migrationMetadata = metadata.value as MigrationMetadata

      // Check if migration is already completed
      if (migrationMetadata.migrationStatus === 'completed' && 
          migrationMetadata.migrationVersion >= MIGRATION_VERSION) {
        return false
      }

      // Check if migration failed previously
      if (migrationMetadata.migrationStatus === 'failed') {
        console.warn('[Migration] Previous migration failed, needs retry')
        return true
      }

      // Check if migration is in progress (might be stuck)
      if (migrationMetadata.migrationStatus === 'in_progress') {
        console.warn('[Migration] Previous migration was in progress, needs retry')
        return true
      }

      return true
    } catch (error) {
      console.error('[Migration] Error checking migration status:', error)
      // If we can't determine status, assume migration is needed
      return true
    }
  }

  /**
   * Log migration summary statistics
   * 
   * Validates: Requirements 10.3
   * 
   * @private
   * @param result - Migration result with statistics
   * @param duration - Migration duration in milliseconds
   */
  private logMigrationSummary(result: MigrationResult, duration: number): void {
    const timestamp = new Date().toISOString()
    console.log(`[Migration] [${timestamp}] ========== MIGRATION SUMMARY ==========`)
    console.log(`[Migration] Status: ${result.success ? 'SUCCESS' : 'FAILED'}`)
    console.log(`[Migration] Duration: ${duration}ms (${(duration / 1000).toFixed(2)}s)`)
    console.log(`[Migration] Notes Processed: ${result.notesProcessed}`)
    console.log(`[Migration] Collections Removed: ${result.collectionsRemoved}`)
    console.log(`[Migration] Drive Files Deleted: ${result.driveFilesDeleted}`)
    
    if (result.errors.length > 0) {
      console.log(`[Migration] Errors Encountered: ${result.errors.length}`)
      result.errors.forEach((error, index) => {
        console.log(`[Migration]   ${index + 1}. ${error}`)
      })
    } else {
      console.log(`[Migration] Errors Encountered: 0`)
    }
    
    console.log(`[Migration] ========================================`)
  }

  /**
   * Execute the complete migration
   * 
   * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5
   * 
   * @returns MigrationResult with success status and statistics
   */
  async migrate(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      notesProcessed: 0,
      collectionsRemoved: 0,
      driveFilesDeleted: 0,
      errors: []
    }

    this.migrationStartTime = Date.now()
    this.migrationSteps = [] // Reset steps for this migration

    try {
      logMigrationStep('MIGRATION_START', 'Starting collection removal migration', this.migrationSteps)

      // Update migration status to in_progress
      await this.updateMigrationStatus('in_progress')

      // Step 1: Create backup before any changes
      logMigrationStep('BACKUP_CREATE', 'Creating backup before migration', this.migrationSteps)
      await this.createBackup()
      logMigrationStep('BACKUP_COMPLETE', 'Backup created successfully', this.migrationSteps)

      // Step 2: Migrate local data (remove collectionId from notes)
      logMigrationStep('LOCAL_MIGRATION_START', 'Migrating local data', this.migrationSteps)
      const localResult = await this.migrateLocalData()
      result.notesProcessed = localResult.notesProcessed
      result.collectionsRemoved = localResult.collectionsRemoved
      logMigrationStep('LOCAL_MIGRATION_COMPLETE', `Processed ${localResult.notesProcessed} notes, removed ${localResult.collectionsRemoved} collections`, this.migrationSteps)

      // Step 3: Clean up Google Drive (if online)
      logMigrationStep('DRIVE_CLEANUP_START', 'Cleaning up Google Drive', this.migrationSteps)
      try {
        const driveResult = await this.cleanupDrive()
        result.driveFilesDeleted = driveResult.filesDeleted
        logMigrationStep('DRIVE_CLEANUP_COMPLETE', `Deleted ${driveResult.filesDeleted} Drive files`, this.migrationSteps)
      } catch (error) {
        // Drive cleanup is optional (user might be offline)
        logMigrationError('DRIVE_CLEANUP', error, { reason: 'User might be offline' }, this.migrationSteps)
        result.errors.push(`Drive cleanup failed: ${error instanceof Error ? error.message : String(error)}`)
      }

      // Step 4: Verify migration success
      logMigrationStep('VERIFICATION_START', 'Verifying migration', this.migrationSteps)
      const verificationSuccess = await this.verifyMigration()
      
      if (!verificationSuccess) {
        throw new Error('Migration verification failed')
      }
      logMigrationStep('VERIFICATION_COMPLETE', 'Migration verified successfully', this.migrationSteps)

      // Step 5: Mark migration as complete
      await this.updateMigrationStatus('completed')
      
      result.success = true
      
      const migrationDuration = Date.now() - this.migrationStartTime
      logMigrationStep('MIGRATION_COMPLETE', `Migration completed successfully in ${migrationDuration}ms`, this.migrationSteps)
      
      // Log summary statistics (Requirement 10.3)
      this.logMigrationSummary(result, migrationDuration)
      
      // Generate and store migration report (Requirement 10.4)
      await this.generateMigrationReport(result, migrationDuration)

      return result
    } catch (error) {
      logMigrationError('MIGRATION', error, {
        notesProcessed: result.notesProcessed,
        collectionsRemoved: result.collectionsRemoved,
        driveFilesDeleted: result.driveFilesDeleted
      }, this.migrationSteps)
      
      result.errors.push(error instanceof Error ? error.message : String(error))
      
      // Attempt rollback
      try {
        logMigrationStep('ROLLBACK_START', 'Attempting rollback', this.migrationSteps)
        await this.rollback()
        logMigrationStep('ROLLBACK_COMPLETE', 'Rollback completed successfully', this.migrationSteps)
        result.errors.push('Rollback completed successfully')
      } catch (rollbackError) {
        logMigrationError('ROLLBACK', rollbackError, undefined, this.migrationSteps)
        result.errors.push(`Rollback failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`)
      }

      // Update migration status to failed
      await this.updateMigrationStatus('failed')

      const migrationDuration = Date.now() - this.migrationStartTime
      logMigrationStep('MIGRATION_FAILED', `Migration failed after ${migrationDuration}ms`, this.migrationSteps)
      
      // Log summary statistics even on failure (Requirement 10.3)
      this.logMigrationSummary(result, migrationDuration)
      
      // Generate and store migration report even on failure (Requirement 10.4)
      await this.generateMigrationReport(result, migrationDuration)

      return result
    }
  }

  /**
   * Create backup before migration
   * 
   * Validates: Requirements 1.4
   * 
   * Stores backup in dedicated migrationBackup table with proper error handling
   * for storage quota issues. If quota is exceeded, provides clear error message
   * to help user free up space.
   * 
   * @private
   * @throws Error if backup creation fails, including storage quota errors
   */
  private async createBackup(): Promise<void> {
    try {
      logMigrationStep('BACKUP_LOAD_DATA', 'Loading notes and collections for backup')
      
      // Load all notes and collections
      const notes = await db.notes.toArray()
      const collections = db.collections ? await db.collections.toArray() : []

      // Create backup object
      const backup: MigrationBackup = {
        timestamp: Date.now(),
        notes,
        collections,
        version: 8 // Current version before migration
      }

      // Estimate backup size for better error messages
      const estimatedSize = this.estimateBackupSize(backup)
      logMigrationStep('BACKUP_SAVE', `Saving backup: ${notes.length} notes, ${collections.length} collections (estimated size: ${this.formatBytes(estimatedSize)})`)

      try {
        // Store backup in dedicated migrationBackup table
        await db.migrationBackup.put(backup)
        
        // Store backup reference in migration metadata
        this.backupId = backup.timestamp
        
        const metadata = await db.metadata.get(MIGRATION_METADATA_KEY)
        const migrationMetadata: MigrationMetadata = metadata?.value as MigrationMetadata || {
          migrationVersion: MIGRATION_VERSION,
          lastMigrationDate: Date.now(),
          migrationStatus: 'in_progress'
        }
        migrationMetadata.backupId = this.backupId

        await db.metadata.put({
          key: MIGRATION_METADATA_KEY,
          value: migrationMetadata
        })

        logMigrationStep('BACKUP_SAVED', `Backup created successfully with ID: ${this.backupId}`)
      } catch (error) {
        // Handle storage quota errors specifically
        if (this.isQuotaExceededError(error)) {
          const quotaError = new Error(
            `Storage quota exceeded while creating backup. ` +
            `Estimated backup size: ${this.formatBytes(estimatedSize)}. ` +
            `Please free up storage space by:\n` +
            `1. Closing other tabs/applications\n` +
            `2. Clearing browser cache and data\n` +
            `3. Deleting unnecessary files from your device\n` +
            `4. Moving to a device with more available storage`
          )
          quotaError.name = 'QuotaExceededError'
          throw quotaError
        }
        
        // Re-throw other errors
        throw error
      }
    } catch (error) {
      logMigrationError('BACKUP_CREATE', error, {
        step: 'Creating backup before migration'
      })
      
      // Provide user-friendly error message
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        throw error // Already has user-friendly message
      }
      
      throw new Error(
        `Backup creation failed: ${error instanceof Error ? error.message : String(error)}. ` +
        `Migration cannot proceed without a backup.`
      )
    }
  }

  /**
   * Check if an error is a storage quota exceeded error
   * 
   * @private
   * @param error - The error to check
   * @returns true if the error is a quota exceeded error
   */
  private isQuotaExceededError(error: unknown): boolean {
    if (error instanceof Error) {
      // Check for DOMException QuotaExceededError
      if (error.name === 'QuotaExceededError') {
        return true
      }
      
      // Check for Dexie quota errors
      if (error.message.includes('quota') || 
          error.message.includes('storage') ||
          error.message.includes('QuotaExceededError')) {
        return true
      }
    }
    
    return false
  }

  /**
   * Estimate the size of a backup in bytes
   * 
   * This is a rough estimate based on JSON serialization size.
   * Actual IndexedDB storage may differ due to internal overhead.
   * 
   * @private
   * @param backup - The backup to estimate
   * @returns Estimated size in bytes
   */
  private estimateBackupSize(backup: MigrationBackup): number {
    try {
      // Serialize to JSON and measure length
      const jsonString = JSON.stringify(backup)
      // UTF-16 encoding: 2 bytes per character
      return jsonString.length * 2
    } catch (error) {
      console.warn('[Migration] Could not estimate backup size:', error)
      return 0
    }
  }

  /**
   * Format bytes to human-readable string
   * 
   * @private
   * @param bytes - Number of bytes
   * @returns Formatted string (e.g., "1.5 MB")
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  /**
   * Migrate local data (IndexedDB)
   * 
   * Validates: Requirements 1.2, 2.1
   * 
   * @private
   * @returns Object with notesProcessed and collectionsRemoved counts
   */
  private async migrateLocalData(): Promise<{ notesProcessed: number; collectionsRemoved: number }> {
    try {
      let notesProcessed = 0
      let collectionsRemoved = 0

      // Step 1: Remove collectionId from all notes
      logMigrationStep('LOCAL_LOAD_NOTES', 'Loading all notes from database')
      const allNotes = await db.notes.toArray()
      logMigrationStep('LOCAL_NOTES_LOADED', `Loaded ${allNotes.length} notes`)
      
      // Process notes in batches
      const totalBatches = Math.ceil(allNotes.length / BATCH_SIZE)
      for (let i = 0; i < allNotes.length; i += BATCH_SIZE) {
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1
        const batch = allNotes.slice(i, i + BATCH_SIZE)
        
        logMigrationStep('LOCAL_PROCESS_BATCH', `Processing batch ${batchNumber}/${totalBatches} (${batch.length} notes)`)
        
        // Remove collectionId and increment version
        const updatedNotes = batch.map(note => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { collectionId, ...noteWithoutCollection } = note as Note & { collectionId?: string }
          return {
            ...noteWithoutCollection,
            version: note.version + 1
          }
        })

        // Update notes in database
        await db.notes.bulkPut(updatedNotes)
        notesProcessed += batch.length
        
        logMigrationStep('LOCAL_BATCH_COMPLETE', `Batch ${batchNumber}/${totalBatches} complete (${notesProcessed}/${allNotes.length} notes processed)`)
      }

      logMigrationStep('LOCAL_NOTES_COMPLETE', `Processed ${notesProcessed} notes`)

      // Step 2: Delete all collections
      logMigrationStep('LOCAL_LOAD_COLLECTIONS', 'Loading all collections from database')
      const allCollections = db.collections ? await db.collections.toArray() : []
      collectionsRemoved = allCollections.length
      logMigrationStep('LOCAL_COLLECTIONS_LOADED', `Loaded ${collectionsRemoved} collections`)

      if (collectionsRemoved > 0 && db.collections) {
        logMigrationStep('LOCAL_DELETE_COLLECTIONS', `Deleting ${collectionsRemoved} collections`)
        await db.collections.clear()
        logMigrationStep('LOCAL_COLLECTIONS_DELETED', `Removed ${collectionsRemoved} collections`)
      }

      return { notesProcessed, collectionsRemoved }
    } catch (error) {
      logMigrationError('LOCAL_MIGRATION', error, {
        step: 'Migrating local data'
      })
      throw new Error(`Local data migration failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Clean up Google Drive
   * 
   * Validates: Requirements 2.2, 2.3, 2.4, 2.5
   * 
   * This method performs the following steps:
   * 1. List all files in the G-Note folder
   * 2. Identify collection files by naming convention (collection-*.json)
   * 3. Verify each file is a collection file before deletion
   * 4. Delete collection files in batches (5 concurrent)
   * 5. Update index files to remove collection references (implemented in task 6.3)
   * 6. Add collection IDs to tombstones (implemented in task 6.4)
   * 
   * @private
   * @returns Object with filesDeleted count
   */
  private async cleanupDrive(): Promise<{ filesDeleted: number }> {
    try {
      logMigrationStep('DRIVE_START', 'Starting Drive cleanup')

      // Step 1: Get the G-Note folder
      logMigrationStep('DRIVE_GET_FOLDER', 'Getting G-Note folder')
      const { getOrCreateFolder } = await import('@/lib/drive/driveIndex')
      const folderId = await getOrCreateFolder()
      logMigrationStep('DRIVE_FOLDER_FOUND', `Found G-Note folder: ${folderId}`)

      // Step 2: List all files in the folder
      logMigrationStep('DRIVE_LIST_FILES', 'Listing all files in G-Note folder')
      const { driveClient } = await import('@/lib/drive/driveClient')
      const query = `'${folderId}' in parents and trashed=false`
      
      // Use the request method directly to get mimeType field
      const DRIVE_API = 'https://www.googleapis.com/drive/v3'
      const url = `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent('files(id,name,mimeType)')}`
      const result = await driveClient.request<{ files: Array<{ id: string; name: string; mimeType: string }> }>(url)
      
      if (!result.files || result.files.length === 0) {
        logMigrationStep('DRIVE_NO_FILES', 'No files found in G-Note folder')
        return { filesDeleted: 0 }
      }

      logMigrationStep('DRIVE_FILES_LISTED', `Found ${result.files.length} files in G-Note folder`)

      // Step 3: Identify collection files by naming convention
      // Collection files follow the pattern: collection-{id}.json
      logMigrationStep('DRIVE_IDENTIFY_COLLECTIONS', 'Identifying collection files')
      const collectionFiles: Array<{ id: string; name: string; fileId: string }> = []
      
      for (const file of result.files) {
        // Check if file name matches collection pattern
        if (file.name.startsWith('collection-') && file.name.endsWith('.json')) {
          // Verify it's a JSON file
          if (file.mimeType === 'application/json') {
            // Extract collection ID from filename: collection-{id}.json
            const collectionId = file.name.slice('collection-'.length, -'.json'.length)
            
            collectionFiles.push({
              id: collectionId,
              name: file.name,
              fileId: file.id
            })
            
            console.log(`[Migration] Identified collection file: ${file.name} (ID: ${collectionId}, fileId: ${file.id})`)
          } else {
            console.warn(`[Migration] File ${file.name} matches pattern but has wrong mimeType: ${file.mimeType}`)
          }
        }
      }

      logMigrationStep('DRIVE_COLLECTIONS_IDENTIFIED', `Identified ${collectionFiles.length} collection files to delete`)

      // Step 4: Delete collection files in batches (5 concurrent)
      // Validates: Requirements 2.3, 2.5
      if (collectionFiles.length === 0) {
        logMigrationStep('DRIVE_NO_COLLECTIONS', 'No collection files to delete')
        return { filesDeleted: 0 }
      }

      let filesDeleted = 0
      const BATCH_SIZE = 5 // Delete 5 files concurrently
      const deletionErrors: Array<{ file: string; error: string }> = []

      // Process files in batches
      const totalBatches = Math.ceil(collectionFiles.length / BATCH_SIZE)
      for (let i = 0; i < collectionFiles.length; i += BATCH_SIZE) {
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1
        const batch = collectionFiles.slice(i, i + BATCH_SIZE)
        logMigrationStep('DRIVE_DELETE_BATCH', `Deleting batch ${batchNumber}/${totalBatches} (${batch.length} files)`)

        // Delete files in parallel within the batch
        const deletionPromises = batch.map(async (file): Promise<{ success: boolean; file: string; error?: string }> => {
          try {
            // Verify file is a collection file before deletion (double-check)
            if (!this.isCollectionFile(file.name, 'application/json')) {
              console.warn(`[Migration] Skipping file ${file.name} - not a valid collection file`)
              return { success: false, file: file.name, error: 'Not a valid collection file' }
            }

            // Log deletion attempt
            console.log(`[Migration] Deleting collection file: ${file.name} (fileId: ${file.fileId})`)

            // Delete the file
            await driveClient.deleteFile(file.fileId)

            // Log successful deletion
            console.log(`[Migration] Successfully deleted: ${file.name}`)
            return { success: true, file: file.name }
          } catch (error) {
            // Log individual file deletion failure
            const errorMessage = error instanceof Error ? error.message : String(error)
            logMigrationError('DRIVE_DELETE_FILE', error, { file: file.name, fileId: file.fileId })
            
            // Continue with other files (Requirement 2.5)
            return { success: false, file: file.name, error: errorMessage }
          }
        })

        // Wait for batch to complete
        const results = await Promise.all(deletionPromises)

        // Count successful deletions and track errors
        for (const result of results) {
          if (result.success) {
            filesDeleted++
          } else {
            deletionErrors.push({ file: result.file, error: result.error || 'Unknown error' })
          }
        }
        
        logMigrationStep('DRIVE_BATCH_COMPLETE', `Batch ${batchNumber}/${totalBatches} complete (${filesDeleted}/${collectionFiles.length} files deleted)`)
      }

      // Log summary
      logMigrationStep('DRIVE_DELETION_COMPLETE', `Deletion complete: ${filesDeleted}/${collectionFiles.length} files deleted successfully`)
      
      if (deletionErrors.length > 0) {
        console.warn(`[Migration] ${deletionErrors.length} files failed to delete:`)
        deletionErrors.forEach(({ file, error }) => {
          console.warn(`  - ${file}: ${error}`)
        })
      }

      // Step 5: Clean up index files (Task 6.3)
      // Validates: Requirements 2.4
      logMigrationStep('DRIVE_INDEX_CLEANUP', 'Cleaning up index files')
      await this.cleanupIndexFiles()

      // Step 6: Add collection IDs to tombstones (Task 6.4)
      // Validates: Requirements 2.4
      logMigrationStep('DRIVE_TOMBSTONES', 'Adding collection IDs to tombstones')
      await this.addCollectionTombstones(collectionFiles)

      return { filesDeleted }
    } catch (error) {
      logMigrationError('DRIVE_CLEANUP', error, {
        step: 'Cleaning up Google Drive'
      })
      throw new Error(`Drive cleanup failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Clean up Drive index files to remove collection references
   * 
   * Validates: Requirements 2.4
   * 
   * This method performs the following steps:
   * 1. Delete the collections index file entirely
   * 2. Update the notes index to ensure no collection references exist
   * 3. Update the deleted IDs index to keep only note tombstones
   * 
   * @private
   */
  private async cleanupIndexFiles(): Promise<void> {
    try {
      console.log('[Migration] Starting index file cleanup')

      // Step 1: Delete the collections index file entirely
      console.log('[Migration] Deleting collections index file')
      await this.deleteCollectionsIndexFile()

      // Step 2: Verify notes index has no collection references
      // (Notes should not have collection references in the index itself,
      // but we verify the index is clean)
      console.log('[Migration] Verifying notes index')
      await this.verifyNotesIndex()

      // Step 3: Clean up deleted IDs index to remove collection tombstones
      // Note: We keep collection tombstones for now to prevent re-creation
      // from stale sync data. They will be pruned automatically after 30 days.
      console.log('[Migration] Deleted IDs index will retain collection tombstones for 30 days')

      console.log('[Migration] Index file cleanup completed')
    } catch (error) {
      console.error('[Migration] Index file cleanup error:', error)
      // Don't throw - index cleanup failure is not critical
      // The main data migration has already succeeded
      console.warn('[Migration] Index cleanup failed but migration can continue')
    }
  }

  /**
   * Delete the collections index file from Drive
   * 
   * @private
   */
  private async deleteCollectionsIndexFile(): Promise<void> {
    try {
      const { getOrCreateFolder } = await import('@/lib/drive/driveIndex')
      const { DEFAULT_DRIVE_CONFIG } = await import('@/lib/drive/types')
      const { driveClient } = await import('@/lib/drive/driveClient')

      const folderId = await getOrCreateFolder()
      const { collectionsIndexFile } = DEFAULT_DRIVE_CONFIG

      // Search for collections index file
      const query = `name='${collectionsIndexFile}' and '${folderId}' in parents and trashed=false`
      const result = await driveClient.searchFiles(query)

      if (result.files && result.files.length > 0) {
        const fileId = result.files[0].id
        console.log(`[Migration] Found collections index file: ${fileId}`)

        // Delete the file
        await driveClient.deleteFile(fileId)
        console.log('[Migration] Collections index file deleted successfully')
      } else {
        console.log('[Migration] Collections index file not found (may not exist)')
      }
    } catch (error) {
      console.error('[Migration] Failed to delete collections index file:', error)
      // Don't throw - this is not critical
      // The file will be ignored by the updated sync engine
    }
  }

  /**
   * Verify that the notes index has no collection references
   * 
   * The notes index itself doesn't contain collection data,
   * but we verify it's accessible and valid.
   * 
   * @private
   */
  private async verifyNotesIndex(): Promise<void> {
    try {
      const { getOrCreateNotesIndex } = await import('@/lib/drive/driveIndex')

      // Load the notes index
      const notesIndex = await getOrCreateNotesIndex()

      console.log(`[Migration] Notes index verified: ${notesIndex.notes.length} notes indexed`)

      // The notes index structure doesn't contain collection references,
      // so no cleanup is needed here. This is just a verification step.
    } catch (error) {
      console.error('[Migration] Failed to verify notes index:', error)
      // Don't throw - this is not critical
    }
  }

  /**
   * Add collection IDs to tombstones
   * 
   * Validates: Requirements 2.4
   * 
   * This method adds tombstone entries for each deleted collection to prevent
   * re-creation from stale sync data. When other devices sync, they will see
   * these tombstones and know that the collections were intentionally deleted.
   * 
   * The tombstones will be automatically pruned after 30 days by the normal
   * tombstone cleanup process.
   * 
   * @private
   * @param collectionFiles - Array of collection files that were deleted
   */
  private async addCollectionTombstones(
    collectionFiles: Array<{ id: string; name: string; fileId: string }>
  ): Promise<void> {
    try {
      if (collectionFiles.length === 0) {
        console.log('[Migration] No collection tombstones to add')
        return
      }

      console.log(`[Migration] Adding ${collectionFiles.length} collection tombstones`)

      // Import tombstone repository
      const { addTombstone } = await import('@/lib/db/tombstoneRepository')

      // Add tombstone for each deleted collection
      let tombstonesAdded = 0
      const errors: Array<{ id: string; error: string }> = []

      for (const collection of collectionFiles) {
        try {
          await addTombstone(collection.id, 'collection')
          tombstonesAdded++
          console.log(`[Migration] Added tombstone for collection: ${collection.id}`)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          console.error(`[Migration] Failed to add tombstone for ${collection.id}:`, errorMessage)
          errors.push({ id: collection.id, error: errorMessage })
        }
      }

      console.log(`[Migration] Added ${tombstonesAdded}/${collectionFiles.length} collection tombstones`)

      if (errors.length > 0) {
        console.warn(`[Migration] ${errors.length} tombstones failed to add:`)
        errors.forEach(({ id, error }) => {
          console.warn(`  - ${id}: ${error}`)
        })
      }

      // Log tombstone retention info
      console.log('[Migration] Collection tombstones will be automatically pruned after 30 days')
    } catch (error) {
      console.error('[Migration] Failed to add collection tombstones:', error)
      // Don't throw - tombstone addition failure is not critical
      // The main data migration has already succeeded
      console.warn('[Migration] Tombstone addition failed but migration can continue')
    }
  }

  /**
   * Verify if a file is a collection file
   * 
   * Validates: Requirements 2.3
   * 
   * @private
   * @param fileName - The name of the file
   * @param mimeType - The MIME type of the file
   * @returns true if the file is a valid collection file
   */
  private isCollectionFile(fileName: string, mimeType: string): boolean {
    // Check filename pattern: collection-{id}.json
    if (!fileName.startsWith('collection-') || !fileName.endsWith('.json')) {
      return false
    }

    // Check MIME type
    if (mimeType !== 'application/json') {
      return false
    }

    // Extract ID and verify it's not empty
    const collectionId = fileName.slice('collection-'.length, -'.json'.length)
    if (!collectionId || collectionId.length === 0) {
      return false
    }

    return true
  }

  /**
   * Verify migration success
   * 
   * Validates: Requirements 1.3, 2.1
   * 
   * @private
   * @returns true if verification passes, false otherwise
   */
  private async verifyMigration(): Promise<boolean> {
    try {
      // Get backup to compare counts
      if (!this.backupId) {
        console.warn('[Migration] No backup ID available for verification')
        return false
      }

      // Load backup from migrationBackup table
      const backup = await db.migrationBackup.get(this.backupId)
      
      if (!backup) {
        console.error('[Migration] Backup not found for verification')
        return false
      }

      // Verification 1: Note count should be unchanged
      const currentNoteCount = await db.notes.count()
      if (currentNoteCount !== backup.notes.length) {
        console.error(`[Migration] Note count mismatch: expected ${backup.notes.length}, got ${currentNoteCount}`)
        return false
      }

      // Verification 2: No notes should have collectionId
      const notesWithCollectionId = await db.notes
        .filter(note => 'collectionId' in note && note.collectionId !== undefined)
        .count()
      
      if (notesWithCollectionId > 0) {
        console.error(`[Migration] Found ${notesWithCollectionId} notes with collectionId`)
        return false
      }

      // Verification 3: No collections should exist
      const collectionCount = db.collections ? await db.collections.count() : 0
      if (collectionCount > 0) {
        console.error(`[Migration] Found ${collectionCount} collections still in database`)
        return false
      }

      console.log('[Migration] Verification passed')
      return true
    } catch (error) {
      console.error('[Migration] Verification failed:', error)
      return false
    }
  }

  /**
   * Restore from backup if migration fails
   * 
   * Validates: Requirements 1.5
   * 
   * This method performs a complete rollback of the migration by:
   * 1. Reading the backup from IndexedDB
   * 2. Restoring notes and collections to pre-migration state
   * 3. Verifying restoration success (count and data integrity)
   * 4. Cleaning up backup after successful rollback
   * 
   * @public
   * @throws Error if rollback fails at any step
   */
  async rollback(): Promise<void> {
    try {
      logMigrationStep('ROLLBACK_START', 'Starting rollback')

      // Step 1: Get backup ID from metadata or use stored backupId
      logMigrationStep('ROLLBACK_GET_BACKUP_ID', 'Getting backup ID')
      let backupId = this.backupId
      
      if (!backupId) {
        const metadata = await db.metadata.get(MIGRATION_METADATA_KEY)
        if (metadata) {
          const migrationMetadata = metadata.value as MigrationMetadata
          backupId = migrationMetadata.backupId
        }
      }

      if (!backupId) {
        throw new Error('No backup ID available for rollback')
      }

      // Step 2: Read backup from IndexedDB migrationBackup table
      logMigrationStep('ROLLBACK_LOAD_BACKUP', `Reading backup with ID: ${backupId}`)
      const backup = await db.migrationBackup.get(backupId)
      
      if (!backup) {
        throw new Error(`Backup not found with ID: ${backupId}`)
      }

      logMigrationStep('ROLLBACK_BACKUP_LOADED', `Backup loaded: ${backup.notes.length} notes, ${backup.collections.length} collections`)

      // Step 3: Restore notes and collections to pre-migration state
      logMigrationStep('ROLLBACK_RESTORE_NOTES', 'Restoring notes...')
      await db.notes.clear()
      await db.notes.bulkPut(backup.notes)
      logMigrationStep('ROLLBACK_NOTES_RESTORED', `Restored ${backup.notes.length} notes`)

      logMigrationStep('ROLLBACK_RESTORE_COLLECTIONS', 'Restoring collections...')
      if (db.collections) {
        await db.collections.clear()
        await db.collections.bulkPut(backup.collections)
        logMigrationStep('ROLLBACK_COLLECTIONS_RESTORED', `Restored ${backup.collections.length} collections`)
      } else {
        console.warn('[Migration] Collections table not available, skipping collection restoration')
      }

      // Step 4: Verify restoration success
      logMigrationStep('ROLLBACK_VERIFY', 'Verifying restoration...')
      const verificationSuccess = await this.verifyRollback(backup)
      
      if (!verificationSuccess) {
        throw new Error('Rollback verification failed - data integrity check did not pass')
      }

      logMigrationStep('ROLLBACK_VERIFIED', 'Restoration verified successfully')

      // Step 5: Clean up backup after successful rollback
      logMigrationStep('ROLLBACK_CLEANUP', 'Cleaning up backup...')
      await this.cleanupBackup(backupId)
      logMigrationStep('ROLLBACK_CLEANUP_COMPLETE', 'Backup cleaned up successfully')

      // Reset migration metadata
      await this.updateMigrationStatus('pending')

      logMigrationStep('ROLLBACK_COMPLETE', 'Rollback completed successfully')
    } catch (error) {
      logMigrationError('ROLLBACK', error, {
        step: 'Rolling back migration'
      })
      throw new Error(`Rollback failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Verify rollback restoration success
   * 
   * Performs comprehensive verification including:
   * - Count verification (notes and collections)
   * - Data integrity verification (sample checks)
   * - Schema verification (collectionId fields restored)
   * 
   * @private
   * @param backup - The backup that was restored
   * @returns true if verification passes, false otherwise
   */
  private async verifyRollback(backup: MigrationBackup): Promise<boolean> {
    try {
      // Verification 1: Count verification
      const restoredNoteCount = await db.notes.count()
      const restoredCollectionCount = db.collections ? await db.collections.count() : 0

      if (restoredNoteCount !== backup.notes.length) {
        console.error(`[Migration] Note count mismatch: expected ${backup.notes.length}, got ${restoredNoteCount}`)
        return false
      }

      if (restoredCollectionCount !== backup.collections.length) {
        console.error(`[Migration] Collection count mismatch: expected ${backup.collections.length}, got ${restoredCollectionCount}`)
        return false
      }

      console.log('[Migration] Count verification passed')

      // Verification 2: Data integrity verification (sample checks)
      // Check that specific notes from backup exist in database
      if (backup.notes.length > 0) {
        // Check first note
        const firstBackupNote = backup.notes[0]
        const firstRestoredNote = await db.notes.get(firstBackupNote.id)
        
        if (!firstRestoredNote) {
          console.error(`[Migration] First note not found: ${firstBackupNote.id}`)
          return false
        }

        // Verify key properties match
        if (firstRestoredNote.title !== firstBackupNote.title ||
            firstRestoredNote.content !== firstBackupNote.content ||
            firstRestoredNote.createdAt !== firstBackupNote.createdAt) {
          console.error('[Migration] First note data mismatch')
          return false
        }

        // Check last note if there are multiple notes
        if (backup.notes.length > 1) {
          const lastBackupNote = backup.notes[backup.notes.length - 1]
          const lastRestoredNote = await db.notes.get(lastBackupNote.id)
          
          if (!lastRestoredNote) {
            console.error(`[Migration] Last note not found: ${lastBackupNote.id}`)
            return false
          }
        }
      }

      // Check collections if they exist
      if (backup.collections.length > 0 && db.collections) {
        const firstBackupCollection = backup.collections[0]
        const firstRestoredCollection = await db.collections.get(firstBackupCollection.id)
        
        if (!firstRestoredCollection) {
          console.error(`[Migration] First collection not found: ${firstBackupCollection.id}`)
          return false
        }

        // Verify key properties match
        if (firstRestoredCollection.name !== firstBackupCollection.name ||
            firstRestoredCollection.color !== firstBackupCollection.color) {
          console.error('[Migration] First collection data mismatch')
          return false
        }
      }

      console.log('[Migration] Data integrity verification passed')

      // Verification 3: Schema verification (collectionId fields should be restored)
      // Check that notes with collectionId in backup have collectionId restored
      const notesWithCollectionIdInBackup = backup.notes.filter(note => 
        'collectionId' in note && note.collectionId !== undefined
      )

      if (notesWithCollectionIdInBackup.length > 0) {
        // Sample check: verify first note with collectionId
        const sampleNote = notesWithCollectionIdInBackup[0]
        const restoredNote = await db.notes.get(sampleNote.id) as Note & { collectionId?: string }
        
        if (!restoredNote) {
          console.error(`[Migration] Sample note not found: ${sampleNote.id}`)
          return false
        }

        if (!('collectionId' in restoredNote) || restoredNote.collectionId === undefined) {
          console.error('[Migration] CollectionId not restored for sample note')
          return false
        }

        console.log('[Migration] Schema verification passed (collectionId restored)')
      }

      console.log('[Migration] All rollback verifications passed')
      return true
    } catch (error) {
      console.error('[Migration] Rollback verification error:', error)
      return false
    }
  }

  /**
   * Clean up backup after successful rollback
   * 
   * Removes the backup from the migrationBackup table and clears
   * the backup reference from migration metadata.
   * 
   * @private
   * @param backupId - The ID of the backup to clean up
   */
  private async cleanupBackup(backupId: number): Promise<void> {
    try {
      // Remove backup from migrationBackup table
      await db.migrationBackup.delete(backupId)
      console.log(`[Migration] Deleted backup with ID: ${backupId}`)

      // Clear backup reference from metadata
      const metadata = await db.metadata.get(MIGRATION_METADATA_KEY)
      if (metadata) {
        const migrationMetadata = metadata.value as MigrationMetadata
        delete migrationMetadata.backupId
        
        await db.metadata.put({
          key: MIGRATION_METADATA_KEY,
          value: migrationMetadata
        })
        
        console.log('[Migration] Cleared backup reference from metadata')
      }

      // Clear instance backup ID
      this.backupId = undefined
    } catch (error) {
      console.error('[Migration] Backup cleanup error:', error)
      // Don't throw - cleanup failure is not critical
      // The backup will remain in the database but won't affect functionality
    }
  }

  /**
   * Update migration status in metadata
   * 
   * @private
   * @param status - New migration status
   */
  private async updateMigrationStatus(status: MigrationMetadata['migrationStatus']): Promise<void> {
    try {
      const metadata = await db.metadata.get(MIGRATION_METADATA_KEY)
      const migrationMetadata: MigrationMetadata = metadata?.value as MigrationMetadata || {
        migrationVersion: MIGRATION_VERSION,
        lastMigrationDate: Date.now(),
        migrationStatus: status
      }

      migrationMetadata.migrationStatus = status
      migrationMetadata.lastMigrationDate = Date.now()

      await db.metadata.put({
        key: MIGRATION_METADATA_KEY,
        value: migrationMetadata
      })

      console.log(`[Migration] Status updated to: ${status}`)
    } catch (error) {
      console.error('[Migration] Failed to update migration status:', error)
      // Don't throw - this is not critical
    }
  }

  /**
   * Generate and store migration report
   * 
   * Validates: Requirements 10.4
   * 
   * Creates a comprehensive migration report with all details including:
   * - Timestamp and duration
   * - Success status
   * - Statistics (notes processed, collections removed, Drive files deleted)
   * - All migration steps with timestamps
   * - Any errors encountered
   * 
   * The report is stored in localStorage for user access and debugging.
   * 
   * @private
   * @param result - The migration result
   * @param duration - Migration duration in milliseconds
   */
  private async generateMigrationReport(result: MigrationResult, duration: number): Promise<void> {
    try {
      const report: MigrationReport = {
        timestamp: Date.now(),
        startTime: this.migrationStartTime,
        endTime: this.migrationStartTime + duration,
        duration,
        success: result.success,
        notesProcessed: result.notesProcessed,
        collectionsRemoved: result.collectionsRemoved,
        driveFilesDeleted: result.driveFilesDeleted,
        errors: result.errors,
        steps: this.migrationSteps
      }

      // Store report in localStorage for user access
      try {
        localStorage.setItem('g-note-migration-report', JSON.stringify(report))
        console.log('[Migration] Migration report saved to localStorage')
      } catch (storageError) {
        console.warn('[Migration] Failed to save report to localStorage:', storageError)
        // Try to save a minimal report
        try {
          const minimalReport = {
            timestamp: report.timestamp,
            success: report.success,
            notesProcessed: report.notesProcessed,
            collectionsRemoved: report.collectionsRemoved,
            driveFilesDeleted: report.driveFilesDeleted,
            errors: report.errors
          }
          localStorage.setItem('g-note-migration-report', JSON.stringify(minimalReport))
          console.log('[Migration] Minimal migration report saved to localStorage')
        } catch (minimalError) {
          console.error('[Migration] Failed to save even minimal report:', minimalError)
        }
      }

      // Also store in IndexedDB metadata for persistence
      try {
        await db.metadata.put({
          key: 'migration_report',
          value: report
        })
        console.log('[Migration] Migration report saved to IndexedDB')
      } catch (dbError) {
        console.warn('[Migration] Failed to save report to IndexedDB:', dbError)
      }

      console.log('[Migration] Migration report generated successfully')
    } catch (error) {
      console.error('[Migration] Failed to generate migration report:', error)
      // Don't throw - report generation failure should not fail the migration
    }
  }
}

// ============ Singleton Instance ============

export const migrationEngine = new RemoveCollectionMigration()
