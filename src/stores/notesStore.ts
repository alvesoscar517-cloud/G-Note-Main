import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Note } from '@/types'
import { generateId } from '@/lib/utils'
import { shareService, type SharedNote } from '@/lib/shareService'
import { searchNotes, type SearchResult } from '@/lib/search'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'

// Database layer imports
import {
  saveNotes,
  getNotesByUserId,
  assignUserIdToOrphanedNotes,
  deleteNote as deleteNoteFromDb
} from '@/lib/db/noteRepository'
import { saveNoteWithQueue } from '@/lib/db/syncQueueRepository'
import { isIndexedDBAvailable } from '@/lib/db/utils'

// Sync Service - centralized sync logic
import { syncService } from '@/lib/sync/syncService'

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
            await assignUserIdToOrphanedNotes(user.id)

            // Load only this user's notes
            offlineNotes = await getNotesByUserId(user.id)
            console.log(`[NotesStore] Loaded ${offlineNotes.length} notes for user ${user.id}`)
          } else {
            console.log('[NotesStore] No user logged in, skipping IndexedDB load')
            offlineNotes = []
          }

          // Simply load from IndexedDB
          set({
            notes: offlineNotes,
            isOfflineReady: true
          })

          console.log(`[NotesStore] Loaded ${offlineNotes.length} notes from IndexedDB`)

          // Initialize SyncService with callbacks
          syncService.initializeSyncManager(
            // Sync callback
            async () => {
              const authStore = useAuthStore.getState()
              if (authStore.user?.accessToken) {
                await get().syncWithDrive(authStore.user.accessToken)
              }
            },
            // Save callback - created by syncService
            syncService.createSaveCallback(),
            // Has pending changes callback
            () => get().notes.some(n => n.syncStatus === 'pending')
          )
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

        // Use SyncService for debounced save and sync scheduling
        if (updatedNote) {
          syncService.addPendingNote(updatedNote)
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

          // Trigger sync schedule
          syncService.scheduleSync()
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

          // Trigger sync schedule
          syncService.scheduleSync()
        }
      },

      permanentlyDelete: (id) => {
        const { notes } = get()
        const note = notes.find(n => n.id === id)
        const isOnline = useAppStore.getState().isOnline

        if (note?.driveFileId) {
          syncService.deleteNoteDriveFile(id, isOnline).catch(console.error)
        }

        // Track deletion for sync and delete from IndexedDB
        syncService.trackDeletion(id).catch(console.error)
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
            syncService.deleteNoteDriveFile(note.id, isOnline).catch(console.error)
          }
          syncService.trackDeletion(note.id).catch(console.error)
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

        // Trigger sync schedule
        if (restoredNotes.length > 0) {
          syncService.scheduleSync()
        }
      },

      permanentlyDeleteMultiple: (ids) => {
        const { notes } = get()
        const isOnline = useAppStore.getState().isOnline

        ids.forEach(id => {
          const note = notes.find(n => n.id === id)
          if (note?.driveFileId) {
            syncService.deleteNoteDriveFile(id, isOnline).catch(console.error)
          }
          syncService.trackDeletion(id).catch(console.error)
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

          // Trigger sync schedule
          syncService.scheduleSync()
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
          const result = await syncService.checkDriveHasData(accessToken)

          set({
            driveHasData: result.hasData,
            isCheckingDriveData: false
          })

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

        set({ isSyncing: true, syncError: null })

        // Use SyncService for all sync logic
        const result = await syncService.syncWithDrive(accessToken, {
          notes,
          selectedNoteId,
          isModalOpen
        })

        if (result.success) {
          // Update state with merged notes
          set({
            notes: result.mergedNotes,
            lastSyncTime: Date.now(),
            isSyncing: false,
            isInitialSync: false,
            isNewUser: false
          })
        } else {
          // Handle errors based on type
          const { error, errorType } = result

          // Handle quota exceeded
          if (errorType === 'quota') {
            set({
              syncError: 'DRIVE_QUOTA_EXCEEDED',
              isSyncing: false,
              isInitialSync: false
            })
            console.error('[NotesStore] Google Drive quota exceeded - sync paused')
            return
          }

          // Handle conflict errors - retry sync
          if (errorType === 'conflict') {
            console.log('[NotesStore] Sync conflict detected, will retry...')
            set({
              syncError: null,
              isSyncing: false
            })
            // Auto-retry after short delay
            setTimeout(() => {
              const user = useAuthStore.getState().user
              if (user?.accessToken) {
                get().syncWithDrive(user.accessToken)
              }
            }, 1000)
            return
          }

          // Handle permission error
          if (errorType === 'permission') {
            set({
              syncError: 'DRIVE_PERMISSION_DENIED',
              isSyncing: false,
              isInitialSync: false
            })
            return
          }

          // Handle auth error
          if (errorType === 'auth') {
            set({
              syncError: error || 'Refreshing session...',
              isSyncing: false,
              isInitialSync: false,
              notes: notes.map(n => ({ ...n, syncStatus: 'error' as const }))
            })

            // Try to refresh token
            const { silentRefreshWithBackend, hasAuthBackend } = await import('@/lib/tokenRefresh')
            const user = useAuthStore.getState().user

            if (user && hasAuthBackend()) {
              const refreshResult = await silentRefreshWithBackend(user.id)
              if (refreshResult) {
                useAuthStore.getState().setUser({
                  ...user,
                  accessToken: refreshResult.access_token,
                  tokenExpiry: Date.now() + (refreshResult.expires_in * 1000)
                })
                set({ syncError: null })
                console.log('Token refreshed after 401, will retry sync')
                return
              }
            }

            console.log('Token refresh failed, logging out')
            useAuthStore.getState().logout()
            return
          }

          // Unknown error
          set({
            syncError: error || 'Sync failed',
            isSyncing: false,
            isInitialSync: false,
            notes: notes.map(n => ({ ...n, syncStatus: 'error' as const }))
          })
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
