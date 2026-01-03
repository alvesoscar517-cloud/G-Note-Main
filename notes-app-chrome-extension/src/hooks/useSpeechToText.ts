import { useState, useCallback, useEffect, useRef } from 'react'

// Language mapping from i18n locale to Web Speech API language code
const LOCALE_TO_SPEECH_LANG: Record<string, string> = {
  'en': 'en-US',
  'vi': 'vi-VN',
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
  'ja': 'ja-JP',
  'ko': 'ko-KR',
  'es': 'es-ES',
  'fr': 'fr-FR',
  'de': 'de-DE',
  'it': 'it-IT',
  'pt-BR': 'pt-BR',
  'nl': 'nl-NL',
  'pl': 'pl-PL',
  'tr': 'tr-TR',
  'ar': 'ar-SA',
  'hi': 'hi-IN',
  'th': 'th-TH',
  'id': 'id-ID',
}

// Check if running in Chrome Extension context
const isExtensionContext = typeof chrome !== 'undefined' && !!chrome.runtime?.id

export type SpeechStatus = 'idle' | 'listening' | 'error'

interface UseSpeechToTextOptions {
  locale?: string
  continuous?: boolean
  interimResults?: boolean
  onResult?: (transcript: string, isFinal: boolean, replaceLength?: number) => void
  onError?: (error: string) => void
}

interface UseSpeechToTextReturn {
  isSupported: boolean
  status: SpeechStatus
  transcript: string
  interimTranscript: string
  error: string | null
  startListening: () => void
  stopListening: () => void
  toggleListening: () => void
}

// Offscreen document management
let offscreenCreating: Promise<void> | null = null

async function setupOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL('offscreen.html')
  
  // Check if offscreen document already exists (Chrome 116+)
  if ('getContexts' in chrome.runtime) {
    const contexts = await (chrome.runtime as typeof chrome.runtime & {
      getContexts: (filter: { contextTypes: string[]; documentUrls: string[] }) => Promise<{ length: number }[]>
    }).getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [offscreenUrl]
    })
    if (contexts.length > 0) return
  }

  if (offscreenCreating) {
    await offscreenCreating
    return
  }

  offscreenCreating = chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: [chrome.offscreen.Reason.USER_MEDIA],
    justification: 'Speech recognition requires access to microphone'
  })

  await offscreenCreating
  offscreenCreating = null
}

/**
 * Speech-to-text hook for Chrome Extension using Offscreen Document
 */
export function useSpeechToText(options: UseSpeechToTextOptions = {}): UseSpeechToTextReturn {
  const {
    locale = 'en',
    onResult,
    onError,
  } = options

  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<SpeechStatus>('idle')
  const [isSupported, setIsSupported] = useState(true)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  
  const lastInterimLengthRef = useRef(0)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  // Listen for messages from offscreen document
  useEffect(() => {
    if (!isExtensionContext) {
      console.log('[SpeechToText] Not in extension context')
      return
    }

    const handleMessage = (message: { type: string; [key: string]: unknown }) => {
      switch (message.type) {
        case 'speech-started':
          console.log('[SpeechToText] Started')
          setStatus('listening')
          break

        case 'speech-ended':
          console.log('[SpeechToText] Ended')
          setStatus('idle')
          lastInterimLengthRef.current = 0
          break

        case 'speech-error':
          console.error('[SpeechToText] Error:', message.error)
          setError(message.error as string)
          setStatus('error')
          onError?.(message.error as string)
          break

        case 'speech-result': {
          const { finalTranscript: final, interimTranscript: interim } = message as {
            finalTranscript: string
            interimTranscript: string
            type: string
          }

          if (final) {
            // Replace interim with final
            const replaceLength = lastInterimLengthRef.current
            onResultRef.current?.(final, true, replaceLength)
            setTranscript(prev => prev + final)
            setInterimTranscript('')
            lastInterimLengthRef.current = 0
          } else if (interim) {
            // Update interim
            const replaceLength = lastInterimLengthRef.current
            onResultRef.current?.(interim, false, replaceLength)
            setInterimTranscript(interim)
            lastInterimLengthRef.current = interim.length
          }
          break
        }
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [onError])

  // Check support on mount
  useEffect(() => {
    if (!isExtensionContext) {
      setIsSupported(false)
      return
    }

    // Check if offscreen API is available
    if (!chrome.offscreen) {
      console.warn('[SpeechToText] Offscreen API not available')
      setIsSupported(false)
      return
    }

    // Setup offscreen document and check support
    setupOffscreenDocument()
      .then(() => {
        return new Promise<boolean>((resolve) => {
          chrome.runtime.sendMessage(
            { target: 'offscreen', type: 'check-support' },
            (response) => {
              if (chrome.runtime.lastError) {
                console.error('[SpeechToText] Check support error:', chrome.runtime.lastError)
                resolve(false)
              } else {
                resolve(response?.supported ?? false)
              }
            }
          )
        })
      })
      .then((supported) => {
        console.log('[SpeechToText] Support check:', supported)
        setIsSupported(supported)
      })
      .catch((err) => {
        console.error('[SpeechToText] Setup error:', err)
        setIsSupported(false)
      })
  }, [])

  const startListening = useCallback(async () => {
    if (!isSupported) {
      const msg = 'Speech recognition not supported'
      setError(msg)
      onError?.(msg)
      return
    }

    if (status === 'listening') return

    setError(null)
    setTranscript('')
    setInterimTranscript('')
    lastInterimLengthRef.current = 0

    try {
      await setupOffscreenDocument()
      
      const lang = LOCALE_TO_SPEECH_LANG[locale] || 'en-US'
      console.log('[SpeechToText] Starting with language:', lang)

      chrome.runtime.sendMessage(
        { target: 'offscreen', type: 'start-speech', language: lang },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('[SpeechToText] Start error:', chrome.runtime.lastError)
            setError(chrome.runtime.lastError.message || 'Failed to start')
            setStatus('error')
          } else if (!response?.success) {
            console.error('[SpeechToText] Start failed:', response?.error)
            setError(response?.error || 'Failed to start')
            setStatus('error')
          }
        }
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start'
      console.error('[SpeechToText] Error:', msg)
      setError(msg)
      setStatus('error')
      onError?.(msg)
    }
  }, [isSupported, status, locale, onError])

  const stopListening = useCallback(() => {
    if (status !== 'listening') return

    chrome.runtime.sendMessage(
      { target: 'offscreen', type: 'stop-speech' },
      () => {
        if (chrome.runtime.lastError) {
          console.error('[SpeechToText] Stop error:', chrome.runtime.lastError)
        }
      }
    )
  }, [status])

  const toggleListening = useCallback(() => {
    if (status === 'listening') {
      stopListening()
    } else {
      startListening()
    }
  }, [status, startListening, stopListening])

  return {
    isSupported,
    status,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    toggleListening,
  }
}
