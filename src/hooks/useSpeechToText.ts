import { useState, useCallback, useEffect } from 'react'
import SpeechRecognition, { useSpeechRecognition as useLibSpeechRecognition } from 'react-speech-recognition'

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

  const [error, setError] = useState<string | null>(null)
  const [accumulatedTranscript, setAccumulatedTranscript] = useState('')

  // Use the library's hook
  const {
    transcript: libTranscript,
    interimTranscript: libInterimTranscript,
    listening,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
  } = useLibSpeechRecognition()

  // Determine status based on library state
  const status: SpeechStatus = error ? 'error' : listening ? 'listening' : 'idle'

  // Track transcript changes and call onResult callback
  useEffect(() => {
    if (libTranscript && libTranscript !== accumulatedTranscript) {
      const newText = libTranscript.slice(accumulatedTranscript.length)
      if (newText) {
        onResult?.(newText, true)
        setAccumulatedTranscript(libTranscript)
      }
    }
  }, [libTranscript, accumulatedTranscript, onResult])

  // Track interim transcript changes
  useEffect(() => {
    if (libInterimTranscript) {
      onResult?.(libInterimTranscript, false)
    }
  }, [libInterimTranscript, onResult])

  const startListening = useCallback(async () => {
    if (!browserSupportsSpeechRecognition) {
      const errorMsg = 'Speech recognition is not supported in this browser'
      setError(errorMsg)
      onError?.(errorMsg)
      return
    }

    if (!isMicrophoneAvailable) {
      const errorMsg = 'Microphone access denied'
      setError(errorMsg)
      onError?.(errorMsg)
      return
    }

    setError(null)
    setAccumulatedTranscript('')

    try {
      await SpeechRecognition.startListening({
        continuous,
        interimResults,
        language: LOCALE_TO_SPEECH_LANG[locale] || 'en-US',
      })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start speech recognition'
      setError(errorMsg)
      onError?.(errorMsg)
    }
  }, [browserSupportsSpeechRecognition, isMicrophoneAvailable, continuous, interimResults, locale, onError])

  const stopListening = useCallback(() => {
    SpeechRecognition.stopListening()
    setError(null)
  }, [])

  const toggleListening = useCallback(() => {
    if (listening) {
      stopListening()
    } else {
      startListening()
    }
  }, [listening, startListening, stopListening])

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
