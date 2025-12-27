import Fuse, { type FuseResult, type IFuseOptions } from 'fuse.js'
import type { Note } from '@/types'

export interface SearchResult {
  note: Note
  query: string
}

const fuseOptions: IFuseOptions<Note> = {
  keys: [
    { name: 'title', weight: 2 },
    { name: 'content', weight: 1 }
  ],
  threshold: 0.3,
  ignoreLocation: true,
  minMatchCharLength: 2
}

export function searchNotes(notes: Note[], query: string): SearchResult[] {
  if (!query.trim()) {
    return notes.map(note => ({ note, query: '' }))
  }

  const fuse = new Fuse(notes, fuseOptions)
  const results = fuse.search(query)

  return results.map((result: FuseResult<Note>) => ({
    note: result.item,
    query: query.trim()
  }))
}

// Simple text highlight - find and highlight exact query matches
export function highlightText(text: string, query: string): { text: string; highlight: boolean }[] {
  if (!query.trim()) {
    return [{ text, highlight: false }]
  }

  const segments: { text: string; highlight: boolean }[] = []
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase().trim()
  
  let lastIndex = 0
  let index = lowerText.indexOf(lowerQuery)

  while (index !== -1) {
    // Add non-highlighted text before match
    if (index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, index), highlight: false })
    }
    // Add highlighted match (use original case from text)
    segments.push({ text: text.slice(index, index + query.length), highlight: true })
    lastIndex = index + query.length
    index = lowerText.indexOf(lowerQuery, lastIndex)
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), highlight: false })
  }

  return segments.length > 0 ? segments : [{ text, highlight: false }]
}
