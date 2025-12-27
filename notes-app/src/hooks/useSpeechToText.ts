import { useState, useCallback, useRef, useEffect } from 'react'

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

// Check if Web Speech API is supported
const isSpeechRecognitionSupported = (): boolean => {
  return !!(
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  )
}

// Get SpeechRecognition constructor
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getSpeechRecognition = (): (new () => any) | null => {
  if (typeof window === 'undefined') return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null
}

export function useSpeechToText(options: UseSpeechToTextOptions = {}): UseSpeechToTextReturn {
  const {
    locale = 'en',
    continuous = true,
    interimResults = true,
    onResult,
    onError,
  } = options

  const [status, setStatus] = useState<SpeechStatus>('idle')
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const isSupported = isSpeechRecognitionSupported()

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
        recognitionRef.current = null
      }
    }
  }, [])

  const startListening = useCallback(() => {
    if (!isSupported) {
      const errorMsg = 'Speech recognition is not supported in this browser'
      setError(errorMsg)
      onError?.(errorMsg)
      return
    }

    // Stop any existing recognition
    if (recognitionRef.current) {
      recognitionRef.current.abort()
    }

    setError(null)
    setTranscript('')
    setInterimTranscript('')

    const SpeechRecognitionClass = getSpeechRecognition()
    if (!SpeechRecognitionClass) {
      const errorMsg = 'Speech recognition is not available'
      setError(errorMsg)
      onError?.(errorMsg)
      return
    }
    
    const recognition = new SpeechRecognitionClass()

    recognition.lang = LOCALE_TO_SPEECH_LANG[locale] || 'en-US'
    recognition.continuous = continuous
    recognition.interimResults = interimResults

    recognition.onstart = () => {
      setStatus('listening')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let finalTranscript = ''
      let interim = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscript += result[0].transcript
        } else {
          interim += result[0].transcript
        }
      }

      if (finalTranscript) {
        setTranscript(prev => prev + finalTranscript)
        onResult?.(finalTranscript, true)
      }
      
      setInterimTranscript(interim)
      if (interim) {
        onResult?.(interim, false)
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      let errorMsg = 'Speech recognition error'
      
      switch (event.error) {
        case 'not-allowed':
          errorMsg = 'Microphone access denied'
          break
        case 'no-speech':
          errorMsg = 'No speech detected'
          break
        case 'network':
          errorMsg = 'Network error'
          break
        case 'aborted':
          // User aborted, not an error
          return
      }
      
      setError(errorMsg)
      setStatus('error')
      onError?.(errorMsg)
    }

    recognition.onend = () => {
      setStatus('idle')
      setInterimTranscript('')
    }

    recognitionRef.current = recognition
    
    try {
      recognition.start()
    } catch (err) {
      const errorMsg = 'Failed to start speech recognition'
      setError(errorMsg)
      setStatus('error')
      onError?.(errorMsg)
    }
  }, [isSupported, locale, continuous, interimResults, onResult, onError])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setStatus('idle')
    setInterimTranscript('')
  }, [])

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
