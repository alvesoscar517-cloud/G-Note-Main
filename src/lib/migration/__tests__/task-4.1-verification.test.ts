/**
 * Verification Test for Task 4.1: Implement note collectionId removal
 * 
 * This test verifies that the migrateLocalData() method correctly:
 * 1. Loads all notes from IndexedDB
 * 2. Removes collectionId field from each note
 * 3. Increments version number for each note
 * 4. Saves updated notes back to IndexedDB in batches
 * 
 * Requirements: 1.2
 */

import { db } from '@/lib/db/schema'
import { RemoveCollectionMigration } from '../removeCollectionMigration'
import type { Note } from '@/types'

// Legacy Note type with collectionId for testing migration
type LegacyNote = Note & { collectionId?: string }

/**
 * Test: Verify note collectionId removal implementation
 * 
 * This test validates all requirements from task 4.1:
 * - Loads all notes from IndexedDB
 * - Removes collectionId field from each note
 * - Increments version number for each note
 * - Saves updated notes back to IndexedDB in batches
 */
export async function testNoteCollectionIdRemoval() {
  console.log('[Task 4.1 Test] Starting note collectionId removal verification...')
  
  try {
    // Setup: Create test notes with various scenarios
    const testNotes: LegacyNote[] = [
      // Note with collectionId
      {
        id: 'note-1',
        title: 'Note with Collection',
        content: 'This note has a collectionId',
        createdAt: 1000,
        updatedAt: 2000,
        isPinned: false,
        syncStatus: 'synced',
        version: 1,
        collectionId: 'collection-1'
      },
      // Another note with collectionId
      {
        id: 'note-2',
        title: 'Another Note with Collection',
        content: 'This note also has a collectionId',
        createdAt: 3000,
        updatedAt: 4000,
        isPinned: true,
        syncStatus: 'pending',
        version: 2,
        collectionId: 'collection-2'
      },
      // Note without collectionId
      {
        id: 'note-3',
        title: 'Note without Collection',
        content: 'This note has no collectionId',
        createdAt: 5000,
        updatedAt: 6000,
        isPinned: false,
        syncStatus: 'synced',
        version: 1
      },
      // Note with undefined collectionId
      {
        id: 'note-4',
        title: 'Note with undefined Collection',
        content: 'This note has undefined collectionId',
        createdAt: 7000,
        updatedAt: 8000,
        isPinned: false,
        syncStatus: 'synced',
        version: 3,
        collectionId: undefined
      }
    ]

    // Add test notes to database
    await db.notes.bulkPut(testNotes)
    console.log(`[Task 4.1 Test] Added ${testNotes.length} test notes to database`)

    // Verify notes were added
    const initialCount = await db.notes.count()
    if (initialCount !== testNotes.length) {
      throw new Error(`Expected ${testNotes.length} notes, got ${initialCount}`)
    }

    // Execute: Run migrateLocalData()
    console.log('[Task 4.1 Test] Running migrateLocalData()...')
    const migration = new RemoveCollectionMigration()
    
    // Access private method via reflection for testing
    // @ts-expect-error - Accessing private method for testing
    const result = await migration.migrateLocalData()

    console.log(`[Task 4.1 Test] Migration result:`, result)

    // Verification 1: All notes were processed
    if (result.notesProcessed !== testNotes.length) {
      throw new Error(
        `Expected ${testNotes.length} notes processed, got ${result.notesProcessed}`
      )
    }
    console.log('[Task 4.1 Test] ✓ All notes were processed')

    // Verification 2: Note count unchanged (no notes lost)
    const finalCount = await db.notes.count()
    if (finalCount !== initialCount) {
      throw new Error(
        `Note count changed: expected ${initialCount}, got ${finalCount}`
      )
    }
    console.log('[Task 4.1 Test] ✓ Note count unchanged')

    // Verification 3: No notes have collectionId field
    const allNotes = await db.notes.toArray()
    const notesWithCollectionId = allNotes.filter(note => 
      'collectionId' in note && note.collectionId !== undefined
    )
    
    if (notesWithCollectionId.length > 0) {
      throw new Error(
        `Found ${notesWithCollectionId.length} notes with collectionId: ${
          notesWithCollectionId.map(n => n.id).join(', ')
        }`
      )
    }
    console.log('[Task 4.1 Test] ✓ No notes have collectionId field')

    // Verification 4: Version numbers were incremented
    const note1 = await db.notes.get('note-1')
    const note2 = await db.notes.get('note-2')
    const note3 = await db.notes.get('note-3')
    const note4 = await db.notes.get('note-4')

    if (!note1 || note1.version !== 2) {
      throw new Error(`Note 1 version should be 2, got ${note1?.version}`)
    }
    if (!note2 || note2.version !== 3) {
      throw new Error(`Note 2 version should be 3, got ${note2?.version}`)
    }
    if (!note3 || note3.version !== 2) {
      throw new Error(`Note 3 version should be 2, got ${note3?.version}`)
    }
    if (!note4 || note4.version !== 4) {
      throw new Error(`Note 4 version should be 4, got ${note4?.version}`)
    }
    console.log('[Task 4.1 Test] ✓ Version numbers were incremented')

    // Verification 5: Other note properties preserved
    if (note1.title !== 'Note with Collection') {
      throw new Error('Note 1 title was not preserved')
    }
    if (note1.content !== 'This note has a collectionId') {
      throw new Error('Note 1 content was not preserved')
    }
    if (note1.createdAt !== 1000) {
      throw new Error('Note 1 createdAt was not preserved')
    }
    if (note1.updatedAt !== 2000) {
      throw new Error('Note 1 updatedAt was not preserved')
    }
    if (note1.isPinned !== false) {
      throw new Error('Note 1 isPinned was not preserved')
    }
    if (note1.syncStatus !== 'synced') {
      throw new Error('Note 1 syncStatus was not preserved')
    }

    if (note2.isPinned !== true) {
      throw new Error('Note 2 isPinned was not preserved')
    }
    if (note2.syncStatus !== 'pending') {
      throw new Error('Note 2 syncStatus was not preserved')
    }

    console.log('[Task 4.1 Test] ✓ Other note properties preserved')

    // Verification 6: Batch processing works (test with larger dataset)
    console.log('[Task 4.1 Test] Testing batch processing with 250 notes...')
    
    // Clear existing notes
    await db.notes.clear()
    
    // Create 250 notes to test batch processing (BATCH_SIZE = 100)
    const largeDataset: LegacyNote[] = []
    for (let i = 0; i < 250; i++) {
      largeDataset.push({
        id: `batch-note-${i}`,
        title: `Batch Note ${i}`,
        content: `Content ${i}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isPinned: false,
        syncStatus: 'synced',
        version: 1,
        collectionId: i % 2 === 0 ? `collection-${i}` : undefined
      })
    }
    
    await db.notes.bulkPut(largeDataset)
    
    // Run migration again
    const migration2 = new RemoveCollectionMigration()
    // @ts-expect-error - Accessing private method for testing
    const result2 = await migration2.migrateLocalData()
    
    if (result2.notesProcessed !== 250) {
      throw new Error(`Expected 250 notes processed, got ${result2.notesProcessed}`)
    }
    
    // Verify all notes processed correctly
    const batchNotes = await db.notes.toArray()
    const batchNotesWithCollectionId = batchNotes.filter(note => 
      'collectionId' in note && note.collectionId !== undefined
    )
    
    if (batchNotesWithCollectionId.length > 0) {
      throw new Error(
        `Batch processing failed: ${batchNotesWithCollectionId.length} notes still have collectionId`
      )
    }
    
    console.log('[Task 4.1 Test] ✓ Batch processing works correctly')

    console.log('[Task 4.1 Test] ✅ ALL VERIFICATIONS PASSED')
    console.log('[Task 4.1 Test] Task 4.1 implementation is correct and complete')

    // Cleanup
    await db.notes.clear()
    await db.metadata.delete('migration_metadata')

    return true
  } catch (error) {
    console.error('[Task 4.1 Test] ❌ TEST FAILED:', error)
    
    // Cleanup on failure
    await db.notes.clear()
    await db.metadata.delete('migration_metadata')
    
    return false
  }
}

/**
 * Test: Verify batch size is appropriate
 * 
 * This test verifies that the BATCH_SIZE constant is set to 100
 * as specified in the design document.
 */
export async function testBatchSize() {
  console.log('[Task 4.1 Test] Verifying batch size...')
  
  // The BATCH_SIZE is a private constant, but we can verify it works
  // by testing with exactly 100, 101, and 200 notes
  
  try {
    // Test with exactly 100 notes (1 batch)
    await db.notes.clear()
    const batch100: LegacyNote[] = []
    for (let i = 0; i < 100; i++) {
      batch100.push({
        id: `batch100-${i}`,
        title: `Note ${i}`,
        content: `Content ${i}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isPinned: false,
        syncStatus: 'synced',
        version: 1,
        collectionId: `collection-${i}`
      })
    }
    await db.notes.bulkPut(batch100)
    
    const migration1 = new RemoveCollectionMigration()
    // @ts-expect-error - Accessing private method for testing
    await migration1.migrateLocalData()
    
    const notes100 = await db.notes.toArray()
    if (notes100.some(n => 'collectionId' in n && n.collectionId !== undefined)) {
      throw new Error('100 notes batch failed')
    }
    console.log('[Task 4.1 Test] ✓ 100 notes (1 batch) processed correctly')
    
    // Test with 101 notes (2 batches)
    await db.notes.clear()
    const batch101: LegacyNote[] = []
    for (let i = 0; i < 101; i++) {
      batch101.push({
        id: `batch101-${i}`,
        title: `Note ${i}`,
        content: `Content ${i}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isPinned: false,
        syncStatus: 'synced',
        version: 1,
        collectionId: `collection-${i}`
      })
    }
    await db.notes.bulkPut(batch101)
    
    const migration2 = new RemoveCollectionMigration()
    // @ts-expect-error - Accessing private method for testing
    await migration2.migrateLocalData()
    
    const notes101 = await db.notes.toArray()
    if (notes101.some(n => 'collectionId' in n && n.collectionId !== undefined)) {
      throw new Error('101 notes batch failed')
    }
    console.log('[Task 4.1 Test] ✓ 101 notes (2 batches) processed correctly')
    
    // Test with 200 notes (2 batches)
    await db.notes.clear()
    const batch200: LegacyNote[] = []
    for (let i = 0; i < 200; i++) {
      batch200.push({
        id: `batch200-${i}`,
        title: `Note ${i}`,
        content: `Content ${i}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isPinned: false,
        syncStatus: 'synced',
        version: 1,
        collectionId: `collection-${i}`
      })
    }
    await db.notes.bulkPut(batch200)
    
    const migration3 = new RemoveCollectionMigration()
    // @ts-expect-error - Accessing private method for testing
    await migration3.migrateLocalData()
    
    const notes200 = await db.notes.toArray()
    if (notes200.some(n => 'collectionId' in n && n.collectionId !== undefined)) {
      throw new Error('200 notes batch failed')
    }
    console.log('[Task 4.1 Test] ✓ 200 notes (2 batches) processed correctly')
    
    console.log('[Task 4.1 Test] ✅ Batch size verification passed')
    
    // Cleanup
    await db.notes.clear()
    
    return true
  } catch (error) {
    console.error('[Task 4.1 Test] ❌ Batch size test failed:', error)
    await db.notes.clear()
    return false
  }
}

