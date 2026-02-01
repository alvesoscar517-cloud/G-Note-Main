import { cn } from '@/lib/utils'

// ============ Base Skeleton Component ============
interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Variant of skeleton animation */
  variant?: 'pulse' | 'shimmer' | 'wave'
  /** Shape of the skeleton */
  shape?: 'rectangle' | 'circle' | 'text'
}

function Skeleton({
  className,
  variant = 'pulse',
  shape = 'rectangle',
  ...props
}: SkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading..."
      className={cn(
        'rounded-md bg-neutral-200 dark:bg-neutral-700',
        variant === 'pulse' && 'animate-pulse',
        variant === 'shimmer' && 'shimmer-line',
        variant === 'wave' && 'animate-shimmer overflow-hidden relative',
        shape === 'circle' && 'rounded-full',
        shape === 'text' && 'rounded h-4',
        className
      )}
      {...props}
    >
      {variant === 'wave' && (
        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
      )}
    </div>
  )
}

// ============ Skeleton Text Lines ============
interface SkeletonTextProps {
  /** Number of lines to show */
  lines?: number
  /** Custom widths for each line (as Tailwind width classes) */
  widths?: string[]
  /** Gap between lines */
  gap?: 'sm' | 'md' | 'lg'
  className?: string
}

function SkeletonText({
  lines = 3,
  widths,
  gap = 'md',
  className
}: SkeletonTextProps) {
  const defaultWidths = ['w-full', 'w-5/6', 'w-4/5', 'w-3/4', 'w-2/3', 'w-full', 'w-5/6']
  const gapClasses = {
    sm: 'gap-1.5',
    md: 'gap-2',
    lg: 'gap-3'
  }

  return (
    <div className={cn('flex flex-col', gapClasses[gap], className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn('h-4', widths?.[index] || defaultWidths[index % defaultWidths.length])}
        />
      ))}
    </div>
  )
}

// ============ Editor Skeleton ============
// Full editor skeleton loading (fills available space)
function EditorSkeleton() {
  return (
    <div
      className="flex flex-col gap-3 py-2 min-h-[200px] h-full"
      role="status"
      aria-label="Loading editor content..."
    >
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-3/5" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  )
}

// ============ Note Card Skeleton ============
// Single note card skeleton
function NoteCardSkeleton() {
  return (
    <div
      className="p-4 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
      role="status"
      aria-label="Loading note..."
    >
      {/* Title */}
      <Skeleton className="h-5 w-3/4 mb-3" />
      {/* Content lines */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-4/5" />
      </div>
      {/* Date */}
      <Skeleton className="h-3 w-24 mt-4" />
    </div>
  )
}

// ============ Notes List Skeleton ============
// Full notes list skeleton - shows multiple card skeletons in grid
interface NotesListSkeletonProps {
  /** Number of skeleton cards to show */
  count?: number
}

function NotesListSkeleton({ count = 6 }: NotesListSkeletonProps) {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      role="status"
      aria-label="Loading notes..."
    >
      {Array.from({ length: count }).map((_, index) => (
        <NoteCardSkeleton key={index} />
      ))}
    </div>
  )
}

// ============ Avatar Skeleton ============
interface AvatarSkeletonProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

function AvatarSkeleton({ size = 'md', className }: AvatarSkeletonProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16'
  }

  return (
    <Skeleton
      shape="circle"
      className={cn(sizeClasses[size], className)}
      aria-label="Loading avatar..."
    />
  )
}

// ============ Button Skeleton ============
interface ButtonSkeletonProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

function ButtonSkeleton({ size = 'md', className }: ButtonSkeletonProps) {
  const sizeClasses = {
    sm: 'h-8 w-20',
    md: 'h-10 w-24',
    lg: 'h-12 w-32'
  }

  return (
    <Skeleton
      className={cn('rounded-lg', sizeClasses[size], className)}
      aria-label="Loading button..."
    />
  )
}

// ============ Card Skeleton ============
interface CardSkeletonProps {
  /** Show header */
  showHeader?: boolean
  /** Show image placeholder */
  showImage?: boolean
  /** Number of text lines */
  lines?: number
  className?: string
}

function CardSkeleton({
  showHeader = true,
  showImage = false,
  lines = 3,
  className
}: CardSkeletonProps) {
  return (
    <div
      className={cn(
        'p-4 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700',
        className
      )}
      role="status"
      aria-label="Loading content..."
    >
      {showHeader && (
        <div className="flex items-center gap-3 mb-4">
          <AvatarSkeleton size="sm" />
          <div className="flex-1">
            <Skeleton className="h-4 w-24 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      )}

      {showImage && (
        <Skeleton className="h-40 w-full mb-4 rounded-lg" />
      )}

      <SkeletonText lines={lines} />
    </div>
  )
}

// ============ Table Skeleton ============
interface TableSkeletonProps {
  rows?: number
  columns?: number
  showHeader?: boolean
  className?: string
}

function TableSkeleton({
  rows = 5,
  columns = 4,
  showHeader = true,
  className
}: TableSkeletonProps) {
  return (
    <div
      className={cn('rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden', className)}
      role="status"
      aria-label="Loading table..."
    >
      {showHeader && (
        <div className="flex gap-4 p-3 bg-neutral-100 dark:bg-neutral-800">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
      )}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex gap-4 p-3 border-t border-neutral-200 dark:border-neutral-700"
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              className={cn('h-4 flex-1', colIndex === 0 && 'w-1/4 flex-none')}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ============ AI Summary Skeleton ============
function AISummarySkeleton() {
  return (
    <div
      className="px-4 py-4 space-y-2 animate-in fade-in slide-in-from-top-4 duration-300"
      role="status"
      aria-label="Generating AI summary..."
    >
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <hr className="my-4 border-neutral-200 dark:border-neutral-700" />
    </div>
  )
}

// ============ Toolbar Skeleton ============
function ToolbarSkeleton() {
  return (
    <div
      className="flex items-center gap-2 p-2"
      role="status"
      aria-label="Loading toolbar..."
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="w-8 h-8 rounded-lg" />
      ))}
    </div>
  )
}

export {
  Skeleton,
  SkeletonText,
  EditorSkeleton,
  NoteCardSkeleton,
  NotesListSkeleton,
  AvatarSkeleton,
  ButtonSkeleton,
  CardSkeleton,
  TableSkeleton,
  AISummarySkeleton,
  ToolbarSkeleton
}
