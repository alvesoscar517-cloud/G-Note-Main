import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Mic, MicOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/Tooltip'
import { useSpeechToText, SpeechStatus } from '@/hooks/useSpeechToText'

interface SpeechButtonProps {
  /**
   * Called with transcript updates
   * @param text - The text to insert
   * @param isFinal - If true, this is confirmed text. If false, it's interim (may change)
   * @param replaceLength - Number of characters to delete before inserting (for interim updates)
   */
  onTranscript: (text: string, isFinal: boolean, replaceLength?: number) => void
  disabled?: boolean
  className?: string
}

export function SpeechButton({ onTranscript, disabled, className }: SpeechButtonProps) {
  const { t, i18n } = useTranslation()
  const onTranscriptRef = useRef(onTranscript)
  onTranscriptRef.current = onTranscript

  const {
    isSupported,
    status,
    toggleListening,
    stopListening,
  } = useSpeechToText({
    locale: i18n.language,
    continuous: true,
    interimResults: true,
    onResult: (transcript, isFinal, replaceLength) => {
      onTranscriptRef.current(transcript, isFinal, replaceLength)
    },
  })

  // Stop listening when disabled changes to true
  useEffect(() => {
    if (disabled && status === 'listening') {
      stopListening()
    }
  }, [disabled, status, stopListening])

  if (!isSupported) {
    return null // Don't render if not supported
  }

  const isListening = status === 'listening'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={toggleListening}
          disabled={disabled}
          className={cn(
            'relative p-1.5 rounded-full transition-all duration-200 touch-manipulation',
            isListening
              ? 'text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-900/30'
              : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700',
            disabled && 'opacity-40 cursor-not-allowed',
            className
          )}
        >
          {/* Pulse ring animation when listening */}
          {isListening && (
            <>
              <span className="absolute inset-0 rounded-full bg-red-400/30 dark:bg-red-500/20 animate-ping" />
              <span className="absolute inset-[-2px] rounded-full border-2 border-red-400/50 dark:border-red-500/40 animate-pulse" />
            </>
          )}
          
          {/* Icon */}
          <span className="relative z-10">
            {isListening ? (
              <MicOff className="w-[18px] h-[18px]" />
            ) : (
              <Mic className="w-[18px] h-[18px]" />
            )}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {isListening ? t('speech.stop') : t('speech.start')}
      </TooltipContent>
    </Tooltip>
  )
}

// Waveform indicator component (optional, for showing audio levels)
export function SpeechIndicator({ status }: { status: SpeechStatus }) {
  if (status !== 'listening') return null

  return (
    <div className="flex items-center gap-0.5 px-2">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="w-0.5 bg-red-500 dark:bg-red-400 rounded-full animate-pulse"
          style={{
            height: `${8 + Math.random() * 8}px`,
            animationDelay: `${i * 0.1}s`,
            animationDuration: '0.5s',
          }}
        />
      ))}
    </div>
  )
}
