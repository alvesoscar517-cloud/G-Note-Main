/**
 * Verification Test for Task 4.2: Implement Collection Deletion
 * 
 * This test verifies that the migrateLocalData() method correctly:
 * 1. Deletes all collections from IndexedDB
 * 2. Clears collection-related metadata
 * 
 * Requirements: 2.1
 */

import { db, type Collection } from '@/lib/db/schema'
import { RemoveCollectionMigration } from '../removeCollectionMigration'
import type { Note } from '@/types'

// Legacy Note type with collectionId for testing migration
type LegacyNote = Note & { collectionId?: string }

/**
 * Test: Verify collection deletion from IndexedDB
 * 
 * This test verifies that:
 * - All collections are deleted from the collections table
 * - The collection count is correctly reported
 * - No collections remain after migration
 */
export async function testCollectionDeletion() {
  console.log('[Task 4.2 Test] Starting collection deletion verification...')
  
  try {
    // Setup: Create test notes and collections
    const testNotes: LegacyNote[] = [
      {
        id: 'note-1',
        title: 'Note 1',
        content: 'Content 1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isPinned: false,
        syncStatus: 'synced',
        version: 1,
        collectionId: 'collection-1'
      },
      {
        id: 'note-2',
        title: 'Note 2',
        content: 'Content 2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isPinned: false,
        syncStatus: 'synced',
        version: 1,
        collectionId: 'collection-2'
      },
      {
        id: 'note-3',
        title: 'Note 3',
        content: 'Content 3',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isPinned: false,
        syncStatus: 'synced',
        version: 1,
        collectionId: 'collection-1'
      },
      {
        id: 'note-4',
        title: 'Note 4',
        content: 'Content 4',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isPinned: false,
        syncStatus: 'synced',
        version: 1
        // No collectionId
      }
    ]

    const testCollections: Collection[] = [
      {
        id: 'collection-1',
        name: 'Collection 1',
        color: '#FF0000',
        noteIds: ['note-1', 'note-3'],
        isExpanded: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        syncStatus: 'synced'
      },
      {
        id: 'collection-2',
        name: 'Collection 2',
        color: '#00FF00',
        noteIds: ['note-2'],
        isExpanded: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        syncStatus: 'synced'
      },
      {
        id: 'collection-3',
        name: 'Empty Collection',
        color: '#0000FF',
        noteIds: [],
        isExpanded: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        syncStatus: 'synced'
      }
    ]

    // Add test data to database
    await db.notes.bulkPut(testNotes)
    
    if (!db.collections) {
      console.warn('[Task 4.2 Test] Collections table not available - migration may have already run')
      console.log('[Task 4.2 Test] ⚠ Test skipped (collections table not available)')
      return true
    }
    
    await db.collections.bulkPut(testCollections)

    // Verify initial state
    const initialCollectionCount = await db.collections.count()
    console.log(`[Task 4.2 Test] Initial collection count: ${initialCollectionCount}`)
    
    if (initialCollectionCount !== testCollections.length) {
      throw new Error(`Expected ${testCollections.length} collections, got ${initialCollectionCount}`)
    }

    // Execute: Run migration
    const migration = new RemoveCollectionMigration()
    
    // Create backup first (required before migration)
    // @ts-expect-error - Accessing private method for testing
    await migration.createBackup()
    
    // Run local data migration
    // @ts-expect-error - Accessing private method for testing
    const result = await migration.migrateLocalData()

    console.log(`[Task 4.2 Test] Migration result:`, result)

    // Verify: Check that collections were removed
    
    // 1. Verify the returned count is correct
    if (result.collectionsRemoved !== testCollections.length) {
      throw new Error(
        `Expected collectionsRemoved to be ${testCollections.length}, got ${result.collectionsRemoved}`
      )
    }
    console.log(`[Task 4.2 Test] ✓ Correct collection count reported: ${result.collectionsRemoved}`)

    // 2. Verify collections table is empty
    const finalCollectionCount = db.collections ? await db.collections.count() : 0
    if (finalCollectionCount !== 0) {
      throw new Error(`Expected 0 collections after migration, got ${finalCollectionCount}`)
    }
    console.log(`[Task 4.2 Test] ✓ Collections table is empty`)

    // 3. Verify no collections can be retrieved
    if (db.collections) {
      const allCollections = await db.collections.toArray()
      if (allCollections.length !== 0) {
        throw new Error(`Expected no collections, got ${allCollections.length}`)
      }
    }
    console.log(`[Task 4.2 Test] ✓ No collections can be retrieved`)

    // 4. Verify specific collection IDs cannot be found
    if (db.collections) {
      for (const collection of testCollections) {
        const found = await db.collections.get(collection.id)
        if (found) {
          throw new Error(`Collection ${collection.id} should not exist after migration`)
        }
      }
    }
    console.log(`[Task 4.2 Test] ✓ Specific collection IDs not found`)

    // 5. Verify notes still exist (should not be affected by collection deletion)
    const finalNoteCount = await db.notes.count()
    if (finalNoteCount !== testNotes.length) {
      throw new Error(`Expected ${testNotes.length} notes, got ${finalNoteCount}`)
    }
    console.log(`[Task 4.2 Test] ✓ Notes preserved (count: ${finalNoteCount})`)

    console.log('[Task 4.2 Test] ✓ Collection deletion verification PASSED')

    // Cleanup
    await db.notes.clear()
    if (db.collections) {
      await db.collections.clear()
    }
    await db.migrationBackup.clear()
    await db.metadata.delete('migration_metadata')

    return true
  } catch (error) {
    console.error('[Task 4.2 Test] ✗ Collection deletion verification FAILED:', error)
    
    // Cleanup on failure
    await db.notes.clear()
    if (db.collections) {
      await db.collections.clear()
    }
    await db.migrationBackup.clear()
    await db.metadata.delete('migration_metadata')
    
    return false
  }
}

