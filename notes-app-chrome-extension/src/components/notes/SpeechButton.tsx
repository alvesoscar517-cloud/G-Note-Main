import { useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Mic, MicOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useSpeechToText, SpeechStatus } from '@/hooks/useSpeechToText'
import { useTranslation } from 'react-i18next'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/Tooltip'

interface SpeechButtonProps {
  onTranscript: (text: string, isFinal: boolean, replaceLength?: number) => void
  disabled?: boolean
  className?: string
}

/**
 * SpeechButton for Chrome Extension with Permission Priming
 */
export function SpeechButton({ onTranscript, disabled, className }: SpeechButtonProps) {
  const { t, i18n } = useTranslation()
  const [showPermissionDialog, setShowPermissionDialog] = useState(false)
  
  const {
    isSupported,
    status,
    error,
    toggleListening,
  } = useSpeechToText({
    locale: i18n.language,
    onResult: onTranscript,
    onError: (err) => {
      console.error('[SpeechButton] Error:', err)
      if (err === 'not-allowed') {
        setShowPermissionDialog(true)
      }
    },
  })

  // Listen for permission granted message from setup page
  useEffect(() => {
    const handleMessage = async (message: { type: string }) => {
      if (message.type === 'mic-permission-granted') {
        setShowPermissionDialog(false)
        // Reset offscreen document to pick up new permission
        try {
          await chrome.runtime.sendMessage({ type: 'reset-offscreen' })
          console.log('[SpeechButton] Offscreen reset after permission granted')
        } catch (e) {
          console.log('[SpeechButton] Could not reset offscreen:', e)
        }
      }
    }
    
    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [])

  const handleClick = useCallback(() => {
    toggleListening()
  }, [toggleListening])

  const openPermissionPage = useCallback(() => {
    // Open offscreen.html directly to grant permission to the offscreen document context
    chrome.tabs.create({ url: chrome.runtime.getURL('offscreen.html') })
    setShowPermissionDialog(false)
  }, [])

  const closeDialog = useCallback(() => {
    setShowPermissionDialog(false)
  }, [])

  if (!isSupported) {
    return null
  }

  const isListening = status === 'listening'
  const isError = status === 'error'

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant={isListening ? 'destructive' : 'ghost'}
              size="icon"
              onClick={handleClick}
              disabled={disabled}
              className={className}
              aria-label={isListening ? t('speech.stopListening') : t('speech.startListening')}
            >
              {status === 'listening' ? (
                <MicOff className="h-4 w-4" />
              ) : isError ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {isListening 
                ? t('speech.stopListening') 
                : error 
                  ? error 
                  : t('speech.startListening')}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Permission Dialog */}
      {showPermissionDialog && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={closeDialog}
          />
          <div className="relative w-full max-w-[320px] bg-white dark:bg-neutral-800 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-700 animate-in fade-in-0 zoom-in-95">
            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center">
                <Mic className="w-7 h-7 text-neutral-500 dark:text-neutral-400" />
              </div>
            </div>
            
            {/* Title */}
            <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-2 text-center">
              {t('speech.permissionRequired', 'Enable Voice Input')}
            </h3>
            
            {/* Description */}
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-5 text-center leading-relaxed">
              {t('speech.permissionMessage', 'Allow microphone access to use voice-to-text.')}
            </p>
            
            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={closeDialog}
                className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={openPermissionPage}
                className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-600 text-neutral-900 dark:text-white text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
              >
                {t('speech.enable', 'Enable')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

// Waveform indicator component
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
