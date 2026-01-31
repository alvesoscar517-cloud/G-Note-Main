import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Note } from '@/types'
import { generateId } from '@/lib/utils'
import { shareService, type SharedNote } from '@/lib/shareService'
import { searchNotes, type SearchResult } from '@/lib/search'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'

// Direct imports from new db layer
import {
  saveNotes,
  getNotesByUserId,
  assignUserIdToOrphanedNotes,
  deleteNote as deleteNoteFromDb
} from '@/lib/db/noteRepository'
import {
  addToSyncQueue,
  saveNoteWithQueue
} from '@/lib/db/syncQueueRepository'
import {
  addTombstone,
  getAllTombstones
} from '@/lib/db/tombstoneRepository'
import { isIndexedDBAvailable, safeDbWrite } from '@/lib/db/utils'

// Direct imports from new sync layer
import {
  syncWithDrive as engineSyncWithDrive,
  checkHasData as engineCheckHasData,
  deleteNoteDriveFile,
  setSyncAccessToken,
  getRemoteTombstones
} from '@/lib/sync/syncEngine'

// Import SimpleSyncManager
import { syncManager } from '@/lib/sync/simpleSyncManager'

interface NotesState {
  notes: Note[]
  sharedNotes: SharedNote[]
  deletedNoteIds: string[]
  searchQuery: string
  selectedNoteId: string | null
  isModalOpen: boolean
  isSyncing: boolean
  isInitialSync: boolean // First sync after login - show skeleton
  isNewUser: boolean // New user - skip skeleton, show welcome
  isCheckingDriveData: boolean // Checking if Drive has data
  driveHasData: boolean | null // null = unknown, true/false = checked
  lastSyncTime: number | null
  syncError: string | null
  isOfflineReady: boolean

  // Note actions
  addNote: () => Note
  updateNote: (id: string, updates: Partial<Note>) => void
  deleteNote: (id: string) => void
  duplicateNote: (id: string) => Note | undefined
  togglePin: (id: string) => void
  setSearchQuery: (query: string) => void
  setSelectedNote: (id: string | null) => void
  setModalOpen: (open: boolean) => void

  // Sync actions
  syncWithDrive: (accessToken: string) => Promise<void>
  checkDriveHasData: (accessToken: string) => Promise<boolean>
  loadSharedNotes: () => Promise<void>
  acceptSharedNote: (shareId: string) => Promise<void>
  declineSharedNote: (shareId: string) => Promise<void>
  markAllSynced: () => void
  initOfflineStorage: () => Promise<void>
  saveToOfflineStorage: () => Promise<void>
  resetForNewUser: () => void
  setIsNewUser: (isNew: boolean) => void

  // Trash actions
  moveToTrash: (id: string) => void
  restoreFromTrash: (id: string) => void
  permanentlyDelete: (id: string) => void
  emptyTrash: () => void
  restoreMultiple: (ids: string[]) => void
  permanentlyDeleteMultiple: (ids: string[]) => void
  getTrashNotes: () => Note[]

