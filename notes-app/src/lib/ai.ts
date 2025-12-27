// AI Service - calls backend API with credits support

import { useCreditsStore } from '@/stores/creditsStore'
import { useAuthStore } from '@/stores/authStore'
import { useNetworkStore, NetworkRequiredError } from '@/stores/networkStore'
import type { AICreditsInfo } from '@/types'

const API_URL = import.meta.env.VITE_API_URL || ''

export type AIAction = 'summarize' | 'continue' | 'improve' | 'translate' | 'extract-tasks' | 'ask'

interface AIResponse {
  result: string
  error?: string
  code?: string
  _credits?: AICreditsInfo
}

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
  const { isOnline } = useNetworkStore.getState()
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

  const data: AIResponse = await response.json()
  
  // Handle insufficient credits
  if (response.status === 402 || data.code === 'INSUFFICIENT_CREDITS') {
    throw new InsufficientCreditsError(
      data.error || 'Insufficient AI Credits',
      (data as any).currentBalance || 0
    )
  }
  
  if (!response.ok || data.error) {
    throw new Error(data.error || 'AI request failed')
  }

  // Update credits in store from response
  if (data._credits) {
    useCreditsStore.getState().updateCreditsFromResponse(data._credits)
  }

  return data.result
}

export async function summarize(content: string): Promise<string> {
  return callAI('summarize', { content })
}

export async function continueWriting(content: string): Promise<string> {
  return callAI('continue', { content })
}

export async function improveWriting(content: string): Promise<string> {
  return callAI('improve', { content })
}

export async function translate(content: string, targetLanguage: string): Promise<string> {
  return callAI('translate', { content, targetLanguage })
}

export async function extractTasks(content: string): Promise<string> {
  return callAI('extract-tasks', { content })
}

export async function askAI(content: string, question: string): Promise<string> {
  return callAI('ask', { content, question })
}

// Languages for translation
export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'zh', name: '中文 (Chinese)' },
  { code: 'zh-tw', name: '繁體中文 (Traditional)' },
  { code: 'ja', name: '日本語 (Japanese)' },
  { code: 'ko', name: '한국어 (Korean)' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'pt', name: 'Português' },
  { code: 'it', name: 'Italiano' },
  { code: 'ru', name: 'Русский' },
  { code: 'ar', name: 'العربية (Arabic)' },
  { code: 'hi', name: 'हिन्दी (Hindi)' },
  { code: 'th', name: 'ไทย (Thai)' },
  { code: 'id', name: 'Bahasa Indonesia' },
  { code: 'ms', name: 'Bahasa Melayu' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'pl', name: 'Polski' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'uk', name: 'Українська' },
  { code: 'cs', name: 'Čeština' },
  { code: 'sv', name: 'Svenska' },
  { code: 'da', name: 'Dansk' },
  { code: 'fi', name: 'Suomi' },
  { code: 'no', name: 'Norsk' },
  { code: 'el', name: 'Ελληνικά' },
  { code: 'he', name: 'עברית (Hebrew)' },
  { code: 'ro', name: 'Română' },
  { code: 'hu', name: 'Magyar' }
]
