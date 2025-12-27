/**
 * Google Drive Export/Import utilities
 * Tận dụng khả năng convert của Google Drive API để export PDF/DOCX
 * và import từ các file document
 */

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'

export type ExportFormat = 'pdf' | 'docx' | 'html' | 'md'

// Supported image formats for OCR
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif']
const IMAGE_MIMETYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp', 'image/tiff']

const EXPORT_MIMETYPES: Record<ExportFormat, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  html: 'text/html',
  md: 'text/plain'
}

const FILE_EXTENSIONS: Record<ExportFormat, string> = {
  pdf: '.pdf',
  docx: '.docx',
  html: '.html',
  md: '.md'
}

/**
 * Check if file is an image
 */
export function isImageFile(file: File): boolean {
  const fileName = file.name.toLowerCase()
  const fileType = file.type.toLowerCase()
  
  return IMAGE_MIMETYPES.includes(fileType) || 
         IMAGE_EXTENSIONS.some(ext => fileName.endsWith(ext))
}

/**
 * Export note content to PDF or DOCX using Google Drive conversion
 */
export async function exportNote(
  accessToken: string,
  title: string,
  htmlContent: string,
  format: ExportFormat
): Promise<Blob> {
  // For HTML and MD, no need to use Google Drive
  if (format === 'html') {
    const fullHtml = wrapHtmlContent(title, htmlContent)
    return new Blob([fullHtml], { type: 'text/html' })
  }
  
  if (format === 'md') {
    const markdown = htmlToMarkdown(htmlContent)
    return new Blob([`# ${title}\n\n${markdown}`], { type: 'text/plain' })
  }

  // For PDF and DOCX, use Google Drive conversion
  const metadata = {
    name: `temp-export-${Date.now()}`,
    mimeType: 'application/vnd.google-apps.document'
  }
  
  const fullHtml = wrapHtmlContent(title, htmlContent)
  
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', new Blob([fullHtml], { type: 'text/html' }))

  // 1. Upload HTML as Google Doc (auto-convert)
  const uploadRes = await fetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form
  })
  
  if (!uploadRes.ok) {
    const error = await uploadRes.json().catch(() => ({}))
    throw new Error(error.error?.message || 'Failed to upload for conversion')
  }
  
  const { id: fileId } = await uploadRes.json()

  try {
    // 2. Export to desired format
    const exportRes = await fetch(
      `${DRIVE_API}/files/${fileId}/export?mimeType=${encodeURIComponent(EXPORT_MIMETYPES[format])}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    
    if (!exportRes.ok) {
      throw new Error('Failed to export file')
    }
    
    return await exportRes.blob()
    
  } finally {
    // 3. Cleanup - delete temp file (fire and forget)
    fetch(`${DRIVE_API}/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` }
    }).catch(() => {})
  }
}

/**
 * Import document from file and convert to HTML
 * Supports: PDF, DOCX, TXT, MD, HTML, Images (with OCR)
 */
export async function importDocument(
  accessToken: string,
  file: File,
  ocrLanguage: string = 'en'
): Promise<{ title: string; content: string; isOCR: boolean }> {
  const fileName = file.name
  const fileType = file.type
  const baseName = fileName.replace(/\.[^/.]+$/, '')
  const isImage = isImageFile(file)
  
  // Plain text files - read directly
  if (fileType === 'text/plain' || fileName.endsWith('.txt') || fileName.endsWith('.md')) {
    const text = await file.text()
    const isMarkdown = fileName.endsWith('.md')
    return {
      title: baseName,
      content: isMarkdown ? markdownToHtml(text) : `<p>${escapeHtml(text).replace(/\n/g, '</p><p>')}</p>`,
      isOCR: false
    }
  }
  
  // HTML files - read directly
  if (fileType === 'text/html' || fileName.endsWith('.html') || fileName.endsWith('.htm')) {
    const html = await file.text()
    const titleMatch = html.match(/<title>([^<]*)<\/title>/i)
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
    return {
      title: titleMatch?.[1] || baseName,
      content: bodyMatch?.[1] || html,
      isOCR: false
    }
  }
  
  // Images - use Google Drive OCR
  if (isImage) {
    const result = await convertWithGoogleDrive(accessToken, file, baseName, ocrLanguage)
    return { ...result, isOCR: true }
  }
  
  // PDF and DOCX - use Google Drive conversion
  if (fileType === 'application/pdf' || 
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileName.endsWith('.pdf') || 
      fileName.endsWith('.docx')) {
    const result = await convertWithGoogleDrive(accessToken, file, baseName, ocrLanguage)
    return { ...result, isOCR: false }
  }
  
  throw new Error('Unsupported file format')
}

/**
 * Convert PDF/DOCX/Image to HTML using Google Drive
 */
async function convertWithGoogleDrive(
  accessToken: string,
  file: File,
  baseName: string,
  ocrLanguage: string = 'en'
): Promise<{ title: string; content: string }> {
  const metadata = {
    name: `temp-import-${Date.now()}`,
    mimeType: 'application/vnd.google-apps.document'
  }
  
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', file)

  // 1. Upload and convert to Google Doc (with OCR for images/scanned PDFs)
  const uploadRes = await fetch(
    `${UPLOAD_API}/files?uploadType=multipart&ocrLanguage=${ocrLanguage}&fields=id`, 
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form
    }
  )
  
  if (!uploadRes.ok) {
    throw new Error('Failed to upload file for conversion')
  }
  
  const { id: fileId } = await uploadRes.json()

  try {
    // 2. Export as HTML
    const exportRes = await fetch(
      `${DRIVE_API}/files/${fileId}/export?mimeType=text/html`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    
    if (!exportRes.ok) {
      throw new Error('Failed to convert file')
    }
    
    const html = await exportRes.text()
    
    // Extract body content
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
    const content = bodyMatch?.[1] || html
    
    // Clean up Google's HTML
    const cleanedContent = cleanGoogleHtml(content)
    
    return {
      title: baseName,
      content: cleanedContent
    }
    
  } finally {
    // 3. Cleanup
    fetch(`${DRIVE_API}/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` }
    }).catch(() => {})
  }
}

/**
 * Trigger file download in browser
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Get safe filename from title
 */
export function getSafeFilename(title: string, format: ExportFormat): string {
  const safeName = (title || 'Untitled').replace(/[<>:"/\\|?*]/g, '_').trim()
  return safeName + FILE_EXTENSIONS[format]
}

// Helper functions

function wrapHtmlContent(title: string, content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title || 'Untitled')}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1, h2, h3 { margin-top: 1.5em; margin-bottom: 0.5em; }
    p { margin: 0.5em 0; }
    ul, ol { margin: 0.5em 0; padding-left: 2em; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
    pre { background: #f4f4f4; padding: 12px; border-radius: 6px; overflow-x: auto; }
    img { max-width: 100%; height: auto; }
    blockquote { border-left: 3px solid #ccc; margin: 1em 0; padding-left: 1em; color: #666; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title || 'Untitled')}</h1>
  ${content}
</body>
</html>`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function htmlToMarkdown(html: string): string {
  // Basic HTML to Markdown conversion
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    .replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~')
    .replace(/<strike[^>]*>(.*?)<\/strike>/gi, '~~$1~~')
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)')
    .replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<ul[^>]*>|<\/ul>/gi, '\n')
    .replace(/<ol[^>]*>|<\/ol>/gi, '\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function markdownToHtml(markdown: string): string {
  // Basic Markdown to HTML conversion
  return markdown
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<h[1-3]>)/g, '$1')
    .replace(/(<\/h[1-3]>)<\/p>/g, '$1')
    .replace(/<p>(<ul>)/g, '$1')
    .replace(/(<\/ul>)<\/p>/g, '$1')
}

function cleanGoogleHtml(html: string): string {
  return html
    // Remove Google's style tags and classes
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/\s*class="[^"]*"/gi, '')
    .replace(/\s*style="[^"]*"/gi, '')
    .replace(/\s*id="[^"]*"/gi, '')
    // Remove empty spans
    .replace(/<span[^>]*>\s*<\/span>/gi, '')
    // Simplify nested spans
    .replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, '$1')
    // Remove Google's wrapper divs
    .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1')
    // Clean up whitespace
    .replace(/\n\s*\n/g, '\n')
    .trim()
}
