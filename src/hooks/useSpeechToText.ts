import { useState, useCallback, useEffect, useRef } from 'react'
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
  /**
   * Called with transcript updates
   * @param transcript - The text to display/insert
   * @param isFinal - If true, this is confirmed text. If false, it's interim (may change)
   * @param replaceLength - Number of characters to replace (for interim updates)
   */
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

/**
 * Speech-to-text hook with live typing experience
 * 
 * Features:
 * - Real-time display of interim results (like Apple dictation)
 * - Smooth replacement of interim text with final confirmed text
 * - No word fragmentation issues
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
  const isStartingRef = useRef(false)
  
  // Track what we've inserted
  const lastFinalTranscriptRef = useRef('')
  const lastInterimLengthRef = useRef(0)
  
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  // Use the library's hook
  const {
    interimTranscript: libInterimTranscript,
    finalTranscript: libFinalTranscript,
    listening,
    browserSupportsSpeechRecognition,
    resetTranscript,
  } = useLibSpeechRecognition()

  // Debug logging for production issues
  useEffect(() => {
    const hasSpeechRecognition = typeof window !== 'undefined' && 
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
    
    console.log('[SpeechToText] Debug info:', {
      browserSupportsSpeechRecognition,
      hasSpeechRecognition,
      protocol: window.location.protocol,
      hostname: window.location.hostname,
      isSecureContext: window.isSecureContext,
      userAgent: navigator.userAgent,
    })
    
    // Web Speech API requires secure context (HTTPS or localhost)
    if (!window.isSecureContext) {
      console.warn('[SpeechToText] Not in secure context - Speech API may not work')
    }
  }, [browserSupportsSpeechRecognition])

  // Determine status based on library's listening state only
  const status: SpeechStatus = error ? 'error' : listening ? 'listening' : 'idle'

  // Handle final transcript - this is confirmed text
  useEffect(() => {
    if (!libFinalTranscript) return
    
    // Get only the new part of final transcript
    const newFinalText = libFinalTranscript.slice(lastFinalTranscriptRef.current.length)
    
    if (newFinalText) {
      // Replace any interim text with the final confirmed text
      const replaceLength = lastInterimLengthRef.current
      
      onResultRef.current?.(newFinalText, true, replaceLength)
      
      // Update tracking
      lastFinalTranscriptRef.current = libFinalTranscript
      lastInterimLengthRef.current = 0
      setAccumulatedTranscript(libFinalTranscript)
    }
  }, [libFinalTranscript])

  // Handle interim transcript - live preview that may change
  useEffect(() => {
    if (!listening) return
    if (!libInterimTranscript) {
      // Interim cleared, reset tracking
      if (lastInterimLengthRef.current > 0) {
        lastInterimLengthRef.current = 0
      }
      return
    }
    
    // Calculate what to show
    const interimText = libInterimTranscript.trim()
    
    if (interimText) {
      // Tell the editor to replace previous interim with new interim
      const replaceLength = lastInterimLengthRef.current
      
      onResultRef.current?.(interimText, false, replaceLength)
      
      // Track the length of interim text we inserted
      lastInterimLengthRef.current = interimText.length
    }
  }, [libInterimTranscript, listening])

  // When listening stops, clean up any remaining interim
  useEffect(() => {
    if (!listening) {
      // If there's remaining interim text that wasn't finalized, keep it
      // The final transcript effect will handle it
      lastInterimLengthRef.current = 0
    }
  }, [listening])

  const startListening = useCallback(async () => {
    console.log('[SpeechToText] startListening called, support:', browserSupportsSpeechRecognition, 'listening:', listening)
    
    if (!browserSupportsSpeechRecognition) {
      const errorMsg = 'Speech recognition is not supported in this browser'
      console.error('[SpeechToText]', errorMsg)
      setError(errorMsg)
      onError?.(errorMsg)
      return
    }

    if (isStartingRef.current || listening) {
      console.log('[SpeechToText] Already starting or listening, skipping')
      return
    }

    isStartingRef.current = true
    setError(null)
    setAccumulatedTranscript('')
    lastFinalTranscriptRef.current = ''
    lastInterimLengthRef.current = 0
    
    resetTranscript()

    try {
      const lang = LOCALE_TO_SPEECH_LANG[locale] || 'en-US'
      console.log('[SpeechToText] Starting with language:', lang)
      
      await SpeechRecognition.startListening({
        continuous,
        interimResults,
        language: lang,
      })
      console.log('[SpeechToText] Started successfully')
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start speech recognition'
      console.error('[SpeechToText] Error:', errorMsg, err)
      setError(errorMsg)
      onError?.(errorMsg)
    } finally {
      isStartingRef.current = false
    }
  }, [browserSupportsSpeechRecognition, continuous, interimResults, locale, onError, resetTranscript, listening])

  const stopListening = useCallback(async () => {
    try {
      await SpeechRecognition.stopListening()
    } catch {
      // Ignore errors when stopping
    }
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
