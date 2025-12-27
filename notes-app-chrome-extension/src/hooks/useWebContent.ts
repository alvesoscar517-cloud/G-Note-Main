import { useEffect, useCallback } from 'react'
import { useWebContentStore, type PendingWebContent } from '@/stores/webContentStore'
import { useNotesStore } from '@/stores/notesStore'
import { isChromeExtension } from '@/lib/chromeAuth'

/**
 * Hook to handle web content added via Chrome context menu
 * Returns the pending content and a function to handle it
 */
export function useWebContent() {
  const { pendingContent, checkPendingContent, clearPendingContent, setPendingContent } = useWebContentStore()
  const { addNote, setSelectedNote, setModalOpen, updateNote } = useNotesStore()
  
  // Check for pending content on mount
  useEffect(() => {
    checkPendingContent()
  }, [checkPendingContent])
  
  // Listen for messages from background script when content is added
  useEffect(() => {
    if (!isChromeExtension()) return
    
    const handleMessage = (request: { type: string }) => {
      if (request.type === 'WEB_CONTENT_ADDED') {
        checkPendingContent()
      }
    }
    
    chrome.runtime.onMessage.addListener(handleMessage)
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
    }
  }, [checkPendingContent])
  
  // Create a new note with the web content
  const createNoteWithContent = useCallback(async (content: PendingWebContent) => {
    // Create a new note
    const newNote = addNote()
    
    // Build the content with source attribution
    let noteContent = content.html || `<p>${content.text}</p>`
    
    // Add source attribution if available
    if (content.sourceUrl) {
      noteContent += `<p><br></p><p><em>Source: <a href="${content.sourceUrl}" target="_blank">${content.sourceTitle || content.sourceUrl}</a></em></p>`
    }
    
    // Update the note with the content
    updateNote(newNote.id, {
      content: noteContent,
      title: content.sourceTitle ? `From: ${content.sourceTitle.substring(0, 50)}` : 'Web Clip'
    })
    
    // Open the note in editor
    setSelectedNote(newNote.id)
    setModalOpen(true)
    
    // Clear the pending content
    await clearPendingContent()
  }, [addNote, updateNote, setSelectedNote, setModalOpen, clearPendingContent])
  
  // Insert content into an existing note (for use in editor)
  const insertIntoEditor = useCallback(async (
    editor: { chain: () => { focus: () => { insertContent: (content: string) => { run: () => void } } } },
    content: PendingWebContent
  ) => {
    if (!editor) return
    
    // Build the content with source attribution
    let insertContent = content.html || `<p>${content.text}</p>`
    
    // Add source attribution if available
    if (content.sourceUrl) {
      insertContent += `<p><br></p><p><em>Source: <a href="${content.sourceUrl}" target="_blank">${content.sourceTitle || content.sourceUrl}</a></em></p>`
    }
    
    // Insert at cursor position
    editor.chain().focus().insertContent(insertContent).run()
    
    // Clear the pending content
    await clearPendingContent()
  }, [clearPendingContent])
  
  // Dismiss the pending content without using it
  const dismissContent = useCallback(async () => {
    await clearPendingContent()
  }, [clearPendingContent])
  
  return {
    pendingContent,
    createNoteWithContent,
    insertIntoEditor,
    dismissContent,
    setPendingContent
  }
}
