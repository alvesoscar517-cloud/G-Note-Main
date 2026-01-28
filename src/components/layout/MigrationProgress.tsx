/**
 * Migration Progress Component
 * 
 * Displays migration status and progress to the user during the collection removal migration.
 * Shows:
 * - Migration status (in progress, completed, failed)
 * - Progress indicator
 * - Estimated time remaining (for migrations > 30 seconds)
 * - Error messages if migration fails
 * 
 * Requirements: 9.2, 9.4
 */

import { useEffect, useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { LoadingDots } from '@/components/ui/LoadingDots'
import type { MigrationResult } from '@/lib/migration/removeCollectionMigration'

interface MigrationProgressProps {
  isOpen: boolean
  migrationResult: MigrationResult | null
  onComplete: () => void
}

export function MigrationProgress({ isOpen, migrationResult, onComplete }: MigrationProgressProps) {
  const [elapsedTime, setElapsedTime] = useState(0)
  const [startTime] = useState(Date.now())

  // Update elapsed time every second
  useEffect(() => {
    if (!isOpen || migrationResult?.success !== undefined) return

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [isOpen, migrationResult, startTime])

  // Format elapsed time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Show detailed progress if migration takes longer than 30 seconds
  const showDetailedProgress = elapsedTime > 30

  return (
    <Dialog 
      open={isOpen} 
      onClose={() => {
        // Only allow closing if migration is complete
        if (migrationResult?.success !== undefined) {
          onComplete()
        }
      }}
    >
      <div className="p-6 max-w-md">
        {/* Migration in progress */}
        {migrationResult === null && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <LoadingDots />
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                Migrating Your Data
              </h2>
            </div>
            
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              We're updating your notes to the latest version. This will only take a moment.
            </p>

            {showDetailedProgress && (
              <div className="mt-4 p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-2">
                  Migration is taking longer than expected...
                </p>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  Elapsed time: {formatTime(elapsedTime)}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-2">
                  Please don't close this window. Your notes are being safely updated.
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-500">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Your notes are read-only during migration</span>
            </div>
          </div>
        )}

        {/* Migration completed successfully */}
        {migrationResult?.success === true && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                Migration Complete!
              </h2>
            </div>
            
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Your notes have been successfully updated. All your data has been preserved.
            </p>

            <div className="mt-4 p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600 dark:text-neutral-400">Notes processed:</span>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {migrationResult.notesProcessed}
                </span>
              </div>
              {migrationResult.collectionsRemoved > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600 dark:text-neutral-400">Collections removed:</span>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {migrationResult.collectionsRemoved}
                  </span>
                </div>
              )}
              {migrationResult.driveFilesDeleted > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600 dark:text-neutral-400">Drive files cleaned:</span>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {migrationResult.driveFilesDeleted}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600 dark:text-neutral-400">Time taken:</span>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {formatTime(elapsedTime)}
                </span>
              </div>
            </div>

            <button
              onClick={onComplete}
              className="w-full mt-4 px-4 py-2 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors font-medium"
            >
              Continue
            </button>
          </div>
        )}

        {/* Migration failed */}
        {migrationResult?.success === false && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                Migration Failed
              </h2>
            </div>
            
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              We encountered an error while updating your notes. Your data has been restored to its previous state.
            </p>

            {migrationResult.errors.length > 0 && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-xs font-medium text-red-900 dark:text-red-200 mb-2">
                  Error details:
                </p>
                <div className="space-y-1">
                  {migrationResult.errors.map((error, index) => (
                    <p key={index} className="text-xs text-red-800 dark:text-red-300 font-mono">
                      {error}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button
                onClick={onComplete}
                className="flex-1 px-4 py-2 bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors font-medium"
              >
                Close
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-2 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors font-medium"
              >
                Retry
              </button>
            </div>

            <p className="text-xs text-neutral-500 dark:text-neutral-500 text-center">
              If the problem persists, please contact support
            </p>
          </div>
        )}
      </div>
    </Dialog>
  )
}