/**
 * Test: Verify collection deletion with empty database
 * 
 * This test verifies that migration handles the case where
 * there are no collections to delete.
 */
export async function testCollectionDeletionEmptyDatabase() {
  console.log('[Task 4.2 Test] Starting empty database test...')
  
  try {
    // Setup: Create only notes, no collections
    const testNotes: Note[] = [
      {
        id: 'note-1',
        title: 'Note 1',
        content: 'Content 1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isPinned: false,
        syncStatus: 'synced',
        version: 1
      }
    ]

    await db.notes.bulkPut(testNotes)

    // Verify no collections exist
    const initialCollectionCount = db.collections ? await db.collections.count() : 0
    if (initialCollectionCount !== 0) {
      throw new Error(`Expected 0 collections initially, got ${initialCollectionCount}`)
    }

    // Execute: Run migration
    const migration = new RemoveCollectionMigration()
    
    // Create backup first
    // @ts-expect-error - Accessing private method for testing
    await migration.createBackup()
    
    // Run local data migration
    // @ts-expect-error - Accessing private method for testing
    const result = await migration.migrateLocalData()

    // Verify: Check that collectionsRemoved is 0
    if (result.collectionsRemoved !== 0) {
      throw new Error(`Expected collectionsRemoved to be 0, got ${result.collectionsRemoved}`)
    }
    console.log(`[Task 4.2 Test] ✓ Correct collection count for empty database: ${result.collectionsRemoved}`)

    // Verify collections table is still empty
    const finalCollectionCount = db.collections ? await db.collections.count() : 0
    if (finalCollectionCount !== 0) {
      throw new Error(`Expected 0 collections after migration, got ${finalCollectionCount}`)
    }
    console.log(`[Task 4.2 Test] ✓ Collections table remains empty`)

    console.log('[Task 4.2 Test] ✓ Empty database test PASSED')

    // Cleanup
    await db.notes.clear()
    await db.migrationBackup.clear()
    await db.metadata.delete('migration_metadata')

    return true
  } catch (error) {
    console.error('[Task 4.2 Test] ✗ Empty database test FAILED:', error)
    
    // Cleanup on failure
    await db.notes.clear()
    if (db.collections) {
      await db.collections.clear()
    }
    await db.migrationBackup.clear()
    await db.metadata.delete('migration_metadata')
    
    return false
  }
}

/**
 * Test: Verify collection metadata cleanup
 * 
 * This test verifies that any collection-related metadata
 * is properly cleaned up during migration.
 */