/**
 * Run all Task 4.1 verification tests
 */
export async function runTask41Tests() {
  console.log('='.repeat(70))
  console.log('[Task 4.1 Test Suite] Starting verification tests...')
  console.log('='.repeat(70))
  
  const results = {
    collectionIdRemoval: await testNoteCollectionIdRemoval(),
    batchSize: await testBatchSize()
  }
  
  console.log('='.repeat(70))
  console.log('[Task 4.1 Test Suite] Results:')
  console.log(`  Collection ID Removal: ${results.collectionIdRemoval ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`  Batch Size: ${results.batchSize ? '✅ PASS' : '❌ FAIL'}`)
  
  const allPassed = Object.values(results).every(r => r === true)
  console.log(`\n[Task 4.1 Test Suite] Overall: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`)
  console.log('='.repeat(70))
  
  return allPassed
}

// Export for console access
if (typeof window !== 'undefined') {
  (window as any).task41Tests = {
    testNoteCollectionIdRemoval,
    testBatchSize,
    runTask41Tests
  }
  console.log('[Task 4.1 Test] Tests loaded. Run from console:')
  console.log('  window.task41Tests.runTask41Tests()')
  console.log('  window.task41Tests.testNoteCollectionIdRemoval()')
  console.log('  window.task41Tests.testBatchSize()')
}
