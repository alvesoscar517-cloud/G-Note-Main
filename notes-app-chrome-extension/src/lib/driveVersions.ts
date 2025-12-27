import type { Note } from '@/types'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const MAX_VERSIONS = 100

export interface NoteVersion {
  id: string
  noteId: string
  modifiedTime: string
  modifiedBy?: string
  isCheckpoint?: boolean
}

export interface VersionContent {
  note: Note
  modifiedTime: string
}

class DriveVersions {
  private accessToken: string | null = null

  setAccessToken(token: string) {
    this.accessToken = token
  }

  private async request(url: string, options: RequestInit = {}) {
    if (!this.accessToken) throw new Error('Not authenticated')
    
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...options.headers
      }
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error?.message || `Drive API error: ${response.status}`)
    }

    return response
  }

  // List versions for a note file
  async listVersions(fileId: string): Promise<NoteVersion[]> {
    const url = `${DRIVE_API}/files/${fileId}/revisions?fields=revisions(id,modifiedTime,lastModifyingUser)&pageSize=${MAX_VERSIONS}`
    const response = await this.request(url)
    const data = await response.json()

    if (!data.revisions) return []

    return data.revisions.map((rev: any) => ({
      id: rev.id,
      noteId: fileId,
      modifiedTime: rev.modifiedTime,
      modifiedBy: rev.lastModifyingUser?.displayName || rev.lastModifyingUser?.emailAddress
    })).reverse() // Newest first
  }

  // Get content of a specific version
  async getVersionContent(fileId: string, revisionId: string): Promise<VersionContent | null> {
    try {
      const url = `${DRIVE_API}/files/${fileId}/revisions/${revisionId}?alt=media`
      const response = await this.request(url)
      const data = await response.json()
      
      // Get revision metadata for modifiedTime
      const metaUrl = `${DRIVE_API}/files/${fileId}/revisions/${revisionId}?fields=modifiedTime`
      const metaResponse = await this.request(metaUrl)
      const meta = await metaResponse.json()

      return {
        note: data,
        modifiedTime: meta.modifiedTime
      }
    } catch (error) {
      console.error('Failed to get version content:', error)
      return null
    }
  }

  // Smart pruning: keep recent + daily + weekly versions
  filterVersionsToKeep(versions: NoteVersion[]): NoteVersion[] {
    if (versions.length <= MAX_VERSIONS) return versions

    const kept: NoteVersion[] = []
    const now = new Date()

    // Keep 10 most recent
    kept.push(...versions.slice(0, 10))

    // For next 10: keep 1 per day
    const dailyVersions = versions.slice(10, 50)
    const dailyKept = new Map<string, NoteVersion>()
    
    for (const v of dailyVersions) {
      const date = new Date(v.modifiedTime).toDateString()
      if (!dailyKept.has(date) && dailyKept.size < 10) {
        dailyKept.set(date, v)
      }
    }
    kept.push(...dailyKept.values())

    // For remaining: keep 1 per week
    const weeklyVersions = versions.slice(50)
    const weeklyKept = new Map<string, NoteVersion>()
    
    for (const v of weeklyVersions) {
      const date = new Date(v.modifiedTime)
      const weekKey = `${date.getFullYear()}-W${Math.floor((date.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000))}`
      if (!weeklyKept.has(weekKey) && weeklyKept.size < 10) {
        weeklyKept.set(weekKey, v)
      }
    }
    kept.push(...weeklyKept.values())

    // Always keep checkpoints
    const checkpoints = versions.filter(v => v.isCheckpoint && !kept.includes(v))
    kept.push(...checkpoints.slice(0, 5))

    return kept.slice(0, MAX_VERSIONS)
  }
}

export const driveVersions = new DriveVersions()
