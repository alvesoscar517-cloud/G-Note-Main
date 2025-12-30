/**
 * Conflict Resolver
 * Handles version conflicts between local and remote data
 */
import type { Note, Collection } from '@/types'
import type { ConflictInfo, ConflictResolution, TombstoneData } from './types'

// Time threshold for considering timestamps "close" (5 seconds)
const TIMESTAMP_THRESHOLD_MS = 5000

/**
 * Resolve conflict between local and remote note
 * Returns the winning note and conflict info
 */
export function resolveNoteConflict(
  localNote: Note,
  remoteNote: Note
): { winner: Note; conflict: ConflictInfo } {
  const localVersion = localNote.version || 1
  const remoteVersion = remoteNote.version || 1

  let resolution: ConflictResolution
  let winner: Note

  if (localVersion > remoteVersion) {
    // Local has newer version - local wins
    resolution = 'local'
    winner = localNote
  } else if (localVersion < remoteVersion) {
    // Remote has newer version - remote wins
    resolution = 'remote'
    winner = remoteNote
  } else {
    // Same version - use timestamp as tiebreaker
    const timeDiff = Math.abs(localNote.updatedAt - remoteNote.updatedAt)
    
    if (timeDiff < TIMESTAMP_THRESHOLD_MS || localNote.updatedAt >= remoteNote.updatedAt) {
      // Timestamps are close or local is newer - prefer local
      resolution = 'local'
      winner = localNote
    } else {
      // Remote is significantly newer
      resolution = 'remote'
      winner = remoteNote
    }
  }

  return {
    winner,
    conflict: {
      entityId: localNote.id,
      entityType: 'note',
      localVersion,
      remoteVersion,
      localUpdatedAt: localNote.updatedAt,
      remoteUpdatedAt: remoteNote.updatedAt,
      resolution
    }
  }
}

/**
 * Resolve conflict between local and remote collection
 * Merges noteIds from both versions to preserve all associations
 */
export function resolveCollectionConflict(
  localCollection: Collection,
  remoteCollection: Collection
): { winner: Collection; conflict: ConflictInfo } {
  const localVersion = localCollection.version || 1
  const remoteVersion = remoteCollection.version || 1

  let resolution: ConflictResolution
  let winner: Collection

  if (localVersion > remoteVersion) {
    resolution = 'local'
    winner = localCollection
  } else if (localVersion < remoteVersion) {
    resolution = 'remote'
    winner = remoteCollection
  } else {
    const timeDiff = Math.abs(localCollection.updatedAt - remoteCollection.updatedAt)
    
    if (timeDiff < TIMESTAMP_THRESHOLD_MS || localCollection.updatedAt >= remoteCollection.updatedAt) {
      resolution = 'local'
      winner = localCollection
    } else {
      resolution = 'remote'
      winner = remoteCollection
    }
  }

  // Merge noteIds from both versions to preserve all associations
  const mergedNoteIds = mergeNoteIds(localCollection.noteIds, remoteCollection.noteIds)
  winner = { ...winner, noteIds: mergedNoteIds }

  return {
    winner,
    conflict: {
      entityId: localCollection.id,
      entityType: 'collection',
      localVersion,
      remoteVersion,
      localUpdatedAt: localCollection.updatedAt,
      remoteUpdatedAt: remoteCollection.updatedAt,
      resolution
    }
  }
}

/**
 * Merge noteIds from two collections
 * Returns union of both arrays, preserving order from winner
 */
export function mergeNoteIds(localNoteIds: string[], remoteNoteIds: string[]): string[] {
  const merged = new Set<string>(localNoteIds)
  for (const id of remoteNoteIds) {
    merged.add(id)
  }
  return Array.from(merged)
}

/**
 * Check if an entity should be deleted based on tombstone
 * Tombstone wins if deletion happened after the entity was last updated
 */
export function shouldDeleteEntity(
  entityUpdatedAt: number,
  tombstoneDeletedAt: number
): boolean {
  return tombstoneDeletedAt > entityUpdatedAt
}

/**
 * Merge tombstones from local and remote
 * Keeps the most recent deletion time for each ID
 */
export function mergeTombstones(
  localTombstones: TombstoneData[],
  remoteTombstones: TombstoneData[]
): Map<string, number> {
  const merged = new Map<string, number>()

  // Add remote tombstones
  for (const t of remoteTombstones) {
    merged.set(t.id, t.deletedAt)
  }

  // Merge local tombstones (keep most recent)
  for (const t of localTombstones) {
    const existing = merged.get(t.id)
    if (!existing || t.deletedAt > existing) {
      merged.set(t.id, t.deletedAt)
    }
  }

  return merged
}

/**
 * Check if a note is empty (no title and no content)
 */
export function isNoteEmpty(note: Note): boolean {
  return !note.title.trim() && !note.content.trim()
}

/**
 * Filter notes that should be synced
 * Excludes empty notes and notes that should be deleted
 */
export function filterSyncableNotes(
  notes: Note[],
  tombstones: Map<string, number>
): Note[] {
  return notes.filter(note => {
    // Exclude empty notes
    if (isNoteEmpty(note)) return false

    // Exclude notes that should be deleted
    const tombstoneTime = tombstones.get(note.id)
    if (tombstoneTime && shouldDeleteEntity(note.updatedAt, tombstoneTime)) {
      return false
    }

    return true
  })
}

/**
 * Filter collections that should be synced
 */
export function filterSyncableCollections(
  collections: Collection[],
  tombstones: Map<string, number>
): Collection[] {
  return collections.filter(collection => {
    const tombstoneTime = tombstones.get(collection.id)
    if (tombstoneTime && shouldDeleteEntity(collection.updatedAt, tombstoneTime)) {
      return false
    }
    return true
  })
}
