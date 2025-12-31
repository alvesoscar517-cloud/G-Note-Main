import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, format, type Locale } from 'date-fns'
import {
  enUS,
  vi,
  ja,
  ko,
  zhCN,
  zhTW,
  de,
  fr,
  es,
  ptBR,
  it,
  nl,
  ar,
  hi,
  tr,
  pl,
  th,
  id,
} from 'date-fns/locale'
import i18n from '@/locales'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Map i18n language codes to date-fns locales
const dateFnsLocales: Record<string, Locale> = {
  'en': enUS,
  'vi': vi,
  'ja': ja,
  'ko': ko,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  'de': de,
  'fr': fr,
  'es': es,
  'pt-BR': ptBR,
  'it': it,
  'nl': nl,
  'ar': ar,
  'hi': hi,
  'tr': tr,
  'pl': pl,
  'th': th,
  'id': id,
}

/**
 * Format a timestamp to a human-readable relative time string
 * Uses date-fns for proper i18n support and handles all time ranges
 * (seconds, minutes, hours, days, weeks, months, years)
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffInDays = Math.floor((now.getTime() - date.getTime()) / 86400000)
  
  // Get the appropriate locale for date-fns
  const locale = dateFnsLocales[i18n.language] || enUS
  
  // For dates older than 7 days, show the actual date
  if (diffInDays >= 7) {
    return format(date, 'dd/MM/yyyy', { locale })
  }
  
  // For recent dates, show relative time (e.g., "5 minutes ago", "2 hours ago")
  return formatDistanceToNow(date, { 
    addSuffix: true,
    locale 
  })
}

export function getPlainText(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || div.innerText || ''
}
