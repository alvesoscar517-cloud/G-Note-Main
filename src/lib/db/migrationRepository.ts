/**
 * Migration Metadata Repository
 * 
 * Manages migration metadata including version, status, and backup references.
 * This repository provides a dedicated interface for tracking migration progress
 * and state, ensuring migration idempotence and proper error handling.
 * 
 * Requirements: 9.5 (Migration flag to prevent re-running)
 */
import { db } from './schema'
import type { MigrationMetadata } from '../migration/removeCollectionMigration'

// ============ Constants ============

const MIGRATION_METADATA_KEY = 'migration_metadata'

// ============ Core Functions ============

/**
 * Get migration metadata
 * 
 * Retrieves the current migration status, version, and related information.
 * Returns undefined if no migration has been run yet.
 * 
 * @returns MigrationMetadata or undefined if not found
 */
export async function getMigrationMetadata(): Promise<MigrationMetadata | undefined> {
  const item = await db.metadata.get(MIGRATION_METADATA_KEY)
  return item?.value as MigrationMetadata | undefined
}

/**
 * Set migration metadata
 * 
 * Updates the migration metadata with new status, version, or backup information.
 * This is used to track migration progress and prevent re-running completed migrations.
 * 
 * @param metadata - The migration metadata to store
 */
export async function setMigrationMetadata(metadata: MigrationMetadata): Promise<void> {
  await db.metadata.put({
    key: MIGRATION_METADATA_KEY,
    value: metadata
  })
}

/**
 * Get migration version
 * 
 * Returns the current migration version number, or 0 if no migration has been run.
 * 
 * @returns Migration version number
 */
export async function getMigrationVersion(): Promise<number> {
  const metadata = await getMigrationMetadata()
  return metadata?.migrationVersion ?? 0
}

/**
 * Set migration version
 * 
 * Updates the migration version number. This is typically called after
 * a successful migration to mark the new schema version.
 * 
 * @param version - The new migration version number
 */
export async function setMigrationVersion(version: number): Promise<void> {
  const metadata = await getMigrationMetadata()
  const updatedMetadata: MigrationMetadata = {
    ...metadata,
    migrationVersion: version,
    lastMigrationDate: Date.now(),
    migrationStatus: metadata?.migrationStatus ?? 'pending'
  }
  await setMigrationMetadata(updatedMetadata)
}

/**
 * Get migration status
 * 
 * Returns the current migration status: 'pending', 'in_progress', 'completed', or 'failed'.
 * Returns 'pending' if no migration has been run yet.
 * 
 * @returns Migration status
 */
export async function getMigrationStatus(): Promise<MigrationMetadata['migrationStatus']> {
  const metadata = await getMigrationMetadata()
  return metadata?.migrationStatus ?? 'pending'
}

/**
 * Set migration status
 * 
 * Updates the migration status. This is used to track the current state
 * of the migration process and handle failures appropriately.
 * 
 * @param status - The new migration status
 */
export async function setMigrationStatus(status: MigrationMetadata['migrationStatus']): Promise<void> {
  const metadata = await getMigrationMetadata()
  const updatedMetadata: MigrationMetadata = {
    migrationVersion: metadata?.migrationVersion ?? 0,
    lastMigrationDate: Date.now(),
    migrationStatus: status,
    backupId: metadata?.backupId
  }
  await setMigrationMetadata(updatedMetadata)
}

/**
 * Get backup ID
 * 
 * Returns the backup ID associated with the current migration, if any.
 * This is used for rollback operations.
 * 
 * @returns Backup ID or undefined if no backup exists
 */
export async function getBackupId(): Promise<number | undefined> {
  const metadata = await getMigrationMetadata()
  return metadata?.backupId
}

/**
 * Set backup ID
 * 
 * Associates a backup ID with the current migration. This is used to
 * track which backup should be used for rollback if the migration fails.
 * 
 * @param backupId - The backup ID to store
 */
export async function setBackupId(backupId: number): Promise<void> {
  const metadata = await getMigrationMetadata()
  const updatedMetadata: MigrationMetadata = {
    migrationVersion: metadata?.migrationVersion ?? 0,
    lastMigrationDate: metadata?.lastMigrationDate ?? Date.now(),
    migrationStatus: metadata?.migrationStatus ?? 'pending',
    backupId
  }
  await setMigrationMetadata(updatedMetadata)
}

/**
 * Clear backup ID
 * 
 * Removes the backup ID reference from migration metadata.
 * This is typically called after a successful rollback or when
 * cleaning up old backups.
 */
export async function clearBackupId(): Promise<void> {
  const metadata = await getMigrationMetadata()
  if (metadata) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { backupId, ...metadataWithoutBackup } = metadata
    await setMigrationMetadata(metadataWithoutBackup as MigrationMetadata)
  }
}

/**
 * Check if migration is needed
 * 
 * Determines if a migration needs to run based on the current migration
 * status and version. Returns true if:
 * - No migration has been run yet
 * - Previous migration failed
 * - Previous migration is stuck in 'in_progress' state
 * - Migration version is less than the target version
 * 
 * @param targetVersion - The target migration version to check against
 * @returns true if migration is needed, false otherwise
 */
export async function isMigrationNeeded(targetVersion: number): Promise<boolean> {
  const metadata = await getMigrationMetadata()
  
  // No metadata means migration hasn't run yet
  if (!metadata) {
    return true
  }

  // Check if migration is already completed at or above target version
  if (metadata.migrationStatus === 'completed' && 
      metadata.migrationVersion >= targetVersion) {
    return false
  }

  // Check if migration failed previously
  if (metadata.migrationStatus === 'failed') {
    return true
  }

  // Check if migration is stuck in progress (might be from a crash)
  if (metadata.migrationStatus === 'in_progress') {
    return true
  }

  // Check if version is below target
  if (metadata.migrationVersion < targetVersion) {
    return true
  }

  return false
}

/**
 * Reset migration metadata
 * 
 * Clears all migration metadata. This is primarily used for testing
 * or in rare cases where a complete migration reset is needed.
 * 
 * WARNING: This should not be called during normal operation.
 */
export async function resetMigrationMetadata(): Promise<void> {
  await db.metadata.delete(MIGRATION_METADATA_KEY)
}

/**
 * Get last migration date
 * 
 * Returns the timestamp of the last migration attempt, or undefined
 * if no migration has been run yet.
 * 
 * @returns Last migration timestamp or undefined
 */
export async function getLastMigrationDate(): Promise<number | undefined> {
  const metadata = await getMigrationMetadata()
  return metadata?.lastMigrationDate
}
