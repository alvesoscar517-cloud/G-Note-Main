import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Note, Collection } from '@/types'
import { generateId } from '@/lib/utils'
import { driveSync } from '@/lib/driveSync'
import { driveShare } from '@/lib/driveShare'
import { searchNotes, type SearchResult } from '@/lib/search'
import { useNetworkStore } from '@/stores/networkStore'
import * as offlineDb from '@/lib/offlineDb'

const COLLECTION_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', 
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'
]

interface NotesState {
  notes: Note[]
  sharedNotes: Note[]
  collections: Collection[]
  deletedNoteIds: string[]
  deletedCollectionIds: string[]
  searchQuery: string
  selectedNoteId: string | null
  isModalOpen: boolean
  isSyncing: boolean
  lastSyncTime: number | null
  syncError: string | null
  isOfflineReady: boolean
  
  // Note actions
  addNote: (collectionId?: string) => Note
  updateNote: (id: string, updates: Partial<Note>) => void
  deleteNote: (id: string) => void
  duplicateNote: (id: string) => Note | undefined
  togglePin: (id: string) => void
  setSearchQuery: (query: string) => void
  setSelectedNote: (id: string | null) => void
  setModalOpen: (open: boolean) => void
  
  // Sync actions
  syncWithDrive: (accessToken: string) => Promise<void>
  loadSharedNotes: (accessToken: string) => Promise<void>
  markAllSynced: () => void
  initOfflineStorage: () => Promise<void>
  saveToOfflineStorage: () => Promise<void>

  // Trash actions
  moveToTrash: (id: string) => void
  restoreFromTrash: (id: string) => void
  permanentlyDelete: (id: string) => void
  emptyTrash: () => void
  restoreMultiple: (ids: string[]) => void
  permanentlyDeleteMultiple: (ids: string[]) => void
  getTrashNotes: () => Note[]
  
  // Collection actions
  createCollection: (name: string, noteIds: string[]) => Collection
  updateCollection: (id: string, updates: Partial<Collection>) => void
  deleteCollection: (id: string) => void
  addNoteToCollection: (noteId: string, collectionId: string) => void
  removeNoteFromCollection: (noteId: string) => void
  toggleCollectionExpanded: (id: string) => void
  mergeNotesIntoCollection: (sourceNoteId: string, targetNoteId: string) => void
  
  // Getters
  getFilteredNotes: () => Note[]
  getSearchResults: () => SearchResult[]
  getSelectedNote: () => Note | undefined
  getNotesInCollection: (collectionId: string) => Note[]
  getUncollectedNotes: () => Note[]
}

