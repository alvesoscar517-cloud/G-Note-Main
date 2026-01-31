import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Mic, MicOff, X, Chrome } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/Tooltip'
import { useSpeechToText, SpeechStatus } from '@/hooks/useSpeechToText'

interface SpeechButtonProps {
  onTranscript: (text: string, isFinal: boolean, replaceLength?: number) => void
  disabled?: boolean
  className?: string
}

// Modal component for not supported message
function NotSupportedModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl max-w-sm w-full p-6">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
        >
          <X className="w-5 h-5 text-neutral-500" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Mic className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-center text-neutral-900 dark:text-neutral-100 mb-2">
          {t('speech.notSupportedTitle')}
        </h3>

        {/* Message */}
        <p className="text-sm text-center text-neutral-600 dark:text-neutral-400 mb-4">
          {t('speech.notSupportedMessage')}
        </p>

        {/* Tip */}
        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-4">
          <Chrome className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            {t('speech.notSupportedTip')}
          </p>
        </div>

        {/* Button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 px-4 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl font-medium hover:opacity-90 transition-opacity"
        >
          {t('speech.gotIt')}
        </button>
      </div>
    </div>
  )
}

export function SpeechButton({ onTranscript, disabled, className }: SpeechButtonProps) {
  const { t, i18n } = useTranslation()
  const onTranscriptRef = useRef(onTranscript)
  onTranscriptRef.current = onTranscript
  const [showNotSupportedModal, setShowNotSupportedModal] = useState(false)

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

  const handleClick = () => {
    if (!isSupported) {
      setShowNotSupportedModal(true)
      return
    }
    toggleListening()
  }

  // Don't render if not supported (will show modal on click instead)
  // But we still render the button to allow users to click and see the modal
  const isListening = status === 'listening'

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleClick}
            disabled={disabled}
            className={cn(
              'relative p-1.5 rounded-full transition-all duration-200 touch-manipulation',
              isListening
                ? 'text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-900/30'
                : !isSupported
                  ? 'text-neutral-400 dark:text-neutral-500 opacity-60'
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

      <NotSupportedModal 
        isOpen={showNotSupportedModal} 
        onClose={() => setShowNotSupportedModal(false)} 
      />
    </>
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
