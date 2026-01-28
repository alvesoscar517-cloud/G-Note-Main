# Migration Engine - Remove Collection Feature

## Overview

This module implements the migration engine for removing the Collection feature from the application. It ensures safe data migration while preserving all user notes.

## Task 1.2: Backup Creation Logic

### Implementation Details

The backup creation logic has been enhanced with the following features:

#### 1. Backup Data Structure
- **timestamp**: Unique identifier and creation time
- **notes**: Array of all notes before migration
- **collections**: Array of all collections before migration
- **version**: Schema version before migration (8)

#### 2. Storage in migrationBackup Table
- Backups are stored in a dedicated `migrationBackup` IndexedDB table
- Uses `timestamp` as the primary key
- Separate from the metadata table for better organization
- Backup reference (backupId) is stored in migration metadata

#### 3. Error Handling for Storage Quota Issues

The implementation includes comprehensive error handling for storage quota exceeded errors:

**Detection:**
- Checks for `QuotaExceededError` by name
- Checks error messages for quota-related keywords
- Works with both DOMException and Dexie errors

**User-Friendly Error Messages:**
When storage quota is exceeded, users receive clear guidance:
- Estimated backup size
- Specific steps to free up storage:
  1. Close other tabs/applications
  2. Clear browser cache and data
  3. Delete unnecessary files
  4. Move to a device with more storage

**Size Estimation:**
- Estimates backup size before storage attempt
- Provides human-readable size format (Bytes, KB, MB, GB)
- Helps users understand storage requirements

### Code Structure

```typescript
// Main backup creation method
private async createBackup(): Promise<void>

// Helper methods
private isQuotaExceededError(error: unknown): boolean
private estimateBackupSize(backup: MigrationBackup): number
private formatBytes(bytes: number): string
```

### Database Schema Changes

Added `migrationBackup` table in schema version 9:

```typescript
// Version 9: Add migration backup table
this.version(9).stores({
  // ... existing tables ...
  migrationBackup: 'timestamp'
})
```

### Testing

Manual tests are provided in `__tests__/removeCollectionMigration.test.ts`:

1. **testBackupCreation**: Verifies backup structure and data preservation
2. **testBackupUsesCorrectTable**: Confirms backup uses migrationBackup table
3. **testStorageQuotaErrorHandling**: Documents manual quota testing procedure

To run tests in browser console:
```javascript
window.migrationTests.runAllTests()
```

### Requirements Validated

- **Requirement 1.4**: Backup creation before migration
  - ✓ Creates backup with timestamp, notes, collections, and version
  - ✓ Stores in dedicated migrationBackup table
  - ✓ Handles storage quota errors with clear messages

### Error Scenarios

| Scenario | Detection | Response |
|----------|-----------|----------|
| Storage quota exceeded | QuotaExceededError name or message | User-friendly error with size estimate and recovery steps |
| Backup write failure | Generic error | Clear error message, migration aborted |
| Missing collections table | Database error | Graceful handling, empty collections array |

### Future Enhancements

Potential improvements for future iterations:
- Automatic backup cleanup after successful migration
- Backup compression to reduce storage requirements
- Progress indicator for large backups
- Backup export/import functionality

## Related Files

- `src/lib/db/schema.ts` - Database schema with migrationBackup table
- `src/lib/migration/removeCollectionMigration.ts` - Main migration engine
- `src/lib/migration/__tests__/removeCollectionMigration.test.ts` - Manual tests

## Next Steps

Task 1.4 will implement property-based tests for backup creation to ensure correctness across all input scenarios.

## Task 1.3: Rollback Mechanism

### Implementation Details

The rollback mechanism provides comprehensive data restoration in case of migration failure. It has been enhanced with proper verification and backup cleanup.

#### 1. Rollback Steps

The rollback process follows these steps:

1. **Read Backup from IndexedDB**
   - Retrieves backup ID from metadata or instance variable
   - Loads backup from `migrationBackup` table
   - Validates backup exists before proceeding

2. **Restore Data to Pre-Migration State**
   - Clears current notes and collections
   - Restores notes from backup using `bulkPut`
   - Restores collections from backup using `bulkPut`
   - Preserves all original data including `collectionId` fields

3. **Verify Restoration Success**
   - Performs comprehensive verification (see below)
   - Ensures data integrity is maintained
   - Validates schema correctness

4. **Clean Up Backup After Successful Rollback**
   - Deletes backup from `migrationBackup` table
   - Removes backup reference from migration metadata
   - Resets migration status to 'pending'

#### 2. Rollback Verification