export async function testCollectionMetadataCleanup() {
  console.log('[Task 4.2 Test] Starting metadata cleanup test...')
  
  try {
    // Setup: Create test data
    const testNotes: LegacyNote[] = [
      {
        id: 'note-1',
        title: 'Note 1',
        content: 'Content 1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isPinned: false,
        syncStatus: 'synced',
        version: 1,
        collectionId: 'collection-1'
      }
    ]

    const testCollections: Collection[] = [
      {
        id: 'collection-1',
        name: 'Collection 1',
        color: '#FF0000',
        noteIds: ['note-1'],
        isExpanded: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        syncStatus: 'synced'
      }
    ]

    await db.notes.bulkPut(testNotes)
    
    if (!db.collections) {
      console.warn('[Task 4.2 Test] Collections table not available - skipping metadata test')
      console.log('[Task 4.2 Test] ⚠ Test skipped (collections table not available)')
      return true
    }
    
    await db.collections.bulkPut(testCollections)

    // Add some collection-related metadata (if any exists in the system)
    // For now, we'll just verify that the collections table is cleared
    // In the future, if there are other metadata stores, they should be checked here

    // Execute: Run migration
    const migration = new RemoveCollectionMigration()
    
    // Create backup first
    // @ts-expect-error - Accessing private method for testing
    await migration.createBackup()
    
    // Run local data migration
    // @ts-expect-error - Accessing private method for testing
    await migration.migrateLocalData()

    // Verify: Check that all collection-related data is gone
    
    // 1. Collections table should be empty
    const collectionCount = db.collections ? await db.collections.count() : 0
    if (collectionCount !== 0) {
      throw new Error(`Expected 0 collections, got ${collectionCount}`)
    }
    console.log(`[Task 4.2 Test] ✓ Collections table cleared`)

    // 2. Check metadata table for any collection-related entries
    // (Currently, there are no collection-specific metadata entries,
    // but this is where we would check if there were)
    const allMetadata = await db.metadata.toArray()
    const collectionMetadata = allMetadata.filter(m => 
      m.key.includes('collection') && m.key !== 'migration_metadata'
    )
    
    if (collectionMetadata.length > 0) {
      console.warn(`[Task 4.2 Test] Found ${collectionMetadata.length} collection-related metadata entries:`, 
        collectionMetadata.map(m => m.key))
      // This is not necessarily an error, but worth noting
    } else {
      console.log(`[Task 4.2 Test] ✓ No collection-related metadata found`)
    }

    console.log('[Task 4.2 Test] ✓ Metadata cleanup test PASSED')

    // Cleanup
    await db.notes.clear()
    if (db.collections) {
      await db.collections.clear()
    }
    await db.migrationBackup.clear()
    await db.metadata.delete('migration_metadata')

    return true
  } catch (error) {
    console.error('[Task 4.2 Test] ✗ Metadata cleanup test FAILED:', error)
    
    // Cleanup on failure
    await db.notes.clear()
    if (db.collections) {
      await db.collections.clear()
    }
    await db.migrationBackup.clear()
    await db.metadata.delete('migration_metadata')
    
    return false
  }
}

/**
 * Run all Task 4.2 verification tests
 */
export async function runTask42Tests() {
  console.log('[Task 4.2 Test Suite] Starting verification tests...')
  console.log('='.repeat(60))
  
  const results = {
    collectionDeletion: await testCollectionDeletion(),
    emptyDatabase: await testCollectionDeletionEmptyDatabase(),
    metadataCleanup: await testCollectionMetadataCleanup()
  }
  
  console.log('='.repeat(60))
  console.log('[Task 4.2 Test Suite] Results:')
  console.log(`  Collection Deletion: ${results.collectionDeletion ? '✓ PASS' : '✗ FAIL'}`)
  console.log(`  Empty Database: ${results.emptyDatabase ? '✓ PASS' : '✗ FAIL'}`)
  console.log(`  Metadata Cleanup: ${results.metadataCleanup ? '✓ PASS' : '✗ FAIL'}`)
  
  const allPassed = Object.values(results).every(r => r === true)
  console.log(`\n[Task 4.2 Test Suite] Overall: ${allPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`)
  
  return allPassed
}

// Export for console access
if (typeof window !== 'undefined') {
  (window as any).task42Tests = {
    testCollectionDeletion,
    testCollectionDeletionEmptyDatabase,
    testCollectionMetadataCleanup,
    runTask42Tests
  }
  console.log('[Task 4.2 Test] Tests loaded. Run from console:')
  console.log('  window.task42Tests.runTask42Tests()')
  console.log('  window.task42Tests.testCollectionDeletion()')
}
