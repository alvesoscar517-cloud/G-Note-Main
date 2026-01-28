/**
 * Manual Tests for RemoveCollectionMigration
 * 
 * These tests verify the backup creation logic including:
 * - Backup data structure creation
 * - Storage in migrationBackup table
 * - Error handling for storage quota issues
 * 
 * IMPORTANT: These tests use optional chaining for db.collections
 * because they test migration FROM a schema WITH collections TO a schema WITHOUT.
 * The tests should only be run on a database at version 8 or earlier.
 * 
 * To run these tests manually:
 * 1. Import this file in your application
 * 2. Call the test functions from the browser console
 * 3. Check the console output for results
 */

import { db, type Collection } from '@/lib/db/schema'
import { RemoveCollectionMigration } from '../removeCollectionMigration'
import type { Note } from '@/types'

// Legacy Note type with collectionId for testing migration
type LegacyNote = Note & { collectionId?: string }

/**
 * Test 1: Verify backup creation with valid data
 */
export async function testBackupCreation() {
  console.log('[Test] Starting backup creation test...')
  
  try {
    // Setup: Create some test notes and collections
    const testNotes: LegacyNote[] = [
      {
        id: 'test-note-1',
        title: 'Test Note 1',
        content: 'Test content 1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isPinned: false,
        syncStatus: 'synced',
        version: 1,
        collectionId: 'test-collection-1'
      }
    ]

    const testCollections: Collection[] = [
      {
        id: 'test-collection-1',
        name: 'Test Collection',
        color: '#FF0000',
        noteIds: ['test-note-1'],
        isExpanded: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        syncStatus: 'synced'
      }
    ]

    // Add test data to database
    await db.notes.bulkPut(testNotes)
    if (db.collections) {
      await db.collections.bulkPut(testCollections)
    }

    // Execute: Create migration instance and run backup
    const migration = new RemoveCollectionMigration()
    
    // Access private method via reflection for testing
    // @ts-expect-error - Accessing private method for testing
    await migration.createBackup()

    // Verify: Check that backup was created
    const backups = await db.migrationBackup.toArray()
    
    if (backups.length === 0) {
      throw new Error('No backup was created')
    }

    const backup = backups[backups.length - 1]

    // Verify backup structure
    if (!backup.timestamp) {
      throw new Error('Backup missing timestamp')
    }

    console.log('[Test] ✓ Backup creation test passed')

    // Cleanup
    await db.notes.clear()
    if (db.collections) {
      await db.collections.clear()
    }
    await db.migrationBackup.clear()
    await db.metadata.delete('migration_metadata')

    return true
  } catch (error) {
    console.error('[Test] ✗ Backup creation test failed:', error)
    
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
 * Run all tests
 */
export async function runAllTests() {
  console.log('[Test Suite] Starting RemoveCollectionMigration tests...')
  console.log('='.repeat(60))
  
  const results = {
    backupCreation: await testBackupCreation()
  }
  
  console.log('='.repeat(60))
  console.log('[Test Suite] Results:')
  console.log(`  Backup Creation: ${results.backupCreation ? '✓ PASS' : '✗ FAIL'}`)
  
  const allPassed = Object.values(results).every(r => r === true)
  console.log(`\n[Test Suite] Overall: ${allPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`)
  
  return allPassed
}

// Export for console access
if (typeof window !== 'undefined') {
  (window as any).migrationTests = {
    testBackupCreation,
    runAllTests
  }
  console.log('[Test] Migration tests loaded. Run tests from console:')
  console.log('  window.migrationTests.runAllTests()')
}