The rollback verification ensures complete and accurate data restoration:

**Count Verification:**
- Verifies note count matches backup
- Verifies collection count matches backup
- Fails if any count mismatch detected

**Data Integrity Verification:**
- Checks first note exists and matches backup data
- Verifies key properties: title, content, createdAt
- Checks last note if multiple notes exist
- Validates first collection exists and matches backup
- Verifies collection properties: name, color

**Schema Verification:**
- Ensures `collectionId` fields are restored for notes that had them
- Validates notes without `collectionId` remain unchanged
- Confirms schema structure matches pre-migration state

**Sample-Based Approach:**
- Uses sample checks for efficiency with large datasets
- Validates first and last items to catch edge cases
- Balances thoroughness with performance

#### 3. Backup Cleanup

After successful rollback, the system performs cleanup:

**Cleanup Actions:**
- Deletes backup from `migrationBackup` table using backup ID
- Removes `backupId` field from migration metadata
- Clears instance `backupId` variable
- Logs cleanup actions for debugging

**Error Handling:**
- Cleanup failures are logged but don't fail rollback
- Backup remains in database if cleanup fails
- Won't affect functionality (just uses extra storage)

### Code Structure

```typescript
// Main rollback method
async rollback(): Promise<void>

// Helper methods
private async verifyRollback(backup: MigrationBackup): Promise<boolean>
private async cleanupBackup(backupId: number): Promise<void>
```

### Testing

Enhanced manual tests in `__tests__/removeCollectionMigration.test.ts`:

1. **testRollbackRestoration**: Verifies complete data restoration
   - Tests note restoration with `collectionId`
   - Tests note restoration without `collectionId`
   - Tests collection restoration
   - Validates all properties match original data

2. **testRollbackBackupCleanup**: Confirms backup cleanup after rollback
   - Verifies backup is deleted from `migrationBackup` table
   - Confirms `backupId` removed from metadata
   - Ensures no orphaned backup data remains

3. **testRollbackVerification**: Tests verification catches issues
   - Tests verification passes with correct data
   - Tests verification fails with missing note
   - Tests verification fails with wrong count
   - Validates verification logic is thorough

To run rollback tests in browser console:
```javascript
// Run all tests including rollback tests
window.migrationTests.runAllTests()

// Run individual rollback tests
window.migrationTests.testRollbackRestoration()
window.migrationTests.testRollbackCleanup()
window.migrationTests.testRollbackVerification()
```

### Requirements Validated

- **Requirement 1.5**: Rollback on migration failure
  - ✅ Reads backup from IndexedDB
  - ✅ Restores notes and collections to pre-migration state
  - ✅ Verifies restoration success (count, data integrity, schema)
  - ✅ Cleans up backup after successful rollback

### Error Scenarios

| Scenario | Detection | Response |
|----------|-----------|----------|
| No backup ID available | Missing backupId in metadata and instance | Throw error with clear message |
| Backup not found | Database query returns null | Throw error with backup ID |
| Restoration failure | Database operation error | Throw error with details |
| Verification failure | Count or data mismatch | Throw error indicating integrity issue |
| Cleanup failure | Database delete error | Log warning, don't fail rollback |

### Rollback Flow Diagram

```
┌─────────────────────────────────────┐
│  Migration Fails                    │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  1. Get Backup ID                   │
│     - From instance or metadata     │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  2. Read Backup from IndexedDB      │
│     - Load from migrationBackup     │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  3. Restore Data                    │
│     - Clear current data            │
│     - Restore notes                 │
│     - Restore collections           │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  4. Verify Restoration              │
│     - Count verification            │
│     - Data integrity checks         │
│     - Schema verification           │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  5. Clean Up Backup                 │
│     - Delete from migrationBackup   │
│     - Remove from metadata          │
│     - Reset migration status        │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  Rollback Complete                  │
└─────────────────────────────────────┘
```

### Performance Considerations

- **Batch Operations**: Uses `bulkPut` for efficient restoration
- **Sample Verification**: Checks first/last items instead of all items
- **Cleanup Optimization**: Cleanup failures don't block rollback completion
- **Memory Efficiency**: Loads backup once and reuses for verification

### Future Enhancements

Potential improvements for future iterations:
- Partial rollback support (notes only or collections only)
- Rollback progress callbacks for UI updates
- Multiple backup retention for safety
- Automated backup expiration after successful migration
- Rollback history tracking for debugging

## Next Steps

Task 1.4 will implement property-based tests for backup creation and rollback to ensure correctness across all input scenarios.
