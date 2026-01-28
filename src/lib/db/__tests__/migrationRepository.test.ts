/**
 * Manual Tests for Migration Repository
 * 
 * These tests verify the migration metadata management functions including:
 * - Getting and setting migration metadata
 * - Version tracking
 * - Status management
 * - Backup ID tracking
 * - Migration need detection
 * 
 * To run these tests manually:
 * 1. Import this file in your application
 * 2. Call the test functions from the browser console
 * 3. Check the console output for results
 */

import {
  getMigrationMetadata,
  setMigrationMetadata,
  getMigrationVersion,
  setMigrationVersion,
  getMigrationStatus,
  setMigrationStatus,
  getBackupId,
  setBackupId,
  clearBackupId,
  isMigrationNeeded,
  resetMigrationMetadata,
  getLastMigrationDate
} from '../migrationRepository'
import type { MigrationMetadata } from '../../migration/removeCollectionMigration'

/**
 * Test 1: Basic metadata get/set operations
 */
export async function testBasicMetadataOperations() {
  console.log('[Test] Starting basic metadata operations test...')
  
  try {
    // Reset before test
    await resetMigrationMetadata()

    // Test 1.1: Get undefined when no metadata exists
    const emptyMetadata = await getMigrationMetadata()
    if (emptyMetadata !== undefined) {
      throw new Error('Expected undefined, got metadata')
    }

    // Test 1.2: Set and retrieve metadata
    const testMetadata: MigrationMetadata = {
      migrationVersion: 9,
      lastMigrationDate: Date.now(),
      migrationStatus: 'completed'
    }

    await setMigrationMetadata(testMetadata)
    const retrieved = await getMigrationMetadata()

    if (!retrieved) {
      throw new Error('Metadata not retrieved')
    }

    if (retrieved.migrationVersion !== testMetadata.migrationVersion) {
      throw new Error(`Version mismatch: expected ${testMetadata.migrationVersion}, got ${retrieved.migrationVersion}`)
    }

    if (retrieved.migrationStatus !== testMetadata.migrationStatus) {
      throw new Error(`Status mismatch: expected ${testMetadata.migrationStatus}, got ${retrieved.migrationStatus}`)
    }

    // Test 1.3: Update existing metadata
    const updatedMetadata: MigrationMetadata = {
      ...testMetadata,
      migrationStatus: 'failed'
    }

    await setMigrationMetadata(updatedMetadata)
    const retrievedUpdated = await getMigrationMetadata()

    if (retrievedUpdated?.migrationStatus !== 'failed') {
      throw new Error('Metadata not updated')
    }

    console.log('[Test] ✓ Basic metadata operations test passed')

    // Cleanup
    await resetMigrationMetadata()
    return true
  } catch (error) {
    console.error('[Test] ✗ Basic metadata operations test failed:', error)
    await resetMigrationMetadata()
    return false
  }
}

/**
 * Test 2: Migration version operations
 */
export async function testMigrationVersion() {
  console.log('[Test] Starting migration version test...')
  
  try {
    await resetMigrationMetadata()

    // Test 2.1: Default version is 0
    const defaultVersion = await getMigrationVersion()
    if (defaultVersion !== 0) {
      throw new Error(`Expected version 0, got ${defaultVersion}`)
    }

    // Test 2.2: Set and get version
    await setMigrationVersion(9)
    const version = await getMigrationVersion()
    if (version !== 9) {
      throw new Error(`Expected version 9, got ${version}`)
    }

    // Test 2.3: Update version
    await setMigrationVersion(10)
    const updatedVersion = await getMigrationVersion()
    if (updatedVersion !== 10) {
      throw new Error(`Expected version 10, got ${updatedVersion}`)
    }

    // Test 2.4: Preserve other metadata when setting version
    await setMigrationMetadata({
      migrationVersion: 8,
      lastMigrationDate: Date.now(),
      migrationStatus: 'completed',
      backupId: 12345
    })

    await setMigrationVersion(9)
    const metadata = await getMigrationMetadata()

    if (metadata?.migrationVersion !== 9) {
      throw new Error('Version not updated')
    }

    if (metadata?.backupId !== 12345) {
      throw new Error('Backup ID not preserved')
    }

    console.log('[Test] ✓ Migration version test passed')

    await resetMigrationMetadata()
    return true
  } catch (error) {
    console.error('[Test] ✗ Migration version test failed:', error)
    await resetMigrationMetadata()
    return false
  }
}

/**
 * Test 3: Migration status operations
 */
