import { useTranslation } from 'react-i18next'
import { AlertTriangle, RefreshCw, X } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useNotesStore } from '@/stores/notesStore'
import { hasAuthBackend, getGoogleAuthUrl } from '@/lib/tokenRefresh'

interface DrivePermissionErrorProps {
  onClose: () => void
}

export function DrivePermissionError({ onClose }: DrivePermissionErrorProps) {
  const { t } = useTranslation()
  const { logout } = useAuthStore()

  const handleRelogin = () => {
    // Clear sync error first
    useNotesStore.setState({ syncError: null })
    
    // Logout and redirect to login
    logout()
    
    if (hasAuthBackend()) {
      // Redirect to Google OAuth with fresh consent
      window.location.href = getGoogleAuthUrl()
    }
  }

  const handleContinueWithoutSync = () => {
    // Clear sync error and continue using app without sync
    useNotesStore.setState({ syncError: null })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 safe-x">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-sm bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95 border border-neutral-200 dark:border-neutral-700 overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-6 text-center">
          {/* Warning Icon */}
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>

          {/* Title */}
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
            {t('auth.drivePermissionRequired')}
          </h2>

          {/* Description */}
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
            {t('auth.drivePermissionDenied')}
          </p>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleRelogin}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              {t('auth.relogin')}
            </button>

            <button
              onClick={handleContinueWithoutSync}
              className="w-full px-4 py-3 text-neutral-600 dark:text-neutral-400 rounded-xl font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              {t('auth.continueWithoutSync')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
