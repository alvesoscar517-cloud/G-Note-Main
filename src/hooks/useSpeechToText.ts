import { useState, useCallback, useEffect, useRef } from 'react'
import SpeechRecognition, { useSpeechRecognition as useLibSpeechRecognition } from 'react-speech-recognition'
import { useIsTouchDevice } from './useIsTouchDevice'

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

export type SpeechStatus = 'idle' | 'listening' | 'error'

interface UseSpeechToTextOptions {
  locale?: string
  continuous?: boolean
  interimResults?: boolean
  onResult?: (transcript: string, isFinal: boolean) => void
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

/**
 * Speech-to-text hook using react-speech-recognition library
 * Provides a consistent API for speech recognition across browsers
 */
export function useSpeechToText(options: UseSpeechToTextOptions = {}): UseSpeechToTextReturn {
  const {
    locale = 'en',
    continuous = true,
    interimResults = true,
    onResult,
    onError,
  } = options

  const isTouchDevice = useIsTouchDevice()
  const [error, setError] = useState<string | null>(null)
  const [accumulatedTranscript, setAccumulatedTranscript] = useState('')
  const [isManuallyListening, setIsManuallyListening] = useState(false)
  const lastTranscriptRef = useRef('')

  // Use the library's hook
  const {
    transcript: libTranscript,
    interimTranscript: libInterimTranscript,
    listening,
    browserSupportsSpeechRecognition,
    resetTranscript,
  } = useLibSpeechRecognition()

  // Determine status based on library state and manual state
  const status: SpeechStatus = error ? 'error' : (listening || isManuallyListening) ? 'listening' : 'idle'

  // Track transcript changes and call onResult callback
  useEffect(() => {
    if (libTranscript && libTranscript !== lastTranscriptRef.current) {
      const newText = libTranscript.slice(lastTranscriptRef.current.length).trim()
      if (newText) {
        onResult?.(newText, true)
        lastTranscriptRef.current = libTranscript
        setAccumulatedTranscript(libTranscript)
      }
    }
  }, [libTranscript, onResult])

  // Track interim transcript changes
  useEffect(() => {
    if (libInterimTranscript) {
      onResult?.(libInterimTranscript.trim(), false)
    }
  }, [libInterimTranscript, onResult])

  // Sync manual listening state with actual listening state
  useEffect(() => {
    if (!listening && isManuallyListening) {
      // Recognition stopped unexpectedly, update our state
      setIsManuallyListening(false)
    }
  }, [listening, isManuallyListening])

  const startListening = useCallback(async () => {
    if (!browserSupportsSpeechRecognition) {
      const errorMsg = 'Speech recognition is not supported in this browser'
      setError(errorMsg)
      onError?.(errorMsg)
      return
    }

    setError(null)
    setAccumulatedTranscript('')
    lastTranscriptRef.current = ''
    resetTranscript()
    setIsManuallyListening(true)

    try {
      await SpeechRecognition.startListening({
        continuous,
        interimResults,
        language: LOCALE_TO_SPEECH_LANG[locale] || 'en-US',
      })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start speech recognition'
      setError(errorMsg)
      setIsManuallyListening(false)
      onError?.(errorMsg)
    }
  }, [browserSupportsSpeechRecognition, continuous, interimResults, locale, onError, resetTranscript])

  const stopListening = useCallback(() => {
    setIsManuallyListening(false)
    // On mobile, stopListening() is not reliable, so we use abortListening()
    if (isTouchDevice) {
      SpeechRecognition.abortListening()
    } else {
      SpeechRecognition.stopListening()
    }
    setError(null)
  }, [isTouchDevice])

  const toggleListening = useCallback(() => {
    if (listening || isManuallyListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [listening, isManuallyListening, startListening, stopListening])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      SpeechRecognition.abortListening()
    }
  }, [])

  return {
    isSupported: browserSupportsSpeechRecognition,
    status,
    transcript: accumulatedTranscript,
    interimTranscript: libInterimTranscript,
    error,
    startListening,
    stopListening,
    toggleListening,
  }
}
