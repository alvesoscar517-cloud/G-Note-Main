# Migration Repository

The migration repository provides a dedicated interface for managing migration metadata, including version tracking, status management, and backup references.

## Purpose

This repository is designed to:
- Track migration progress and state
- Ensure migration idempotence (prevent re-running completed migrations)
- Manage backup references for rollback operations
- Provide clear migration status for error handling

## Core Functions

### Metadata Management

#### `getMigrationMetadata(): Promise<MigrationMetadata | undefined>`
Retrieves the complete migration metadata object.

```typescript
const metadata = await getMigrationMetadata()
if (metadata) {
  console.log('Migration version:', metadata.migrationVersion)
  console.log('Status:', metadata.migrationStatus)
}
```

#### `setMigrationMetadata(metadata: MigrationMetadata): Promise<void>`
Updates the complete migration metadata object.

```typescript
await setMigrationMetadata({
  migrationVersion: 9,
  lastMigrationDate: Date.now(),
  migrationStatus: 'completed'
})
```

### Version Management

#### `getMigrationVersion(): Promise<number>`
Returns the current migration version number (0 if no migration has run).

```typescript
const version = await getMigrationVersion()
console.log('Current migration version:', version)
```

#### `setMigrationVersion(version: number): Promise<void>`
Updates the migration version number.

```typescript
await setMigrationVersion(9)
```

### Status Management

#### `getMigrationStatus(): Promise<'pending' | 'in_progress' | 'completed' | 'failed'>`
Returns the current migration status ('pending' if no migration has run).

```typescript
const status = await getMigrationStatus()
if (status === 'failed') {
  console.log('Previous migration failed, needs retry')
}
```

#### `setMigrationStatus(status: MigrationMetadata['migrationStatus']): Promise<void>`
Updates the migration status.

```typescript
await setMigrationStatus('in_progress')
// ... perform migration ...
await setMigrationStatus('completed')
```

### Backup Management

#### `getBackupId(): Promise<number | undefined>`
Returns the backup ID associated with the current migration.

```typescript
const backupId = await getBackupId()
if (backupId) {
  console.log('Backup available for rollback:', backupId)
}
```

#### `setBackupId(backupId: number): Promise<void>`
Associates a backup ID with the current migration.

```typescript
const backup = await createBackup()
await setBackupId(backup.timestamp)
```

#### `clearBackupId(): Promise<void>`
Removes the backup ID reference from migration metadata.

```typescript
await clearBackupId()
```

### Migration Detection

#### `isMigrationNeeded(targetVersion: number): Promise<boolean>`
Determines if a migration needs to run based on current state.

Returns `true` if:
- No migration has been run yet
- Previous migration failed
- Previous migration is stuck in 'in_progress' state
- Migration version is less than the target version

```typescript
const needsMigration = await isMigrationNeeded(9)
if (needsMigration) {
  console.log('Migration required')
  await runMigration()
}
```

### Utility Functions

#### `getLastMigrationDate(): Promise<number | undefined>`
Returns the timestamp of the last migration attempt.

```typescript
const lastDate = await getLastMigrationDate()
if (lastDate) {
  console.log('Last migration:', new Date(lastDate))
}
```

#### `resetMigrationMetadata(): Promise<void>`
Clears all migration metadata. **Use with caution** - primarily for testing.

```typescript
await resetMigrationMetadata()
```

## Usage Example

Here's a complete example of using the migration repository in a migration engine:

```typescript
import {
  isMigrationNeeded,
  setMigrationStatus,
  setBackupId,
  clearBackupId,
  getMigrationMetadata
} from '@/lib/db/migrationRepository'

async function runMigration() {
  // Check if migration is needed
  const needed = await isMigrationNeeded(9)
  if (!needed) {
    console.log('Migration already completed')
    return
  }

  try {
    // Update status to in_progress
    await setMigrationStatus('in_progress')

    // Create backup
    const backup = await createBackup()
    await setBackupId(backup.timestamp)

    // Perform migration
    await migrateData()

    // Mark as completed
    await setMigrationStatus('completed')
    await setMigrationVersion(9)

    console.log('Migration completed successfully')
  } catch (error) {
    // Mark as failed
    await setMigrationStatus('failed')
    console.error('Migration failed:', error)

    // Attempt rollback
    await rollback()
  }
}
```

## Data Structure

### MigrationMetadata

```typescript
interface MigrationMetadata {
  migrationVersion: number
  lastMigrationDate: number
  migrationStatus: 'pending' | 'in_progress' | 'completed' | 'failed'
  backupId?: number
}
```

## Testing

Manual tests are available in `__tests__/migrationRepository.test.ts`. To run them:

1. Open your application in a browser
2. Open the browser console
3. Run the tests:

```javascript
// Run all tests
window.migrationRepositoryTests.runAllTests()

// Run individual tests
window.migrationRepositoryTests.testMigrationVersion()
window.migrationRepositoryTests.testMigrationStatus()
window.migrationRepositoryTests.testBackupId()
```

## Requirements

This repository validates **Requirement 9.5**: Migration flag to prevent re-running completed migrations.

The `isMigrationNeeded()` function ensures that:
- Completed migrations are not re-run
- Failed migrations can be retried
- Stuck migrations (in_progress) are detected and can be retried
- Version tracking prevents running outdated migrations

## Best Practices

1. **Always check if migration is needed** before running a migration:
   ```typescript
   if (await isMigrationNeeded(targetVersion)) {
     await runMigration()
   }
   ```

2. **Update status at each step** to track progress:
   ```typescript
   await setMigrationStatus('in_progress')
   // ... migration steps ...
   await setMigrationStatus('completed')
   ```

3. **Store backup ID** for rollback capability:
   ```typescript
   const backup = await createBackup()
   await setBackupId(backup.timestamp)
   ```

4. **Handle failures gracefully**:
   ```typescript
   try {
     await runMigration()
   } catch (error) {
     await setMigrationStatus('failed')
     await rollback()
   }
   ```

5. **Clean up backup references** after successful rollback:
   ```typescript
   await rollback()
   await clearBackupId()
   ```

## Related Files

- `src/lib/migration/removeCollectionMigration.ts` - Uses this repository for migration tracking
- `src/lib/db/schema.ts` - Defines the metadata table structure
- `src/lib/db/metadataRepository.ts` - General metadata repository (this is a specialized version)