export async function testMigrationStatus() {
  console.log('[Test] Starting migration status test...')
  
  try {
    await resetMigrationMetadata()

    // Test 3.1: Default status is 'pending'
    const defaultStatus = await getMigrationStatus()
    if (defaultStatus !== 'pending') {
      throw new Error(`Expected status 'pending', got '${defaultStatus}'`)
    }

    // Test 3.2: Set and get status
    await setMigrationStatus('in_progress')
    const status = await getMigrationStatus()
    if (status !== 'in_progress') {
      throw new Error(`Expected status 'in_progress', got '${status}'`)
    }

    // Test 3.3: Update status
    await setMigrationStatus('completed')
    const updatedStatus = await getMigrationStatus()
    if (updatedStatus !== 'completed') {
      throw new Error(`Expected status 'completed', got '${updatedStatus}'`)
    }

    // Test 3.4: Test all status values
    const statuses: MigrationMetadata['migrationStatus'][] = [
      'pending',
      'in_progress',
      'completed',
      'failed'
    ]

    for (const testStatus of statuses) {
      await setMigrationStatus(testStatus)
      const retrieved = await getMigrationStatus()
      if (retrieved !== testStatus) {
        throw new Error(`Status mismatch: expected '${testStatus}', got '${retrieved}'`)
      }
    }

    console.log('[Test] ✓ Migration status test passed')

    await resetMigrationMetadata()
    return true
  } catch (error) {
    console.error('[Test] ✗ Migration status test failed:', error)
    await resetMigrationMetadata()
    return false
  }
}

/**
 * Test 4: Backup ID operations
 */
export async function testBackupId() {
  console.log('[Test] Starting backup ID test...')
  
  try {
    await resetMigrationMetadata()

    // Test 4.1: Default backup ID is undefined
    const defaultBackupId = await getBackupId()
    if (defaultBackupId !== undefined) {
      throw new Error(`Expected undefined, got ${defaultBackupId}`)
    }

    // Test 4.2: Set and get backup ID
    const testBackupId = 1234567890
    await setBackupId(testBackupId)
    const backupId = await getBackupId()
    if (backupId !== testBackupId) {
      throw new Error(`Expected backup ID ${testBackupId}, got ${backupId}`)
    }

    // Test 4.3: Update backup ID
    await setBackupId(9876543210)
    const updatedBackupId = await getBackupId()
    if (updatedBackupId !== 9876543210) {
      throw new Error(`Expected backup ID 9876543210, got ${updatedBackupId}`)
    }

    // Test 4.4: Clear backup ID
    await clearBackupId()
    const clearedBackupId = await getBackupId()
    if (clearedBackupId !== undefined) {
      throw new Error(`Expected undefined after clear, got ${clearedBackupId}`)
    }

    // Test 4.5: Preserve other metadata when clearing backup ID
    await setMigrationMetadata({
      migrationVersion: 9,
      lastMigrationDate: Date.now(),
      migrationStatus: 'completed',
      backupId: 12345
    })

    await clearBackupId()
    const metadata = await getMigrationMetadata()

    if (metadata?.backupId !== undefined) {
      throw new Error('Backup ID not cleared')
    }

    if (metadata?.migrationVersion !== 9) {
      throw new Error('Version not preserved')
    }

    console.log('[Test] ✓ Backup ID test passed')

    await resetMigrationMetadata()
    return true
  } catch (error) {
    console.error('[Test] ✗ Backup ID test failed:', error)
    await resetMigrationMetadata()
    return false
  }
}

/**
 * Test 5: Migration need detection
 */
export async function testMigrationNeeded() {
  console.log('[Test] Starting migration need detection test...')
  
  try {
    await resetMigrationMetadata()

    // Test 5.1: No metadata means migration needed
    const noMetadata = await isMigrationNeeded(9)
    if (!noMetadata) {
      throw new Error('Should need migration when no metadata exists')
    }

    // Test 5.2: Completed at target version means no migration needed
    await setMigrationMetadata({
      migrationVersion: 9,
      lastMigrationDate: Date.now(),
      migrationStatus: 'completed'
    })

    const completedAtTarget = await isMigrationNeeded(9)
    if (completedAtTarget) {
      throw new Error('Should not need migration when completed at target version')
    }

    // Test 5.3: Completed above target version means no migration needed
    await setMigrationMetadata({
      migrationVersion: 10,
      lastMigrationDate: Date.now(),
      migrationStatus: 'completed'
    })

    const completedAboveTarget = await isMigrationNeeded(9)
    if (completedAboveTarget) {
      throw new Error('Should not need migration when completed above target version')
    }

    // Test 5.4: Failed status means migration needed
    await setMigrationMetadata({
      migrationVersion: 9,
      lastMigrationDate: Date.now(),
      migrationStatus: 'failed'
    })

    const failed = await isMigrationNeeded(9)
    if (!failed) {
      throw new Error('Should need migration when status is failed')
    }

    // Test 5.5: In progress status means migration needed (stuck)
    await setMigrationMetadata({
      migrationVersion: 9,
      lastMigrationDate: Date.now(),
      migrationStatus: 'in_progress'
    })

    const inProgress = await isMigrationNeeded(9)
    if (!inProgress) {
      throw new Error('Should need migration when status is in_progress (stuck)')
    }

    // Test 5.6: Version below target means migration needed
    await setMigrationMetadata({
      migrationVersion: 8,
      lastMigrationDate: Date.now(),
      migrationStatus: 'completed'
    })

    const belowTarget = await isMigrationNeeded(9)
    if (!belowTarget) {
      throw new Error('Should need migration when version is below target')
    }

    console.log('[Test] ✓ Migration need detection test passed')

    await resetMigrationMetadata()
    return true
  } catch (error) {
    console.error('[Test] ✗ Migration need detection test failed:', error)
    await resetMigrationMetadata()
    return false
  }
}

