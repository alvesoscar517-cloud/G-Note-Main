// AI Service - calls backend API with credits support

import { useCreditsStore } from '@/stores/creditsStore'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore, NetworkRequiredError } from '@/stores/appStore'
import type { AICreditsInfo } from '@/types'

const API_URL = import.meta.env.VITE_API_URL || ''

export type AIAction = 'summarize' | 'continue' | 'improve' | 'translate' | 'extract-tasks' | 'ask' | 'tone' | 'ocr'



export class InsufficientCreditsError extends Error {
  currentBalance: number

  constructor(message: string, currentBalance: number) {
    super(message)
    this.name = 'InsufficientCreditsError'
    this.currentBalance = currentBalance
  }
}

async function callAI(endpoint: string, body: Record<string, string>): Promise<string> {
  // Check network status first
  const { isOnline } = useAppStore.getState()
  if (!isOnline) {
    throw new NetworkRequiredError('AI features require an internet connection')
  }

  if (!API_URL) {
    throw new Error('API URL not configured')
  }

  // Get user ID for credits tracking
  const userId = useAuthStore.getState().user?.id

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  if (userId) {
    headers['x-user-id'] = userId
  }

  const response = await fetch(`${API_URL}/ai/${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  })

  // Handle errors
  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch { }

    if (response.status === 402 || (errorData && errorData.code === 'INSUFFICIENT_CREDITS')) {
      throw new InsufficientCreditsError(
        errorData?.error || 'Insufficient AI Credits',
        errorData?.currentBalance || 0
      )
    }
    throw new Error(errorData?.error || `AI request failed with status ${response.status}`)
  }

  // Stream reader
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Response body is not a stream')

  const decoder = new TextDecoder()
  let fullText = ''
  let creditsInfo: AICreditsInfo | undefined

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n')

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6))
          if (data.text) {
            fullText += data.text
          }
          if (data._credits) {
            creditsInfo = data._credits
          }
          if (data.error) {
            throw new Error(data.error)
          }
        } catch (e) {
          // Ignore
        }
      }
    }
  }

  if (creditsInfo) {
    useCreditsStore.getState().updateCreditsFromResponse(creditsInfo)
  }

  return fullText
}

export async function callAIStream(
  endpoint: string,
  body: Record<string, string>,
  onChunk: (text: string) => void
): Promise<string> {
  // Check network status first
  const { isOnline } = useAppStore.getState()
  if (!isOnline) {
    throw new NetworkRequiredError('AI features require an internet connection')
  }

  if (!API_URL) {
    throw new Error('API URL not configured')
  }

  // Get user ID for credits tracking
  const userId = useAuthStore.getState().user?.id

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  if (userId) {
    headers['x-user-id'] = userId
  }

  const response = await fetch(`${API_URL}/ai/${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  })

  // Handle errors
  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch { }

    if (response.status === 402 || (errorData && errorData.code === 'INSUFFICIENT_CREDITS')) {
      throw new InsufficientCreditsError(
        errorData?.error || 'Insufficient AI Credits',
        errorData?.currentBalance || 0
      )
    }
    throw new Error(errorData?.error || `AI request failed with status ${response.status}`)
  }

  // Stream reader
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Response body is not a stream')

  const decoder = new TextDecoder()
  let fullText = ''
  let creditsInfo: AICreditsInfo | undefined

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n')

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6))
          if (data.text) {
            fullText += data.text
            onChunk(data.text)
          }
          if (data._credits) {
            creditsInfo = data._credits
          }
          if (data.error) {
            throw new Error(data.error)
          }
        } catch (e) {
          // Ignore
        }
      }
    }
  }

  if (creditsInfo) {
    useCreditsStore.getState().updateCreditsFromResponse(creditsInfo)
  }

  return fullText
}

export async function summarize(content: string): Promise<string> {
  return callAI('summarize', { content })
}

export async function summarizeStream(content: string, onChunk: (text: string) => void): Promise<string> {
  return callAIStream('summarize', { content }, onChunk)
}

export async function continueWriting(content: string): Promise<string> {
  return callAI('continue', { content })
}

export async function continueWritingStream(content: string, onChunk: (text: string) => void): Promise<string> {
  return callAIStream('continue', { content }, onChunk)
}

export async function improveWriting(content: string): Promise<string> {
  return callAI('improve', { content })
}

export async function improveWritingStream(content: string, onChunk: (text: string) => void): Promise<string> {
  return callAIStream('improve', { content }, onChunk)
}

export async function translate(content: string, targetLanguage: string): Promise<string> {
  return callAI('translate', { content, targetLanguage })
}

export async function translateStream(content: string, targetLanguage: string, onChunk: (text: string) => void): Promise<string> {
  return callAIStream('translate', { content, targetLanguage }, onChunk)
}

export async function extractTasks(content: string): Promise<string> {
  return callAI('extract-tasks', { content })
}

export async function extractTasksStream(content: string, onChunk: (text: string) => void): Promise<string> {
  return callAIStream('extract-tasks', { content }, onChunk)
}

export async function askAI(content: string, question: string): Promise<string> {
  return callAI('ask', { content, question })
}

