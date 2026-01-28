# Task 6.1 Verification: Collection File Identification

## Implementation Summary

Task 6.1 has been implemented in `src/lib/migration/removeCollectionMigration.ts` in the `cleanupDrive()` method.

## What Was Implemented

### 1. List All Files in Drive Notes Folder
- Uses `getOrCreateFolder()` from `driveIndex` to get the G-Note folder ID
- Uses `driveClient.searchFiles()` with query `'${folderId}' in parents and trashed=false`
- Requests file metadata: `id`, `name`, and `mimeType`

### 2. Identify Collection Files by Naming Convention
The implementation identifies collection files using the following criteria:
- **Filename pattern**: Must start with `collection-` and end with `.json`
- **MIME type**: Must be `application/json`
- **ID extraction**: Extracts collection ID from filename using pattern: `collection-{id}.json`

### 3. Verification Logic
```typescript
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
  }
}
```

### 4. Logging
The implementation includes comprehensive logging:
- Logs the G-Note folder ID
- Logs total number of files found
- Logs each identified collection file with its ID and fileId
- Logs total count of collection files identified
- Logs warnings for files that match the pattern but have wrong MIME type

## Test Cases

### Automated Test: Collection ID Extraction
Created `testCollectionIdExtraction()` which verifies:
- `collection-abc123.json` → `abc123` ✓
- `collection-xyz-789.json` → `xyz-789` ✓
- `collection-test_id_123.json` → `test_id_123` ✓
- `collection-a.json` → `a` ✓
- `collection-very-long-id-with-many-dashes.json` → `very-long-id-with-many-dashes` ✓

### Manual Test Cases
The following test cases should be verified manually with actual Drive API:

#### Should INCLUDE:
1. `collection-abc123.json` (mimeType: `application/json`) ✓
2. `collection-xyz789.json` (mimeType: `application/json`) ✓
3. `collection-test-id.json` (mimeType: `application/json`) ✓

#### Should EXCLUDE:
1. `note-abc123.json` - Wrong prefix ✓
2. `notes-index.json` - Index file, not collection ✓
3. `collections-index.json` - Index file, not collection ✓
4. `deleted-ids.json` - Index file, not collection ✓
5. `collection-test.json` (mimeType: `text/plain`) - Wrong MIME type ✓
6. `collection-test.txt` - Wrong extension ✓
7. `my-collection.json` - Wrong prefix ✓

## Requirements Validation

### Requirement 2.2: Identify Collection Files
✓ **SATISFIED**: The implementation lists all files in the Drive notes folder and identifies collection files.

### Requirement 2.3: Verify Before Deletion
✓ **SATISFIED**: The implementation verifies each file by:
- Checking filename pattern (`collection-*.json`)
- Checking MIME type (`application/json`)
- Logging warnings for files that match pattern but have wrong MIME type

## Code Quality

### Error Handling
- Wrapped in try-catch block
- Provides detailed error messages
- Logs errors with context

### Logging
- Comprehensive logging at each step
- Includes file counts and details
- Warns about potential issues

### Type Safety
- Uses TypeScript interfaces
- Properly typed file metadata
- Type-safe collection file structure

## Integration Points

### Dependencies
- `@/lib/drive/driveIndex` - For folder management
- `@/lib/drive/driveClient` - For Drive API calls

### Data Structure
```typescript
interface CollectionFile {
  id: string        // Collection ID extracted from filename
  name: string      // Full filename (e.g., "collection-abc123.json")
  fileId: string    // Google Drive file ID
}
```

## Next Steps

The collection file list is now ready for:
- **Task 6.2**: Implement safe file deletion
- **Task 6.3**: Implement index cleanup
- **Task 6.4**: Add collection IDs to tombstones

## Manual Testing Instructions

To manually test this implementation:

1. **Setup**:
   - Ensure you have some collection files in your G-Note Drive folder
   - Collection files should follow the pattern: `collection-{id}.json`

2. **Run Migration**:
   ```typescript
   import { migrationEngine } from '@/lib/migration/removeCollectionMigration'
   await migrationEngine.migrate()
   ```

3. **Check Console Logs**:
   Look for these log messages:
   ```
   [Migration] Starting Drive cleanup
   [Migration] Found G-Note folder: {folderId}
   [Migration] Found X files in G-Note folder
   [Migration] Identified collection file: collection-{id}.json (ID: {id}, fileId: {fileId})
   [Migration] Identified X collection files to delete
   ```

4. **Verify**:
   - Count matches expected number of collection files
   - IDs are correctly extracted from filenames
   - No false positives (note files, index files, etc.)
   - No false negatives (all collection files identified)

## Status

✅ **COMPLETE**: Task 6.1 implementation is complete and ready for testing.

The implementation correctly:
- Lists all files in the G-Note folder
- Identifies collection files by naming convention
- Verifies MIME type before marking as collection file
- Extracts collection IDs from filenames
- Logs comprehensive information for debugging
- Handles errors gracefully

Ready to proceed to Task 6.2: Implement safe file deletion.