  // Getters
  getFilteredNotes: () => Note[]
  getSearchResults: () => SearchResult[]
  getSelectedNote: () => Note | undefined
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set, get) => ({
      notes: [],
      sharedNotes: [],
      deletedNoteIds: [],
      searchQuery: '',
      selectedNoteId: null,
      isModalOpen: false,
      isSyncing: false,
      isInitialSync: true, // Start as true, set to false after first sync
      isNewUser: false, // New user flag - skip skeleton
      isCheckingDriveData: false,
      driveHasData: null, // null = not checked yet
      lastSyncTime: null,
      syncError: null,
      isOfflineReady: false,

      // Set new user flag
      setIsNewUser: (isNew: boolean) => set({ isNewUser: isNew }),

      // Reset store state for new user (called when user changes)
      resetForNewUser: () => {
        // Clear persisted state in localStorage
        try {
          localStorage.removeItem('notes-storage')
        } catch (e) {
          console.error('[NotesStore] Failed to clear localStorage:', e)
        }

        set({
          notes: [],
          sharedNotes: [],
          deletedNoteIds: [],
          searchQuery: '',
          selectedNoteId: null,
          isModalOpen: false,
          isSyncing: false,
          isInitialSync: true,
          isNewUser: false,
          isCheckingDriveData: false,
          driveHasData: null,
          lastSyncTime: null,
          syncError: null,
          isOfflineReady: false
        })
        console.log('[NotesStore] Store reset for new user')
      },

      // Initialize offline storage - IndexedDB is source of truth
      initOfflineStorage: async () => {
        try {
          if (!isIndexedDBAvailable()) {
            console.log('[NotesStore] IndexedDB not available')
            set({ isOfflineReady: true })
            return
          }

          const user = useAuthStore.getState().user

          let offlineNotes: Note[] = []

          if (user?.id) {
            // Migration: Assign current user ID to any notes that don't have one
            // This handles the first run after update, and prevents data loss
            await assignUserIdToOrphanedNotes(user.id)

            // Load only this user's notes
            offlineNotes = await getNotesByUserId(user.id)
            console.log(`[NotesStore] Loaded ${offlineNotes.length} notes for user ${user.id}`)
          } else {
            // If no user is logged in, we do NOT load notes from IndexedDB
            // This prevents data leakage between users on shared devices
            console.log('[NotesStore] No user logged in, skipping IndexedDB load')
            offlineNotes = []
          }

          // Simply load from IndexedDB - no merge needed since logout clears everything
          set({
            notes: offlineNotes,
            isOfflineReady: true
          })

          console.log(`[NotesStore] Loaded ${offlineNotes.length} notes from IndexedDB`)

          // Initialize SimpleSyncManager with callbacks
          syncManager.initialize(
            // Sync callback
            async () => {
              const authStore = useAuthStore.getState()
              if (authStore.user?.accessToken) {
                await get().syncWithDrive(authStore.user.accessToken)
              }
            },
            // Save callback
            async (note: Note) => {
              await safeDbWrite(
                () => saveNoteWithQueue(note, {
                  type: 'update',
                  entityType: 'note',
                  entityId: note.id,
                  data: note
                }),
                () => console.error('[NotesStore] Storage quota exceeded while saving note')
              )
            },
            // Has pending changes callback (for periodic sync optimization)
            () => {
              const state = get()
              return state.notes.some(n => n.syncStatus === 'pending')
            }
          )

          // Start periodic sync
          syncManager.startPeriodicSync()
        } catch (error) {
          console.error('[NotesStore] Failed to init offline storage:', error)
          set({ isOfflineReady: true })
        }
      },

      saveToOfflineStorage: async () => {
        try {
          if (!isIndexedDBAvailable()) return
          const { notes } = get()
          await saveNotes(notes)
        } catch (error) {
          console.error('[NotesStore] Failed to save to offline storage:', error)
        }
      },

      addNote: () => {
        const newNote: Note = {
          id: generateId(),
          title: '',
          content: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isPinned: false,
          syncStatus: 'pending',
          version: 1,
          userId: useAuthStore.getState().user?.id
        }

        set((state) => ({
          notes: [newNote, ...state.notes],
          selectedNoteId: newNote.id,
          isModalOpen: true
        }))

        // Save to IndexedDB atomically with queue
        saveNoteWithQueue(newNote, {
          type: 'create',
          entityType: 'note',
          entityId: newNote.id,
          data: newNote
        }).catch(console.error)

        return newNote
      },

      updateNote: (id, updates) => {
        let updatedNote: Note | undefined

        set((state) => {
          const newNotes = state.notes.map((note) => {
            if (note.id === id) {
              updatedNote = {
                ...note,
                ...updates,
                updatedAt: Date.now(),
                version: (note.version || 1) + 1,
                syncStatus: 'pending' as const
              }
              return updatedNote
            }
            return note
          })
          return { notes: newNotes }
        })

        // Use SimpleSyncManager for debounced save and sync scheduling
        if (updatedNote) {
          syncManager.addPendingNote(updatedNote)
        }
      },

      deleteNote: (id) => {
        get().moveToTrash(id)
      },

      moveToTrash: (id) => {
        const now = Date.now()
        let trashedNote: Note | undefined

        set((state) => {
          const note = state.notes.find(n => n.id === id)
          if (!note) return state

          trashedNote = {
            ...note,
            isDeleted: true,
            deletedAt: now,
            updatedAt: now,
            version: (note.version || 1) + 1,
            syncStatus: 'pending' as const
          }

          return {
            notes: state.notes.map(n => n.id === id ? trashedNote! : n),
            selectedNoteId: state.selectedNoteId === id ? null : state.selectedNoteId,
            isModalOpen: state.selectedNoteId === id ? false : state.isModalOpen
          }
        })

        if (trashedNote) {
          saveNoteWithQueue(trashedNote, {
            type: 'update',
            entityType: 'note',
            entityId: id,
            data: trashedNote
          }).catch(console.error)

          // Trigger sync schedule (event-driven)
          syncManager.scheduleSync()
        }
      },

      restoreFromTrash: (id) => {
        let restoredNote: Note | undefined

        set((state) => ({
          notes: state.notes.map(n => {
            if (n.id === id) {
              restoredNote = {
                ...n,
                isDeleted: false,
                deletedAt: undefined,
                updatedAt: Date.now(),
                version: (n.version || 1) + 1,
                syncStatus: 'pending' as const
              }
              return restoredNote
            }
            return n
          })
        }))

        if (restoredNote) {
          saveNoteWithQueue(restoredNote, {
            type: 'update',
            entityType: 'note',
            entityId: id,
            data: restoredNote
          }).catch(console.error)

          // Trigger sync schedule (event-driven)
          syncManager.scheduleSync()
        }
      },

      permanentlyDelete: (id) => {
        const { notes } = get()
        const note = notes.find(n => n.id === id)
        const isOnline = useAppStore.getState().isOnline

        if (note?.driveFileId) {
          if (isOnline) {
            deleteNoteDriveFile(id).catch(console.error)
          } else {
            addToSyncQueue({ type: 'delete', entityType: 'note', entityId: id }).catch(console.error)
          }
        }

        // Track deletion for sync and delete from IndexedDB
        addTombstone(id, 'note').catch(console.error)
        deleteNoteFromDb(id).catch(console.error)

        set((state) => ({
          notes: state.notes.filter(n => n.id !== id),
          deletedNoteIds: [...state.deletedNoteIds, id]
        }))
      },

      emptyTrash: () => {
        const { notes } = get()
        const trashNotes = notes.filter(n => n.isDeleted)
        const isOnline = useAppStore.getState().isOnline

        trashNotes.forEach(note => {
          if (note.driveFileId) {
            if (isOnline) {
              deleteNoteDriveFile(note.id).catch(console.error)
            } else {
              addToSyncQueue({ type: 'delete', entityType: 'note', entityId: note.id }).catch(console.error)
            }
          }
          addTombstone(note.id, 'note').catch(console.error)
          deleteNoteFromDb(note.id).catch(console.error)
        })

        const trashIds = trashNotes.map(n => n.id)
        set((state) => ({
          notes: state.notes.filter(n => !n.isDeleted),
          deletedNoteIds: [...state.deletedNoteIds, ...trashIds]
        }))
      },

      restoreMultiple: (ids) => {
        const now = Date.now()
        const restoredNotes: Note[] = []

        set((state) => ({
          notes: state.notes.map(n => {
            if (ids.includes(n.id)) {
              const restored = {
                ...n,
                isDeleted: false,
                deletedAt: undefined,
                updatedAt: now,
                version: (n.version || 1) + 1,
                syncStatus: 'pending' as const
              }
              restoredNotes.push(restored)
              return restored
            }
            return n
          })
        }))

        restoredNotes.forEach(note => {
          saveNoteWithQueue(note, {
            type: 'update',
            entityType: 'note',
            entityId: note.id,
            data: note
          }).catch(console.error)
        })

        // Trigger sync schedule (event-driven)
        if (restoredNotes.length > 0) {
          syncManager.scheduleSync()
        }
      },

      permanentlyDeleteMultiple: (ids) => {
        const { notes } = get()
        const isOnline = useAppStore.getState().isOnline

        ids.forEach(id => {
          const note = notes.find(n => n.id === id)
          if (note?.driveFileId) {
            if (isOnline) {
              deleteNoteDriveFile(id).catch(console.error)
            } else {
              addToSyncQueue({ type: 'delete', entityType: 'note', entityId: id }).catch(console.error)
            }
          }
          addTombstone(id, 'note').catch(console.error)
          deleteNoteFromDb(id).catch(console.error)
        })

        set((state) => ({
          notes: state.notes.filter(n => !ids.includes(n.id)),
          deletedNoteIds: [...state.deletedNoteIds, ...ids]
        }))
      },

      getTrashNotes: () => {
        const { notes } = get()
        return notes
          .filter(n => n.isDeleted)
          .sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0))
      },

      duplicateNote: (id) => {
        const { notes } = get()
        const note = notes.find(n => n.id === id)
        if (!note) return undefined

        const duplicatedNote: Note = {
          ...note,
          id: generateId(),
          title: note.title ? `${note.title} (copy)` : '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isPinned: false,
          syncStatus: 'pending',
          version: 1,
          userId: note.userId,
          driveFileId: undefined
        }

        set((state) => ({
          notes: [duplicatedNote, ...state.notes]
        }))

        saveNoteWithQueue(duplicatedNote, {
          type: 'create',
          entityType: 'note',
          entityId: duplicatedNote.id,
          data: duplicatedNote
        }).catch(console.error)

        return duplicatedNote
      },

      togglePin: (id) => {
        let updatedNote: Note | undefined

        set((state) => ({
          notes: state.notes.map((note) => {
            if (note.id === id) {
              updatedNote = {
                ...note,
                isPinned: !note.isPinned,
                updatedAt: Date.now(),
                version: (note.version || 1) + 1,
                syncStatus: 'pending' as const
              }
              return updatedNote
            }
            return note
          })
        }))

        if (updatedNote) {
          saveNoteWithQueue(updatedNote, {
            type: 'update',
            entityType: 'note',
            entityId: id,
            data: updatedNote
          }).catch(console.error)

          // Trigger sync schedule (event-driven)
          syncManager.scheduleSync()
        }
      },

      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setSelectedNote: (selectedNoteId) => set({ selectedNoteId }),
      setModalOpen: (isModalOpen) => set({ isModalOpen }),

      // Check if Drive has data (lightweight check before full sync)
      checkDriveHasData: async (accessToken: string) => {
        const { isCheckingDriveData, notes } = get()

        // Skip if already checking or if we have local notes
        if (isCheckingDriveData || notes.length > 0) {
          return notes.length > 0
        }

        const isOnline = useAppStore.getState().isOnline
        if (!isOnline) {
          return false
        }

        set({ isCheckingDriveData: true })

        try {
          setSyncAccessToken(accessToken)
          const result = await engineCheckHasData(accessToken)

          set({
            driveHasData: result.hasData,
            isCheckingDriveData: false
          })

          console.log(`[NotesStore] Drive has data: ${result.hasData}, noteCount: ${result.noteCount}`)
          return result.hasData
        } catch (error) {
          console.error('[NotesStore] checkDriveHasData error:', error)
          set({
            driveHasData: false,
            isCheckingDriveData: false
          })
          return false
        }
      },

      syncWithDrive: async (accessToken: string) => {
        const { notes, isSyncing, selectedNoteId, isModalOpen } = get()
        if (isSyncing) return

        const isOnline = useAppStore.getState().isOnline
        if (!isOnline) {
          console.log('[NotesStore] Offline, skipping sync')
          return
        }

        // Flush any pending updates before sync
        await syncManager.flush()

        set({ isSyncing: true, syncError: null })

        try {
          setSyncAccessToken(accessToken)

          // Get tombstones from IndexedDB (for accurate offline delete tracking)
          const tombstones = await getAllTombstones()
          const localDeletedNotes = tombstones
            .filter(d => d.entityType === 'note')
            .map(d => ({ id: d.id, deletedAt: d.deletedAt }))

          // Filter out active note from sync to prevent conflicts while editing
          // Active note = note being edited in modal
          const activeNoteId = isModalOpen ? selectedNoteId : null
          const notesToSync = activeNoteId
            ? notes.filter(n => n.id !== activeNoteId)
            : notes

          if (activeNoteId) {
            console.log(`[NotesStore] Excluding active note ${activeNoteId} from sync (being edited)`)
          }

          // Sync with new engine (simplified - no stale device detection)
          const result = await engineSyncWithDrive(
            accessToken,
            notesToSync,
            localDeletedNotes
          )

          const { syncedNotes } = result

          // Get remote tombstones to filter out deleted notes
          const remoteTombstones = getRemoteTombstones()

          // Helper to check if a note should be deleted based on tombstone
          const shouldDeleteNote = (noteId: string, noteUpdatedAt: number): boolean => {
            const deletedAt = remoteTombstones.get(noteId)
            if (!deletedAt) return false
            return deletedAt > noteUpdatedAt
          }

          // Collect IDs to delete from IndexedDB (outside of set())
          const noteIdsToDelete: string[] = []

          // Merge synced data with current state (handle edits during sync)
          set((state) => {
            const syncedNotesMap = new Map(syncedNotes.map(n => [n.id, n]))

            // Merge notes - preserve local pending changes, but respect tombstones
            const mergedNotes = state.notes
              .filter(currentNote => {
                // Remove notes that have been deleted on remote (tombstone wins if newer)
                if (shouldDeleteNote(currentNote.id, currentNote.updatedAt)) {
                  console.log(`[NotesStore] Removing local note ${currentNote.id} - deleted on remote`)
                  noteIdsToDelete.push(currentNote.id)
                  return false
                }
                return true
              })
              .map(currentNote => {
                // Preserve active note (don't overwrite with synced version)
                // Preserve active note (don't overwrite with synced version)
                // Use FRESH state from set() callback as activeNoteId closure might be stale
                const currentActiveNoteId = state.isModalOpen ? state.selectedNoteId : null
                if (currentNote.id === currentActiveNoteId) {
                  return currentNote
                }

                const syncedNote = syncedNotesMap.get(currentNote.id)

                if (!syncedNote) return currentNote

                // If local note was modified during sync, keep local version
                if (currentNote.syncStatus === 'pending' &&
                  (currentNote.version || 1) > (syncedNote.version || 1)) {
                  return currentNote
                }

                return syncedNote
              })

            // Add new notes from sync (from other devices)
            const localDeletedNoteIdSet = new Set(localDeletedNotes.map(d => d.id))
            syncedNotes.forEach(syncedNote => {
              const currentActiveNoteId = state.isModalOpen ? state.selectedNoteId : null
              const existsLocally = state.notes.find(n => n.id === syncedNote.id)
              // Don't add if it's the active note (already in local state)
              if (!existsLocally && !localDeletedNoteIdSet.has(syncedNote.id) && syncedNote.id !== currentActiveNoteId) {
                mergedNotes.push(syncedNote)
              }
            })

            return {
              notes: mergedNotes,
              lastSyncTime: Date.now(),
              isSyncing: false,
              isInitialSync: false, // First sync completed
              isNewUser: false // Reset new user flag after sync
            }
          })

          // Delete from IndexedDB outside of set() to avoid race conditions
          if (noteIdsToDelete.length > 0) {
            await Promise.all(noteIdsToDelete.map(id => deleteNoteFromDb(id).catch(console.error)))
          }

          // Save synced data to IndexedDB
          const { notes: finalNotes } = get()
          await saveNotes(finalNotes)

        } catch (error) {
          console.error('Sync failed:', error)

          const errorMessage = error instanceof Error ? error.message : 'Sync failed'
          const isAuthError = errorMessage.includes('401') ||
            errorMessage.includes('authentication') ||
            errorMessage.includes('credential')
          const isPermissionError = errorMessage === 'DRIVE_PERMISSION_DENIED' ||
            errorMessage.includes('403') ||
            errorMessage.includes('insufficient')
          const isQuotaError = errorMessage === 'DRIVE_QUOTA_EXCEEDED'
          const isConflictError = errorMessage === 'DRIVE_CONFLICT_412' ||
            errorMessage === 'DRIVE_CONFLICT_MAX_RETRIES'

          // Handle quota exceeded (X.3)
          if (isQuotaError) {
            set({
              syncError: 'DRIVE_QUOTA_EXCEEDED',
              isSyncing: false,
              isInitialSync: false
            })
            console.error('[NotesStore] Google Drive quota exceeded - sync paused')
            return
          }

          // Handle conflict errors (X.1) - retry sync
          if (isConflictError) {
            console.log('[NotesStore] Sync conflict detected, will retry...')
            set({
              syncError: null,
              isSyncing: false
            })
            // Auto-retry after short delay
            setTimeout(() => {
              const user = (async () => {
                const { useAuthStore } = await import('./authStore')
                return useAuthStore.getState().user
              })()
              user.then(u => {
                if (u?.accessToken) {
                  get().syncWithDrive(u.accessToken)
                }
              })
            }, 1000)
            return
          }

          // Handle permission error - user didn't grant Drive access
          if (isPermissionError) {
            set({
              syncError: 'DRIVE_PERMISSION_DENIED',
              isSyncing: false,
              isInitialSync: false
            })
            // Don't logout, just show error - user can re-login with correct permissions
            return
          }

          set({
            syncError: isAuthError ? 'Refreshing session...' : errorMessage,
            isSyncing: false,
            isInitialSync: false, // Even on error, mark initial sync as done
            notes: get().notes.map(n => ({ ...n, syncStatus: 'error' as const }))
          })

          if (isAuthError) {
            const { useAuthStore } = await import('./authStore')
            const { silentRefreshWithBackend, hasAuthBackend } = await import('@/lib/tokenRefresh')
            const user = useAuthStore.getState().user

            if (user && hasAuthBackend()) {
              const result = await silentRefreshWithBackend(user.id)
              if (result) {
                useAuthStore.getState().setUser({
                  ...user,
                  accessToken: result.access_token,
                  tokenExpiry: Date.now() + (result.expires_in * 1000)
                })
                set({ syncError: null })
                console.log('Token refreshed after 401, will retry sync')
                return
              }
            }

            console.log('Token refresh failed, logging out')
            useAuthStore.getState().logout()
          }
        }
      },

      loadSharedNotes: async () => {
        const isOnline = useAppStore.getState().isOnline
        if (!isOnline) {
          console.log('[NotesStore] Offline, skipping shared notes load')
          return
        }

        const user = useAuthStore.getState().user
        if (!user?.id) {
          console.log('[NotesStore] No user, skipping shared notes load')
          return
        }

        try {
          const shared = await shareService.getReceivedNotes(user.id)
          set({ sharedNotes: shared })
        } catch (error) {
          console.error('Failed to load shared notes:', error)
        }
      },

      acceptSharedNote: async (shareId: string) => {
        const { sharedNotes, notes, syncWithDrive } = get()
        const sharedNote = sharedNotes.find(n => n.shareId === shareId)

        if (!sharedNote) {
          console.error('Shared note not found:', shareId)
          return
        }

        try {
          // Create a new note from the shared note data
          const newNote: Note = {
            userId: useAuthStore.getState().user?.id,
            id: generateId(),
            title: sharedNote.title || '',
            content: sharedNote.content || '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            isPinned: false,
            syncStatus: 'pending',
            version: 1,
            style: sharedNote.style,
            isShared: true,
            sharedBy: sharedNote.sharedBy,
            sharedByName: sharedNote.sharedByName
          }

          // Add to local notes
          set({
            notes: [newNote, ...notes],
            sharedNotes: sharedNotes.filter(n => n.shareId !== shareId)
          })

          // Save to IndexedDB
          await saveNoteWithQueue(newNote, {
            type: 'create',
            entityType: 'note',
            entityId: newNote.id,
            data: newNote
          })

          // Mark as accepted on server FIRST (this deletes from Firestore)
          // This prevents the note from being re-fetched on next login
          const acceptResult = await shareService.acceptSharedNote(shareId)
          if (!acceptResult) {
            console.warn('[NotesStore] Failed to mark shared note as accepted on server')
          }

          // Trigger sync with Drive to upload the new note
          const user = useAuthStore.getState().user
          if (user?.accessToken) {
            // Sync in background - don't await to avoid blocking UI
            syncWithDrive(user.accessToken).catch(err => {
              console.error('[NotesStore] Background sync after accept failed:', err)
            })
          }
        } catch (error) {
          console.error('Failed to accept shared note:', error)
        }
      },

      declineSharedNote: async (shareId: string) => {
        const { sharedNotes } = get()

        try {
          await shareService.declineSharedNote(shareId)
          set({ sharedNotes: sharedNotes.filter(n => n.shareId !== shareId) })
        } catch (error) {
          console.error('Failed to decline shared note:', error)
        }
      },

      markAllSynced: () => {
        set((state) => ({
          notes: state.notes.map(note => ({ ...note, syncStatus: 'synced' as const }))
        }))
      },

      getFilteredNotes: () => {
        const { notes, searchQuery } = get()
        const allNotes = notes.filter(n => !n.isDeleted)

        if (!searchQuery.trim()) {
          return allNotes.sort((a, b) => {
            if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
            return b.updatedAt - a.updatedAt
          })
        }

        const results = searchNotes(allNotes, searchQuery)
        return results.map(r => r.note)
      },

      getSearchResults: () => {
        const { notes, searchQuery } = get()
        const allNotes = notes.filter(n => !n.isDeleted)

        const sortedNotes = allNotes.sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
          return b.updatedAt - a.updatedAt
        })

        if (!searchQuery.trim()) {
          return sortedNotes.map(note => ({ note, query: '' }))
        }

        return searchNotes(sortedNotes, searchQuery)
      },

      getSelectedNote: () => {
        const { notes, selectedNoteId } = get()
        return notes.find((note) => note.id === selectedNoteId)
      }
    }),
    {
      name: 'notes-storage',
      partialize: (state) => ({
        // Only persist essential UI state - IndexedDB is source of truth for data
        notes: state.notes,
        deletedNoteIds: state.deletedNoteIds,
        lastSyncTime: state.lastSyncTime
      })
    }
  )
)
