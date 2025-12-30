/**
 * Drive Client
 * Low-level Google Drive API wrapper with Mutex for thread safety
 */
import { Mutex } from 'async-mutex'
import { useNetworkStore } from '@/stores/networkStore'
import { DriveError, type DriveErrorCode } from './types'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'

// Mutex instances for critical operations
const indexMutex = new Mutex()
const uploadMutex = new Mutex()

export class DriveClient {
  private accessToken: string | null = null

  /**
   * Set access token for API calls
   */
  setAccessToken(token: string): void {
    this.accessToken = token
  }

  /**
   * Get current access token
   */
  getAccessToken(): string | null {
    return this.accessToken
  }

  /**
   * Check if client is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.accessToken
  }

  /**
   * Check if online
   */
  private checkOnline(): boolean {
    return useNetworkStore.getState().isOnline
  }

  /**
   * Make authenticated request to Drive API
   */
  async request<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.accessToken) {
      throw new DriveError('DRIVE_AUTH_ERROR', 'Not authenticated')
    }

    if (!this.checkOnline()) {
      throw new DriveError('DRIVE_NETWORK_ERROR', 'No network connection')
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...options.headers
      }
    })

    if (!response.ok) {
      throw await this.handleErrorResponse(response)
    }

    // Handle empty responses
    const text = await response.text()
    if (!text) return {} as T
    
    try {
      return JSON.parse(text)
    } catch {
      return text as unknown as T
    }
  }

  /**
   * Make request and return raw response
   */
  async requestRaw(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    if (!this.accessToken) {
      throw new DriveError('DRIVE_AUTH_ERROR', 'Not authenticated')
    }

    if (!this.checkOnline()) {
      throw new DriveError('DRIVE_NETWORK_ERROR', 'No network connection')
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...options.headers
      }
    })

    if (!response.ok) {
      throw await this.handleErrorResponse(response)
    }

    return response
  }

  /**
   * Handle error response and convert to DriveError
   */
  private async handleErrorResponse(response: Response): Promise<DriveError> {
    const status = response.status
    let errorData: { error?: { message?: string; errors?: Array<{ reason?: string }> } } = {}
    
    try {
      errorData = await response.json()
    } catch {
      // Ignore JSON parse errors
    }

    const errorReason = errorData.error?.errors?.[0]?.reason || ''
    const errorMessage = errorData.error?.message || 'Drive API error'

    // Map status codes to error types
    let code: DriveErrorCode = 'DRIVE_NETWORK_ERROR'

    if (status === 401) {
      code = 'DRIVE_AUTH_ERROR'
    } else if (status === 403) {
      if (errorReason === 'storageQuotaExceeded' || errorMessage.includes('quota')) {
        code = 'DRIVE_QUOTA_EXCEEDED'
      } else {
        code = 'DRIVE_PERMISSION_DENIED'
      }
    } else if (status === 404) {
      code = 'DRIVE_NOT_FOUND'
    } else if (status === 412) {
      code = 'DRIVE_CONFLICT_412'
    } else if (status === 400 && errorMessage.includes('parse')) {
      code = 'DRIVE_FILE_CORRUPTED'
    }

    return new DriveError(code, `${status}: ${errorMessage}`)
  }

  // ============ Mutex-Protected Operations ============

  /**
   * Execute operation with index mutex
   * Use for operations that modify index files
   */
  async withIndexLock<T>(operation: () => Promise<T>): Promise<T> {
    return indexMutex.runExclusive(operation)
  }

  /**
   * Execute operation with upload mutex
   * Use for file upload operations
   */
  async withUploadLock<T>(operation: () => Promise<T>): Promise<T> {
    return uploadMutex.runExclusive(operation)
  }

  // ============ Basic Drive Operations ============

  /**
   * Search for files
   */
  async searchFiles(query: string, fields: string = 'files(id,name)'): Promise<{ files: Array<{ id: string; name: string }> }> {
    const url = `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}`
    return this.request(url)
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileId: string, fields: string = 'id,name,modifiedTime'): Promise<{ id: string; name: string; modifiedTime?: string }> {
    const url = `${DRIVE_API}/files/${fileId}?fields=${encodeURIComponent(fields)}`
    return this.request(url)
  }

  /**
   * Download file content
   */
  async downloadFile<T>(fileId: string): Promise<T> {
    const url = `${DRIVE_API}/files/${fileId}?alt=media`
    return this.request(url)
  }

  /**
   * Download file content as text
   */
  async downloadFileAsText(fileId: string): Promise<string> {
    const url = `${DRIVE_API}/files/${fileId}?alt=media`
    const response = await this.requestRaw(url)
    return response.text()
  }

  /**
   * Create a new file
   */
  async createFile(
    name: string,
    content: unknown,
    parentId: string
  ): Promise<string> {
    const metadata = {
      name,
      mimeType: 'application/json',
      parents: [parentId]
    }

    const form = new FormData()
    form.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    )
    form.append(
      'file',
      new Blob([JSON.stringify(content)], { type: 'application/json' })
    )

    const response = await fetch(
      `${UPLOAD_API}/files?uploadType=multipart&fields=id`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.accessToken}` },
        body: form
      }
    )

    if (!response.ok) {
      throw await this.handleErrorResponse(response)
    }

    const data = await response.json()
    return data.id
  }

  /**
   * Update existing file
   */
  async updateFile(
    fileId: string,
    content: unknown,
    ifMatch?: string
  ): Promise<void> {
    const form = new FormData()
    form.append(
      'metadata',
      new Blob([JSON.stringify({ mimeType: 'application/json' })], {
        type: 'application/json'
      })
    )
    form.append(
      'file',
      new Blob([JSON.stringify(content)], { type: 'application/json' })
    )

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`
    }

    // Add If-Match header for optimistic locking
    if (ifMatch) {
      headers['If-Match'] = ifMatch
    }

    const response = await fetch(
      `${UPLOAD_API}/files/${fileId}?uploadType=multipart`,
      {
        method: 'PATCH',
        headers,
        body: form
      }
    )

    if (!response.ok) {
      throw await this.handleErrorResponse(response)
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId: string): Promise<void> {
    const url = `${DRIVE_API}/files/${fileId}`
    await this.request(url, { method: 'DELETE' })
  }

  /**
   * Create a folder
   */
  async createFolder(name: string): Promise<string> {
    const response = await this.request<{ id: string }>(
      `${DRIVE_API}/files`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          mimeType: 'application/vnd.google-apps.folder'
        })
      }
    )
    return response.id
  }
}

// Singleton instance
export const driveClient = new DriveClient()