/**
 * Test 6: Last migration date
 */
export async function testLastMigrationDate() {
  console.log('[Test] Starting last migration date test...')
  
  try {
    await resetMigrationMetadata()

    // Test 6.1: Default is undefined
    const defaultDate = await getLastMigrationDate()
    if (defaultDate !== undefined) {
      throw new Error(`Expected undefined, got ${defaultDate}`)
    }

    // Test 6.2: Set and get date
    const testDate = Date.now()
    await setMigrationMetadata({
      migrationVersion: 9,
      lastMigrationDate: testDate,
      migrationStatus: 'completed'
    })

    const date = await getLastMigrationDate()
    if (date !== testDate) {
      throw new Error(`Expected date ${testDate}, got ${date}`)
    }

    console.log('[Test] ✓ Last migration date test passed')

    await resetMigrationMetadata()
    return true
  } catch (error) {
    console.error('[Test] ✗ Last migration date test failed:', error)
    await resetMigrationMetadata()
    return false
  }
}

/**
 * Test 7: Reset metadata
 */
export async function testResetMetadata() {
  console.log('[Test] Starting reset metadata test...')
  
  try {
    // Set some metadata
    await setMigrationMetadata({
      migrationVersion: 9,
      lastMigrationDate: Date.now(),
      migrationStatus: 'completed',
      backupId: 12345
    })

    // Reset
    await resetMigrationMetadata()

    // Verify cleared
    const metadata = await getMigrationMetadata()
    if (metadata !== undefined) {
      throw new Error('Metadata not cleared after reset')
    }

    // Verify can set new metadata after reset
    await setMigrationMetadata({
      migrationVersion: 10,
      lastMigrationDate: Date.now(),
      migrationStatus: 'pending'
    })

    const newMetadata = await getMigrationMetadata()
    if (!newMetadata || newMetadata.migrationVersion !== 10) {
      throw new Error('Cannot set new metadata after reset')
    }

    console.log('[Test] ✓ Reset metadata test passed')

    await resetMigrationMetadata()
    return true
  } catch (error) {
    console.error('[Test] ✗ Reset metadata test failed:', error)
    await resetMigrationMetadata()
    return false
  }
}

/**
 * Run all tests
 */
export async function runAllTests() {
  console.log('[Test Suite] Starting Migration Repository tests...')
  console.log('='.repeat(60))
  
  const results = {
    basicOperations: await testBasicMetadataOperations(),
    version: await testMigrationVersion(),
    status: await testMigrationStatus(),
    backupId: await testBackupId(),
    migrationNeeded: await testMigrationNeeded(),
    lastDate: await testLastMigrationDate(),
    reset: await testResetMetadata()
  }
  
  console.log('='.repeat(60))
  console.log('[Test Suite] Results:')
  console.log(`  Basic Operations: ${results.basicOperations ? '✓ PASS' : '✗ FAIL'}`)
  console.log(`  Version: ${results.version ? '✓ PASS' : '✗ FAIL'}`)
  console.log(`  Status: ${results.status ? '✓ PASS' : '✗ FAIL'}`)
  console.log(`  Backup ID: ${results.backupId ? '✓ PASS' : '✗ FAIL'}`)
  console.log(`  Migration Needed: ${results.migrationNeeded ? '✓ PASS' : '✗ FAIL'}`)
  console.log(`  Last Date: ${results.lastDate ? '✓ PASS' : '✗ FAIL'}`)
  console.log(`  Reset: ${results.reset ? '✓ PASS' : '✗ FAIL'}`)
  
  const allPassed = Object.values(results).every(r => r === true)
  console.log(`\n[Test Suite] Overall: ${allPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`)
  
  return allPassed
}

// Export for console access
if (typeof window !== 'undefined') {
  (window as any).migrationRepositoryTests = {
    testBasicMetadataOperations,
    testMigrationVersion,
    testMigrationStatus,
    testBackupId,
    testMigrationNeeded,
    testLastMigrationDate,
    testResetMetadata,
    runAllTests
  }
  console.log('[Test] Migration Repository tests loaded. Run tests from console:')
  console.log('  window.migrationRepositoryTests.runAllTests()')
  console.log('  window.migrationRepositoryTests.testMigrationVersion()')
  console.log('  window.migrationRepositoryTests.testMigrationStatus()')
}

