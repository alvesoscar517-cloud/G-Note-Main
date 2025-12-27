import { useTranslation } from 'react-i18next'
import { useWebContent } from '@/hooks/useWebContent'
import { Dialog, DialogHeader, DialogContent, DialogFooter } from '@/components/ui/Dialog'
import { ExternalLink, FileText } from 'lucide-react'

export function WebContentDialog() {
  const { t } = useTranslation()
  const { pendingContent, createNoteWithContent, dismissContent } = useWebContent()
  
  if (!pendingContent) return null
  
  const handleCreate = () => {
    createNoteWithContent(pendingContent)
  }
  
  const handleDismiss = () => {
    dismissContent()
  }
  
  // Truncate preview text
  const previewText = pendingContent.text.length > 200 
    ? pendingContent.text.substring(0, 200) + '...' 
    : pendingContent.text
  
  return (
    <Dialog open={!!pendingContent} onClose={handleDismiss}>
      <DialogHeader>
        <span className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          {t('webContent.title')}
        </span>
      </DialogHeader>
      
      <DialogContent>
        <p className="text-sm mb-3">{t('webContent.description')}</p>
        
        {/* Source info */}
        {pendingContent.sourceTitle && (
          <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 mb-3">
            <ExternalLink className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{pendingContent.sourceTitle}</span>
          </div>
        )}
        
        {/* Content preview */}
        <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg max-h-40 overflow-y-auto">
          <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
            {previewText}
          </p>
        </div>
      </DialogContent>
      
      <DialogFooter>
        <button
          onClick={handleDismiss}
          className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={handleCreate}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
        >
          {t('webContent.createNote')}
        </button>
      </DialogFooter>
    </Dialog>
  )
}
