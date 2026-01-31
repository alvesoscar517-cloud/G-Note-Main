import type { Editor } from '@tiptap/react'

/**
 * Export table as CSV
 * 
 * Extracts table data from the editor and formats it as CSV.
 * Handles cell content escaping for quotes and commas.
 * 
 * @param editor - The Tiptap editor instance
 * @returns CSV string or empty string if no table found
 */
export function exportTableAsCSV(editor: Editor): string {
  const { state } = editor
  const { selection } = state
  
  // Find the table node
  let tableNode = null
  let depth = selection.$anchor.depth
  
  while (depth > 0) {
    const node = selection.$anchor.node(depth)
    if (node.type.name === 'table') {
      tableNode = node
      break
    }
    depth--
  }
  
  if (!tableNode) return ''
  
  const rows: string[][] = []
  
  // Extract table data
  tableNode.forEach((row) => {
    const cells: string[] = []
    row.forEach((cell) => {
      // Get text content and escape quotes
      const content = cell.textContent.replace(/"/g, '""')
      cells.push(content)
    })
    rows.push(cells)
  })
  
  // Format as CSV
  return rows.map(row => 
    row.map(cell => `"${cell}"`).join(',')
  ).join('\n')
}

/**
 * Export table as Markdown
 * 
 * Extracts table data from the editor and formats it as Markdown table.
 * 
 * @param editor - The Tiptap editor instance
 * @returns Markdown table string or empty string if no table found
 */
export function exportTableAsMarkdown(editor: Editor): string {
  const { state } = editor
  const { selection } = state
  
  // Find the table node
  let tableNode = null
  let depth = selection.$anchor.depth
  
  while (depth > 0) {
    const node = selection.$anchor.node(depth)
    if (node.type.name === 'table') {
      tableNode = node
      break
    }
    depth--
  }
  
  if (!tableNode) return ''
  
  const rows: string[][] = []
  
  // Extract table data
  tableNode.forEach((row) => {
    const cells: string[] = []
    row.forEach((cell) => {
      // Get text content and escape pipes
      const content = cell.textContent.replace(/\|/g, '\\|')
      cells.push(content)
    })
    rows.push(cells)
  })
  
  if (rows.length === 0) return ''
  
  // Format as Markdown table
  const lines: string[] = []
  
  // Header row
  lines.push('| ' + rows[0].join(' | ') + ' |')
  
  // Separator row
  lines.push('| ' + rows[0].map(() => '---').join(' | ') + ' |')
  
  // Data rows
  for (let i = 1; i < rows.length; i++) {
    lines.push('| ' + rows[i].join(' | ') + ' |')
  }
  
  return lines.join('\n')
}

/**
 * Import CSV as table
 * 
 * Parses CSV data and creates a table in the editor.
 * Handles quoted values and escaped quotes.
 * 
 * @param editor - The Tiptap editor instance
 * @param csv - CSV string to import
 */
export function importCSVAsTable(editor: Editor, csv: string): void {
  const rows = parseCSV(csv)
  
  if (rows.length === 0) return
  
  const cols = Math.max(...rows.map(r => r.length))
  
  // Insert table
  editor.chain().focus().insertTable({
    rows: rows.length,
    cols: cols,
    withHeaderRow: true
  }).run()
  
  // TODO: Fill cells with data
  // This requires navigating to each cell and inserting content
  // which is complex with Tiptap's API
}

/**
 * Parse CSV string into 2D array
 * 
 * Handles quoted values and escaped quotes.
 * 
 * @param csv - CSV string to parse
 * @returns 2D array of cell values
 */
function parseCSV(csv: string): string[][] {
  const rows: string[][] = []
  const lines = csv.split('\n')
  
  for (const line of lines) {
    if (!line.trim()) continue
    
    const cells: string[] = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      const nextChar = line[i + 1]
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"'
          i++ // Skip next quote
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        // End of cell
        cells.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    
    // Add last cell
    cells.push(current.trim())
    rows.push(cells)
  }
  
  return rows
}

/**
 * Download string as file
 * 
 * Creates a download link and triggers download.
 * 
 * @param content - File content
 * @param filename - Name of the file to download
 * @param mimeType - MIME type of the file
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