// Helper to queue offline operations
async function queueOfflineOperation(
  entityType: 'note' | 'collection',
  type: 'create' | 'update' | 'delete',
  entityId: string,
  data?: Note | Collection
) {
  const isOnline = useNetworkStore.getState().isOnline
  if (!isOnline) {
    await offlineDb.addToSyncQueue({ type, entityType, entityId, data })
  }
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set, get) => ({
      notes: [],
      sharedNotes: [],
      collections: [],
      deletedNoteIds: [],
      deletedCollectionIds: [],
      searchQuery: '',
      selectedNoteId: null,
      isModalOpen: false,
      isSyncing: false,
      lastSyncTime: null,
      syncError: null,
      isOfflineReady: false,

      // Initialize offline storage - IndexedDB is source of truth
      initOfflineStorage: async () => {
        try {
          if (!offlineDb.isIndexedDBAvailable()) {
            console.log('[NotesStore] IndexedDB not available')
            set({ isOfflineReady: true })
            return
          }

          const [offlineNotes, offlineCollections] = await Promise.all([
            offlineDb.getAllNotes(),
            offlineDb.getAllCollections()
          ])
          
          const { notes: currentNotes, collections: currentCollections } = get()
          
          // Merge notes - IndexedDB takes priority for offline data
          const mergedNotesMap = new Map<string, Note>()
          currentNotes.forEach(n => mergedNotesMap.set(n.id, n))
          offlineNotes.forEach(offlineNote => {
            const existing = mergedNotesMap.get(offlineNote.id)
            // Prefer newer version or higher version number
            if (!existing || 
                (offlineNote.version || 1) > (existing.version || 1) ||
                offlineNote.updatedAt > existing.updatedAt) {
              mergedNotesMap.set(offlineNote.id, offlineNote)
            }
          })
          
          // Merge collections
          const mergedCollectionsMap = new Map<string, Collection>()
          currentCollections.forEach(c => mergedCollectionsMap.set(c.id, c))
          offlineCollections.forEach(offlineCollection => {
            const existing = mergedCollectionsMap.get(offlineCollection.id)
            if (!existing ||
                (offlineCollection.version || 1) > (existing.version || 1) ||
                offlineCollection.updatedAt > existing.updatedAt) {
              mergedCollectionsMap.set(offlineCollection.id, offlineCollection)
            }
          })
          
          const mergedNotes = Array.from(mergedNotesMap.values())
          const mergedCollections = Array.from(mergedCollectionsMap.values())
          
          set({ 
            notes: mergedNotes, 
            collections: mergedCollections,
            isOfflineReady: true 
          })
          
          console.log(`[NotesStore] Loaded ${offlineNotes.length} notes, ${offlineCollections.length} collections from IndexedDB`)
          
          // Save merged state back to IndexedDB
          if (mergedNotes.length > 0) {
            await offlineDb.saveNotes(mergedNotes)
          }
          if (mergedCollections.length > 0) {
            await offlineDb.saveCollections(mergedCollections)
          }
        } catch (error) {
          console.error('[NotesStore] Failed to init offline storage:', error)
          set({ isOfflineReady: true })
        }
      },

      saveToOfflineStorage: async () => {
        try {
          if (!offlineDb.isIndexedDBAvailable()) return
          const { notes, collections } = get()
          await Promise.all([
            offlineDb.saveNotes(notes),
            offlineDb.saveCollections(collections)
          ])
        } catch (error) {
          console.error('[NotesStore] Failed to save to offline storage:', error)
        }
      },

      addNote: (collectionId?: string) => {
        const newNote: Note = {
          id: generateId(),
          title: '',
          content: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isPinned: false,
          syncStatus: 'pending',
          version: 1,
          collectionId
        }
        
        set((state) => {
          const newState: Partial<NotesState> = { 
            notes: [newNote, ...state.notes],
            selectedNoteId: newNote.id,
            isModalOpen: true
          }
          
          if (collectionId) {
            newState.collections = state.collections.map(c =>
              c.id === collectionId 
                ? { ...c, noteIds: [...c.noteIds, newNote.id], updatedAt: Date.now(), version: (c.version || 1) + 1, syncStatus: 'pending' as const }
                : c
            )
          }
          
          return newState
        })
        
        // Save to IndexedDB atomically with queue
        offlineDb.saveNoteWithQueue(newNote, { 
          type: 'create', 
          entityType: 'note', 
          entityId: newNote.id, 
          data: newNote 
        }).catch(console.error)
        
        // Queue collection update if needed
        if (collectionId) {
          const collection = get().collections.find(c => c.id === collectionId)
          if (collection) {
            queueOfflineOperation('collection', 'update', collectionId, collection)
          }
        }
        
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
        
        if (updatedNote) {
          offlineDb.saveNoteWithQueue(updatedNote, {
            type: 'update',
            entityType: 'note',
            entityId: id,
            data: updatedNote
          }).catch(console.error)
        }
      },
      
      deleteNote: (id) => {
        get().moveToTrash(id)
      },

      moveToTrash: (id) => {
        const now = Date.now()
        let trashedNote: Note | undefined
        let updatedCollection: Collection | undefined
        
        set((state) => {
          const note = state.notes.find(n => n.id === id)
          if (!note) return state
          
          let newCollections = state.collections
          
          if (note.collectionId) {
            newCollections = state.collections.map(c => {
              if (c.id === note.collectionId) {
                const newNoteIds = c.noteIds.filter(nId => nId !== id)
                if (newNoteIds.length <= 1) {
                  return null
                }
                updatedCollection = { 
                  ...c, 
                  noteIds: newNoteIds, 
                  updatedAt: now,
                  version: (c.version || 1) + 1,
                  syncStatus: 'pending' as const
                }
                return updatedCollection
              }
              return c
            }).filter(Boolean) as Collection[]
          }
          
          trashedNote = { 
            ...note, 
            isDeleted: true, 
            deletedAt: now, 
            updatedAt: now, 
            collectionId: undefined, 
            version: (note.version || 1) + 1,
            syncStatus: 'pending' as const 
          }
          
          return {
            notes: state.notes.map(n => n.id === id ? trashedNote! : n),
            collections: newCollections,
            selectedNoteId: state.selectedNoteId === id ? null : state.selectedNoteId,
            isModalOpen: state.selectedNoteId === id ? false : state.isModalOpen
          }
        })
        
        if (trashedNote) {
          offlineDb.saveNoteWithQueue(trashedNote, {
            type: 'update',
            entityType: 'note',
            entityId: id,
            data: trashedNote
          }).catch(console.error)
        }
        
        if (updatedCollection) {
          offlineDb.saveCollectionWithQueue(updatedCollection, {
            type: 'update',
            entityType: 'collection',
            entityId: updatedCollection.id,
            data: updatedCollection
          }).catch(console.error)
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
          offlineDb.saveNoteWithQueue(restoredNote, {
            type: 'update',
            entityType: 'note',
            entityId: id,
            data: restoredNote
          }).catch(console.error)
        }
      },

      permanentlyDelete: (id) => {
        const { notes } = get()
        const note = notes.find(n => n.id === id)
        const isOnline = useNetworkStore.getState().isOnline
        
        if (note?.driveFileId) {
          if (isOnline) {
            driveSync.deleteNoteFile(id).catch(console.error)
          } else {
            offlineDb.addToSyncQueue({ type: 'delete', entityType: 'note', entityId: id }).catch(console.error)
          }
        }
        
        // Track deletion for sync and delete from IndexedDB
        offlineDb.addDeletedId(id, 'note').catch(console.error)
        offlineDb.deleteNote(id).catch(console.error)
        
        set((state) => ({
          notes: state.notes.filter(n => n.id !== id),
          deletedNoteIds: [...state.deletedNoteIds, id]
        }))
      },

      emptyTrash: () => {
        const { notes } = get()
        const trashNotes = notes.filter(n => n.isDeleted)
        const isOnline = useNetworkStore.getState().isOnline
        
        trashNotes.forEach(note => {
          if (note.driveFileId) {
            if (isOnline) {
              driveSync.deleteNoteFile(note.id).catch(console.error)
            } else {
              offlineDb.addToSyncQueue({ type: 'delete', entityType: 'note', entityId: note.id }).catch(console.error)
            }
          }
          offlineDb.addDeletedId(note.id, 'note').catch(console.error)
          offlineDb.deleteNote(note.id).catch(console.error)
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
          offlineDb.saveNoteWithQueue(note, {
            type: 'update',
            entityType: 'note',
            entityId: note.id,
            data: note
          }).catch(console.error)
        })
      },

      permanentlyDeleteMultiple: (ids) => {
        const { notes } = get()
        const isOnline = useNetworkStore.getState().isOnline
        
        ids.forEach(id => {
          const note = notes.find(n => n.id === id)
          if (note?.driveFileId) {
            if (isOnline) {
              driveSync.deleteNoteFile(id).catch(console.error)
            } else {
              offlineDb.addToSyncQueue({ type: 'delete', entityType: 'note', entityId: id }).catch(console.error)
            }
          }
          offlineDb.addDeletedId(id, 'note').catch(console.error)
          offlineDb.deleteNote(id).catch(console.error)
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
          driveFileId: undefined,
          collectionId: note.collectionId
        }

        set((state) => {
          const newState: Partial<NotesState> = {
            notes: [duplicatedNote, ...state.notes]
          }

          if (note.collectionId) {
            newState.collections = state.collections.map(c =>
              c.id === note.collectionId
                ? { 
                    ...c, 
                    noteIds: [...c.noteIds, duplicatedNote.id], 
                    updatedAt: Date.now(),
                    version: (c.version || 1) + 1,
                    syncStatus: 'pending' as const
                  }
                : c
            )
          }

          return newState
        })
        
        offlineDb.saveNoteWithQueue(duplicatedNote, {
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
          offlineDb.saveNoteWithQueue(updatedNote, {
            type: 'update',
            entityType: 'note',
            entityId: id,
            data: updatedNote
          }).catch(console.error)
        }
      },
      
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setSelectedNote: (selectedNoteId) => set({ selectedNoteId }),
      setModalOpen: (isModalOpen) => set({ isModalOpen }),

      syncWithDrive: async (accessToken: string) => {
        const { notes, collections, isSyncing, deletedNoteIds, deletedCollectionIds } = get()
        if (isSyncing) return
        
        const isOnline = useNetworkStore.getState().isOnline
        if (!isOnline) {
          console.log('[NotesStore] Offline, skipping sync')
          return
        }

        set({ isSyncing: true, syncError: null })
        
        try {
          driveSync.setAccessToken(accessToken)
          
          // Sync with both notes and collections
          const { notes: syncedNotes, collections: syncedCollections } = await driveSync.sync(
            notes,
            collections,
            deletedNoteIds,
            deletedCollectionIds
          )
          
          // Merge synced data with current state (handle edits during sync)
          set((state) => {
            const syncedNotesMap = new Map(syncedNotes.map(n => [n.id, n]))
            const syncedCollectionsMap = new Map(syncedCollections.map(c => [c.id, c]))
            
            // Merge notes - preserve local pending changes
            const mergedNotes = state.notes.map(currentNote => {
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
            syncedNotes.forEach(syncedNote => {
              const existsLocally = state.notes.find(n => n.id === syncedNote.id)
              if (!existsLocally && !deletedNoteIds.includes(syncedNote.id)) {
                mergedNotes.push(syncedNote)
              }
            })
            
            // Merge collections similarly
            const mergedCollections = state.collections.map(currentCollection => {
              const syncedCollection = syncedCollectionsMap.get(currentCollection.id)
              
              if (!syncedCollection) return currentCollection
              
              if (currentCollection.syncStatus === 'pending' &&
                  (currentCollection.version || 1) > (syncedCollection.version || 1)) {
                return currentCollection
              }
              
              return syncedCollection
            })
            
            syncedCollections.forEach(syncedCollection => {
              const existsLocally = state.collections.find(c => c.id === syncedCollection.id)
              if (!existsLocally && !deletedCollectionIds.includes(syncedCollection.id)) {
                mergedCollections.push(syncedCollection)
              }
            })
            
            return {
              notes: mergedNotes,
              collections: mergedCollections,
              lastSyncTime: Date.now(),
              isSyncing: false 
            }
          })
          
          // Save synced data to IndexedDB
          const { notes: finalNotes, collections: finalCollections } = get()
          await Promise.all([
            offlineDb.saveNotes(finalNotes),
            offlineDb.saveCollections(finalCollections)
          ])
          
        } catch (error) {
          console.error('Sync failed:', error)
          
          const errorMessage = error instanceof Error ? error.message : 'Sync failed'
          const isAuthError = errorMessage.includes('401') || 
                              errorMessage.includes('authentication') ||
                              errorMessage.includes('credential')
          
          set({ 
            syncError: isAuthError ? 'Refreshing session...' : errorMessage,
            isSyncing: false,
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

      loadSharedNotes: async (accessToken: string) => {
        const isOnline = useNetworkStore.getState().isOnline
        if (!isOnline) {
          console.log('[NotesStore] Offline, skipping shared notes load')
          return
        }
        
        try {
          driveShare.setAccessToken(accessToken)
          const shared = await driveShare.getSharedWithMe()
          set({ sharedNotes: shared })
        } catch (error) {
          console.error('Failed to load shared notes:', error)
        }
      },

      markAllSynced: () => {
        set((state) => ({
          notes: state.notes.map(note => ({ ...note, syncStatus: 'synced' as const })),
          collections: state.collections.map(c => ({ ...c, syncStatus: 'synced' as const }))
        }))
      },

      // Collection actions
      createCollection: (name: string, noteIds: string[]) => {
        const { collections } = get()
        const colorIndex = collections.length % COLLECTION_COLORS.length
        
        const newCollection: Collection = {
          id: generateId(),
          name,
          color: COLLECTION_COLORS[colorIndex],
          noteIds,
          isExpanded: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
          syncStatus: 'pending'
        }
        
        set((state) => ({
          collections: [...state.collections, newCollection],
          notes: state.notes.map(n => 
            noteIds.includes(n.id) 
              ? { ...n, collectionId: newCollection.id, version: (n.version || 1) + 1, syncStatus: 'pending' as const } 
              : n
          )
        }))
        
        // Save collection and queue for sync
        offlineDb.saveCollectionWithQueue(newCollection, {
          type: 'create',
          entityType: 'collection',
          entityId: newCollection.id,
          data: newCollection
        }).catch(console.error)
        
        // Update notes in IndexedDB
        const { notes } = get()
        noteIds.forEach(noteId => {
          const note = notes.find(n => n.id === noteId)
          if (note) {
            offlineDb.saveNote(note).catch(console.error)
          }
        })
        
        return newCollection
      },

      updateCollection: (id, updates) => {
        let updatedCollection: Collection | undefined
        
        set((state) => ({
          collections: state.collections.map(c => {
            if (c.id === id) {
              updatedCollection = { 
                ...c, 
                ...updates, 
                updatedAt: Date.now(),
                version: (c.version || 1) + 1,
                syncStatus: 'pending' as const
              }
              return updatedCollection
            }
            return c
          })
        }))
        
        if (updatedCollection) {
          offlineDb.saveCollectionWithQueue(updatedCollection, {
            type: 'update',
            entityType: 'collection',
            entityId: id,
            data: updatedCollection
          }).catch(console.error)
        }
      },

      deleteCollection: (id) => {
        const isOnline = useNetworkStore.getState().isOnline
        const { notes } = get()
        
        // Get notes that belong to this collection before deletion
        const notesInCollection = notes.filter(n => n.collectionId === id)
        
        // Track deletion in deletedIds store
        offlineDb.addDeletedId(id, 'collection').catch(console.error)
        
        // Delete from IndexedDB
        offlineDb.deleteCollection(id).catch(console.error)
        
        // Remove any pending sync queue items for this collection
        offlineDb.getSyncQueue().then(queue => {
          const collectionQueueItems = queue.filter(
            item => item.entityType === 'collection' && item.entityId === id
          )
          collectionQueueItems.forEach(item => {
            offlineDb.removeFromSyncQueue(item.id).catch(console.error)
          })
        }).catch(console.error)
        
        // Delete from Drive if online
        if (isOnline) {
          driveSync.deleteCollectionFile(id).catch(console.error)
        } else {
          // Queue deletion for when back online
          offlineDb.addToSyncQueue({ 
            type: 'delete', 
            entityType: 'collection', 
            entityId: id 
          }).catch(console.error)
        }
        
        // Update state
        set((state) => ({
          collections: state.collections.filter(c => c.id !== id),
          deletedCollectionIds: [...state.deletedCollectionIds, id],
          notes: state.notes.map(n => 
            n.collectionId === id 
              ? { ...n, collectionId: undefined, version: (n.version || 1) + 1, syncStatus: 'pending' as const } 
              : n
          )
        }))
        
        // Update notes in IndexedDB that were in this collection
        notesInCollection.forEach(note => {
          const updatedNote = { 
            ...note, 
            collectionId: undefined, 
            version: (note.version || 1) + 1, 
            syncStatus: 'pending' as const 
          }
          offlineDb.saveNoteWithQueue(updatedNote, {
            type: 'update',
            entityType: 'note',
            entityId: note.id,
            data: updatedNote
          }).catch(console.error)
        })
      },

      addNoteToCollection: (noteId: string, collectionId: string) => {
        let updatedNote: Note | undefined
        let updatedCollection: Collection | undefined
        
        set((state) => ({
          collections: state.collections.map(c => {
            if (c.id === collectionId) {
              updatedCollection = { 
                ...c, 
                noteIds: [...c.noteIds, noteId], 
                updatedAt: Date.now(),
                version: (c.version || 1) + 1,
                syncStatus: 'pending' as const
              }
              return updatedCollection
            }
            return c
          }),
          notes: state.notes.map(n => {
            if (n.id === noteId) {
              updatedNote = { 
                ...n, 
                collectionId,
                version: (n.version || 1) + 1,
                syncStatus: 'pending' as const
              }
              return updatedNote
            }
            return n
          })
        }))
        
        if (updatedNote) {
          offlineDb.saveNoteWithQueue(updatedNote, {
            type: 'update',
            entityType: 'note',
            entityId: noteId,
            data: updatedNote
          }).catch(console.error)
        }
        
        if (updatedCollection) {
          offlineDb.saveCollectionWithQueue(updatedCollection, {
            type: 'update',
            entityType: 'collection',
            entityId: collectionId,
            data: updatedCollection
          }).catch(console.error)
        }
      },

      removeNoteFromCollection: (noteId: string) => {
        let updatedNote: Note | undefined
        let updatedCollection: Collection | undefined
        let deletedCollectionId: string | undefined
        
        set((state) => {
          const note = state.notes.find(n => n.id === noteId)
          if (!note?.collectionId) return state
          
          const collection = state.collections.find(c => c.id === note.collectionId)
          if (!collection) return state
          
          const newNoteIds = collection.noteIds.filter(id => id !== noteId)
          
          // Delete collection if less than 2 notes
          if (newNoteIds.length < 2) {
            deletedCollectionId = collection.id
            return {
              collections: state.collections.filter(c => c.id !== collection.id),
              notes: state.notes.map(n => {
                if (n.collectionId === collection.id) {
                  const updated = { 
                    ...n, 
                    collectionId: undefined,
                    version: (n.version || 1) + 1,
                    syncStatus: 'pending' as const
                  }
                  if (n.id === noteId) updatedNote = updated
                  return updated
                }
                return n
              })
            }
          }
          
          updatedCollection = { 
            ...collection, 
            noteIds: newNoteIds, 
            updatedAt: Date.now(),
            version: (collection.version || 1) + 1,
            syncStatus: 'pending' as const
          }
          
          return {
            collections: state.collections.map(c =>
              c.id === collection.id ? updatedCollection! : c
            ),
            notes: state.notes.map(n => {
              if (n.id === noteId) {
                updatedNote = { 
                  ...n, 
                  collectionId: undefined,
                  version: (n.version || 1) + 1,
                  syncStatus: 'pending' as const
                }
                return updatedNote
              }
              return n
            })
          }
        })
        
        if (updatedNote) {
          offlineDb.saveNoteWithQueue(updatedNote, {
            type: 'update',
            entityType: 'note',
            entityId: noteId,
            data: updatedNote
          }).catch(console.error)
        }
        
        if (updatedCollection) {
          offlineDb.saveCollectionWithQueue(updatedCollection, {
            type: 'update',
            entityType: 'collection',
            entityId: updatedCollection.id,
            data: updatedCollection
          }).catch(console.error)
        }
        
        if (deletedCollectionId) {
          offlineDb.addDeletedId(deletedCollectionId, 'collection').catch(console.error)
          offlineDb.deleteCollection(deletedCollectionId).catch(console.error)
          queueOfflineOperation('collection', 'delete', deletedCollectionId)
        }
      },

      toggleCollectionExpanded: (id: string) => {
        set((state) => ({
          collections: state.collections.map(c =>
            c.id === id ? { ...c, isExpanded: !c.isExpanded } : c
          )
        }))
        // Note: isExpanded is UI-only state, no need to sync
      },

      mergeNotesIntoCollection: (sourceNoteId: string, targetNoteId: string) => {
        const { notes, createCollection, addNoteToCollection } = get()
        
        const sourceNote = notes.find(n => n.id === sourceNoteId)
        const targetNote = notes.find(n => n.id === targetNoteId)
        
        if (!sourceNote || !targetNote) return
        
        if (targetNote.collectionId) {
          if (sourceNote.collectionId) {
            get().removeNoteFromCollection(sourceNoteId)
          }
          addNoteToCollection(sourceNoteId, targetNote.collectionId)
        } else if (sourceNote.collectionId) {
          addNoteToCollection(targetNoteId, sourceNote.collectionId)
        } else {
          createCollection('Collection', [sourceNoteId, targetNoteId])
        }
      },
      
      getFilteredNotes: () => {
        const { notes, sharedNotes, searchQuery } = get()
        const allNotes = [...notes.filter(n => !n.isDeleted), ...sharedNotes]
        
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
        const { notes, sharedNotes, searchQuery } = get()
        const allNotes = [...notes.filter(n => !n.isDeleted), ...sharedNotes]
        
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
        const { notes, sharedNotes, selectedNoteId } = get()
        return [...notes, ...sharedNotes].find((note) => note.id === selectedNoteId)
      },

      getNotesInCollection: (collectionId: string) => {
        const { notes } = get()
        return notes.filter(n => n.collectionId === collectionId && !n.isDeleted)
      },

      getUncollectedNotes: () => {
        const { notes } = get()
        return notes.filter(n => !n.collectionId && !n.isDeleted)
      }
    }),
    {
      name: 'notes-storage',
      partialize: (state) => ({ 
        // Only persist essential UI state - IndexedDB is source of truth for data
        notes: state.notes,
        collections: state.collections,
        deletedNoteIds: state.deletedNoteIds,
        deletedCollectionIds: state.deletedCollectionIds,
        lastSyncTime: state.lastSyncTime 
      })
    }
  )
)