export async function askAIStream(content: string, question: string, onChunk: (text: string) => void): Promise<string> {
  return callAIStream('ask', { content, question }, onChunk)
}

export async function changeTone(content: string, tone: string): Promise<string> {
  return callAI('tone', { content, tone })
}

export async function changeToneStream(content: string, tone: string, onChunk: (text: string) => void): Promise<string> {
  return callAIStream('tone', { content, tone }, onChunk)
}

export async function analyzeImageStream(file: File, type: string, onChunk: (text: string) => void): Promise<string> {
  // Check network status first
  const { isOnline } = useAppStore.getState()
  if (!isOnline) {
    throw new NetworkRequiredError('AI features require an internet connection')
  }

  if (!API_URL) {
    throw new Error('API URL not configured')
  }

  // Get user ID for credits tracking
  const userId = useAuthStore.getState().user?.id

  const headers: Record<string, string> = {}

  if (userId) {
    headers['x-user-id'] = userId
  }

  const formData = new FormData()
  formData.append('image', file)
  formData.append('type', type)

  const response = await fetch(`${API_URL}/ai/analyze-image`, {
    method: 'POST',
    headers, // Content-Type is set automatically by fetch for FormData
    body: formData
  })

  // Handle errors
  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      // If not JSON, it might be a text error
    }

    if (response.status === 402 || (errorData && errorData.code === 'INSUFFICIENT_CREDITS')) {
      throw new InsufficientCreditsError(
        errorData?.error || 'Insufficient AI Credits',
        errorData?.currentBalance || 0
      )
    }

    throw new Error(errorData?.error || `AI request failed with status ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('Response body is not a stream')

  const decoder = new TextDecoder()
  let fullText = ''
  let creditsInfo: AICreditsInfo | undefined

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n')

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6))
          if (data.text) {
            fullText += data.text
            onChunk(data.text)
          }
          if (data._credits) {
            creditsInfo = data._credits
            // Update credits in store if available
            if (creditsInfo) {
              const userId = useAuthStore.getState().user?.id
              if (userId) {
                useCreditsStore.getState().refreshCredits(userId)
              }
            }
          }
          if (data.error) {
            throw new Error(data.error)
          }
        } catch (e) {
          console.error('Error parsing SSE data:', e)
        }
      }
    }
  }

  return fullText
}

// Languages for translation with country codes for flags
export const LANGUAGES = [
  { code: 'en', name: 'English', countryCode: 'us' },
  { code: 'vi', name: 'Tiếng Việt', countryCode: 'vn' },
  { code: 'zh', name: '中文', countryCode: 'cn' },
  { code: 'zh-tw', name: '繁體中文', countryCode: 'tw' },
  { code: 'ja', name: '日本語', countryCode: 'jp' },
  { code: 'ko', name: '한국어', countryCode: 'kr' },
  { code: 'fr', name: 'Français', countryCode: 'fr' },
  { code: 'de', name: 'Deutsch', countryCode: 'de' },
  { code: 'es', name: 'Español', countryCode: 'es' },
  { code: 'pt', name: 'Português', countryCode: 'br' },
  { code: 'it', name: 'Italiano', countryCode: 'it' },
  { code: 'ru', name: 'Русский', countryCode: 'ru' },
  { code: 'ar', name: 'العربية', countryCode: 'sa' },
  { code: 'hi', name: 'हिन्दी', countryCode: 'in' },
  { code: 'th', name: 'ไทย', countryCode: 'th' },
  { code: 'id', name: 'Indonesia', countryCode: 'id' },
  { code: 'ms', name: 'Melayu', countryCode: 'my' },
  { code: 'nl', name: 'Nederlands', countryCode: 'nl' },
  { code: 'pl', name: 'Polski', countryCode: 'pl' },
  { code: 'tr', name: 'Türkçe', countryCode: 'tr' },
  { code: 'uk', name: 'Українська', countryCode: 'ua' },
  { code: 'cs', name: 'Čeština', countryCode: 'cz' },
  { code: 'sv', name: 'Svenska', countryCode: 'se' },
  { code: 'da', name: 'Dansk', countryCode: 'dk' },
  { code: 'fi', name: 'Suomi', countryCode: 'fi' },
  { code: 'no', name: 'Norsk', countryCode: 'no' },
  { code: 'el', name: 'Ελληνικά', countryCode: 'gr' },
  { code: 'he', name: 'עברית', countryCode: 'il' },
  { code: 'ro', name: 'Română', countryCode: 'ro' },
  { code: 'hu', name: 'Magyar', countryCode: 'hu' }
]

// Tone options
export const TONES = [
  { id: 'professional', labelKey: 'ai.tone.professional', icon: 'Briefcase' },
  { id: 'formalEmail', labelKey: 'ai.tone.formalEmail', icon: 'Mail' },
  { id: 'socialMedia', labelKey: 'ai.tone.socialMedia', icon: 'Share2' },
  { id: 'casual', labelKey: 'ai.tone.casual', icon: 'Coffee' },
  { id: 'friendly', labelKey: 'ai.tone.friendly', icon: 'Smile' },
  { id: 'confident', labelKey: 'ai.tone.confident', icon: 'Zap' }
]
