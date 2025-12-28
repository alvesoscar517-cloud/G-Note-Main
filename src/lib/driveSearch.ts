/**
 * Google Drive Full-text Search
 * Tận dụng khả năng search của Google Drive API để tìm kiếm nội dung
 * trong các file TXT, PDF, DOCX mà không cần xây dựng search engine riêng
 */

const DRIVE_API = 'https://www.googleapis.com/drive/v3'

export interface DriveSearchResult {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
  webViewLink?: string
  thumbnailLink?: string
  iconLink?: string
  // Snippet from content match (if available)
  snippet?: string
}

export interface DriveSearchOptions {
  /** Folder ID to search within (optional - searches all Drive if not specified) */
  folderId?: string
  /** Maximum results to return */
  maxResults?: number
  /** File types to search */
  mimeTypes?: string[]
  /** Include trashed files */
  includeTrashed?: boolean
}

// Common MIME types for document search
export const SEARCHABLE_MIME_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  txt: 'text/plain',
  googleDoc: 'application/vnd.google-apps.document',
  googleSheet: 'application/vnd.google-apps.spreadsheet',
  googleSlide: 'application/vnd.google-apps.presentation',
}

/**
 * Search files in Google Drive using full-text search
 * Google Drive automatically indexes content of PDF, DOCX, TXT files
 */
export async function searchDrive(
  accessToken: string,
  query: string,
  options: DriveSearchOptions = {}
): Promise<DriveSearchResult[]> {
  if (!query.trim()) return []

  const {
    folderId,
    maxResults = 20,
    mimeTypes,
    includeTrashed = false
  } = options

  // Build search query
  // fullText contains 'keyword' - searches file content
  const queryParts: string[] = []
  
  // Full-text search - searches inside file content
  queryParts.push(`fullText contains '${escapeQuery(query)}'`)
  
  // Folder filter
  if (folderId) {
    queryParts.push(`'${folderId}' in parents`)
  }
  
  // Trash filter
  if (!includeTrashed) {
    queryParts.push('trashed = false')
  }
  
  // MIME type filter
  if (mimeTypes && mimeTypes.length > 0) {
    const mimeQuery = mimeTypes
      .map(m => `mimeType = '${m}'`)
      .join(' or ')
    queryParts.push(`(${mimeQuery})`)
  }

  const q = queryParts.join(' and ')
  
  const params = new URLSearchParams({
    q,
    pageSize: maxResults.toString(),
    fields: 'files(id,name,mimeType,modifiedTime,webViewLink,thumbnailLink,iconLink)',
    orderBy: 'modifiedTime desc'
  })

  const response = await fetch(`${DRIVE_API}/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error?.message || 'Drive search failed')
  }

  const data = await response.json()
  return data.files || []
}

/**
 * Search within G-Note folder only
 */
export async function searchNotesAppFolder(
  accessToken: string,
  query: string,
  maxResults = 20
): Promise<DriveSearchResult[]> {
  // First, find the G-Note folder
  const folderId = await getGNoteFolderId(accessToken)
  
  if (!folderId) {
    return []
  }

  return searchDrive(accessToken, query, {
    folderId,
    maxResults
  })
}

/**
 * Search all documents (PDF, DOCX, TXT) in G-Note folder only
 * Since app only has access to its own folder, not entire Drive
 */
export async function searchDocuments(
  accessToken: string,
  query: string,
  maxResults = 20
): Promise<DriveSearchResult[]> {
  // Search only within G-Note folder (app's scope)
  return searchNotesAppFolder(accessToken, query, maxResults)
}

/**
 * Combined search: search both note name and file content
 */
export async function searchDriveAdvanced(
  accessToken: string,
  query: string,
  options: DriveSearchOptions = {}
): Promise<{ contentResults: DriveSearchResult[]; nameResults: DriveSearchResult[] }> {
  const { maxResults = 10, folderId, includeTrashed = false } = options

  // Search by content
  const contentPromise = searchDrive(accessToken, query, {
    ...options,
    maxResults
  })

  // Search by name
  const nameQueryParts: string[] = [
    `name contains '${escapeQuery(query)}'`,
    includeTrashed ? '' : 'trashed = false'
  ].filter(Boolean)
  
  if (folderId) {
    nameQueryParts.push(`'${folderId}' in parents`)
  }

  const nameParams = new URLSearchParams({
    q: nameQueryParts.join(' and '),
    pageSize: maxResults.toString(),
    fields: 'files(id,name,mimeType,modifiedTime,webViewLink,thumbnailLink,iconLink)',
    orderBy: 'modifiedTime desc'
  })

  const namePromise = fetch(`${DRIVE_API}/files?${nameParams}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  }).then(res => res.json()).then(data => data.files || [])

  const [contentResults, nameResults] = await Promise.all([contentPromise, namePromise])

  return { contentResults, nameResults }
}

/**
 * Get file content preview/snippet
 * Useful for showing search result context
 */
export async function getFilePreview(
  accessToken: string,
  fileId: string,
  mimeType: string
): Promise<string | null> {
  try {
    // For Google Docs, export as plain text
    if (mimeType === SEARCHABLE_MIME_TYPES.googleDoc) {
      const response = await fetch(
        `${DRIVE_API}/files/${fileId}/export?mimeType=text/plain`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (response.ok) {
        const text = await response.text()
        return text.slice(0, 500) // First 500 chars
      }
    }
    
    // For text files, download directly
    if (mimeType === SEARCHABLE_MIME_TYPES.txt) {
      const response = await fetch(
        `${DRIVE_API}/files/${fileId}?alt=media`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (response.ok) {
        const text = await response.text()
        return text.slice(0, 500)
      }
    }

    return null
  } catch {
    return null
  }
}

// Helper: Get G-Note folder ID
async function getGNoteFolderId(accessToken: string): Promise<string | null> {
  const params = new URLSearchParams({
    q: "name='G-Note' and mimeType='application/vnd.google-apps.folder' and trashed=false",
    fields: 'files(id)'
  })

  const response = await fetch(`${DRIVE_API}/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })

  if (!response.ok) return null

  const data = await response.json()
  return data.files?.[0]?.id || null
}

// Helper: Escape special characters in search query
function escapeQuery(query: string): string {
  // Escape single quotes and backslashes for Google Drive API query
  return query.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

/**
 * Get MIME type display name
 */
export function getMimeTypeLabel(mimeType: string): string {
  const labels: Record<string, string> = {
    [SEARCHABLE_MIME_TYPES.pdf]: 'PDF',
    [SEARCHABLE_MIME_TYPES.docx]: 'Word',
    [SEARCHABLE_MIME_TYPES.doc]: 'Word',
    [SEARCHABLE_MIME_TYPES.txt]: 'Text',
    [SEARCHABLE_MIME_TYPES.googleDoc]: 'Google Doc',
    [SEARCHABLE_MIME_TYPES.googleSheet]: 'Google Sheet',
    [SEARCHABLE_MIME_TYPES.googleSlide]: 'Google Slides',
    'application/json': 'JSON',
  }
  return labels[mimeType] || 'File'
}

/**
 * Get file icon based on MIME type
 */
export function getMimeTypeIcon(mimeType: string): string {
  if (mimeType.includes('pdf')) return '📄'
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝'
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊'
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️'
  if (mimeType.includes('text')) return '📃'
  if (mimeType.includes('image')) return '🖼️'
  return '📁'
}
