import { ErrorBoundary as ReactErrorBoundary, FallbackProps } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'
import { RefreshCw, FileText, List, Pencil, LayoutGrid, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

// Error logging utility
function logError(error: Error, errorInfo: { componentStack?: string | null }, context: string) {
  console.error(`[ErrorBoundary] ${context}:`, {
    error: error.message,
    stack: error.stack,
    componentStack: errorInfo.componentStack,
    timestamp: new Date().toISOString()
  })
}

// Fullscreen overlay fallback component
interface OverlayFallbackProps extends FallbackProps {
  icon: React.ReactNode
  titleKey: string
  descriptionKey: string
}

function OverlayFallback({ resetErrorBoundary, icon, titleKey, descriptionKey }: OverlayFallbackProps) {
  const { t } = useTranslation()
  
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-white dark:bg-neutral-950">
      {/* Card container - border only */}
      <div className="flex flex-col items-center text-center max-w-sm w-full p-8 rounded-3xl border border-neutral-200 dark:border-neutral-800">
        {/* Icon */}
        <div className="w-16 h-16 rounded-full border border-neutral-200 dark:border-neutral-800 flex items-center justify-center mb-6">
          {icon}
        </div>
        
        {/* Title */}
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
          {t(titleKey)}
        </h1>
        
        {/* Description */}
        <p className="text-neutral-500 dark:text-neutral-400 mb-6 text-sm">
          {t(descriptionKey)}
        </p>
        
        {/* Retry button */}
        <button
          onClick={resetErrorBoundary}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all",
            "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900",
            "hover:bg-neutral-800 dark:hover:bg-neutral-100",
            "active:scale-95"
          )}
        >
          <RefreshCw className="w-4 h-4" />
          {t('errorBoundary.retry')}
        </button>
      </div>
    </div>
  )
}

// Editor-specific fallback
export function EditorErrorFallback(props: FallbackProps) {
  return (
    <OverlayFallback
      {...props}
      icon={<Pencil className="w-7 h-7 text-neutral-500 dark:text-neutral-400" />}
      titleKey="errorBoundary.editorError"
      descriptionKey="errorBoundary.editorErrorDescription"
    />
  )
}

// Notes list fallback
export function ListErrorFallback(props: FallbackProps) {
  return (
    <OverlayFallback
      {...props}
      icon={<List className="w-7 h-7 text-neutral-500 dark:text-neutral-400" />}
      titleKey="errorBoundary.listError"
      descriptionKey="errorBoundary.listErrorDescription"
    />
  )
}

// Drawing modal fallback
export function DrawingErrorFallback(props: FallbackProps) {
  return (
    <OverlayFallback
      {...props}
      icon={<Pencil className="w-7 h-7 text-neutral-500 dark:text-neutral-400" />}
      titleKey="errorBoundary.drawingError"
      descriptionKey="errorBoundary.drawingErrorDescription"
    />
  )
}

// Modal fallback
export function ModalErrorFallback(props: FallbackProps) {
  return (
    <OverlayFallback
      {...props}
      icon={<FileText className="w-7 h-7 text-neutral-500 dark:text-neutral-400" />}
      titleKey="errorBoundary.modalError"
      descriptionKey="errorBoundary.modalErrorDescription"
    />
  )
}

// Generic fallback for other components
export function GenericErrorFallback(props: FallbackProps) {
  return (
    <OverlayFallback
      {...props}
      icon={<AlertCircle className="w-7 h-7 text-neutral-500 dark:text-neutral-400" />}
      titleKey="errorBoundary.genericError"
      descriptionKey="errorBoundary.genericErrorDescription"
    />
  )
}

// App-level fallback
export function AppErrorFallback(props: FallbackProps) {
  const { t } = useTranslation()
  
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-white dark:bg-neutral-950">
      {/* Card container - border only */}
      <div className="flex flex-col items-center text-center max-w-sm w-full p-8 rounded-3xl border border-neutral-200 dark:border-neutral-800">
        {/* Icon */}
        <div className="w-20 h-20 rounded-full border border-neutral-200 dark:border-neutral-800 flex items-center justify-center mb-6">
          <LayoutGrid className="w-9 h-9 text-neutral-500 dark:text-neutral-400" />
        </div>
        
        {/* Title */}
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
          {t('errorBoundary.appError')}
        </h1>
        
        {/* Description */}
        <p className="text-neutral-500 dark:text-neutral-400 mb-6 text-sm">
          {t('errorBoundary.appErrorDescription')}
        </p>
        
        {/* Reload button */}
        <button
          onClick={props.resetErrorBoundary}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all",
            "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900",
            "hover:bg-neutral-800 dark:hover:bg-neutral-100",
            "active:scale-95"
          )}
        >
          <RefreshCw className="w-4 h-4" />
          {t('errorBoundary.reloadApp')}
        </button>
      </div>
    </div>
  )
}

// Wrapper components
interface ErrorBoundaryWrapperProps {
  children: React.ReactNode
  fallback: React.ComponentType<FallbackProps>
  context: string
  onReset?: () => void
}

export function ErrorBoundaryWrapper({ children, fallback: FallbackComponent, context, onReset }: ErrorBoundaryWrapperProps) {
  return (
    <ReactErrorBoundary
      FallbackComponent={FallbackComponent}
      onError={(error, errorInfo) => logError(error, errorInfo, context)}
      onReset={onReset}
    >
      {children}
    </ReactErrorBoundary>
  )
}

// Pre-configured wrappers
export function EditorErrorBoundary({ children, onReset }: { children: React.ReactNode; onReset?: () => void }) {
  return (
    <ErrorBoundaryWrapper fallback={EditorErrorFallback} context="NoteEditor" onReset={onReset}>
      {children}
    </ErrorBoundaryWrapper>
  )
}

export function ListErrorBoundary({ children, onReset }: { children: React.ReactNode; onReset?: () => void }) {
  return (
    <ErrorBoundaryWrapper fallback={ListErrorFallback} context="NotesList" onReset={onReset}>
      {children}
    </ErrorBoundaryWrapper>
  )
}

export function DrawingErrorBoundary({ children, onReset }: { children: React.ReactNode; onReset?: () => void }) {
  return (
    <ErrorBoundaryWrapper fallback={DrawingErrorFallback} context="DrawingModal" onReset={onReset}>
      {children}
    </ErrorBoundaryWrapper>
  )
}

export function ModalErrorBoundary({ children, onReset }: { children: React.ReactNode; onReset?: () => void }) {
  return (
    <ErrorBoundaryWrapper fallback={ModalErrorFallback} context="NoteModal" onReset={onReset}>
      {children}
    </ErrorBoundaryWrapper>
  )
}

export function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ReactErrorBoundary
      FallbackComponent={AppErrorFallback}
      onError={(error, errorInfo) => logError(error, errorInfo, 'App')}
      onReset={() => window.location.reload()}
    >
      {children}
    </ReactErrorBoundary>
  )
}
