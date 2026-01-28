/**
 * Migration Store
 * 
 * Manages migration state and provides read-only mode during migration.
 * 
 * Requirements: 9.3
 */

import { create } from 'zustand'
import type { MigrationResult } from '@/lib/migration/removeCollectionMigration'

interface MigrationState {
  // Migration status
  isMigrating: boolean
  migrationResult: MigrationResult | null
  
  // Actions
  setMigrating: (isMigrating: boolean) => void
  setMigrationResult: (result: MigrationResult | null) => void
  reset: () => void
  
  // Read-only mode check
  isReadOnly: () => boolean
}

export const useMigrationStore = create<MigrationState>((set, get) => ({
  // Initial state
  isMigrating: false,
  migrationResult: null,
  
  // Actions
  setMigrating: (isMigrating: boolean) => {
    set({ isMigrating })
  },
  
  setMigrationResult: (result: MigrationResult | null) => {
    set({ 
      migrationResult: result,
      isMigrating: false // Migration is complete when result is set
    })
  },
  
  reset: () => {
    set({
      isMigrating: false,
      migrationResult: null
    })
  },
  
  // Read-only mode check
  // Returns true if migration is in progress
  isReadOnly: () => {
    const state = get()
    return state.isMigrating
  }
}))
