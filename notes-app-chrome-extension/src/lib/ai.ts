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
