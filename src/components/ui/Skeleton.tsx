import { cn } from '@/lib/utils'

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-700', className)}
      {...props}
    />
  )
}

// Full editor skeleton loading (fills available space)
function EditorSkeleton() {
  return (
    <div className="flex flex-col gap-3 py-2 min-h-[200px] h-full">
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

// Single note card skeleton
function NoteCardSkeleton() {
  return (
    <div className="p-4 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
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

// Full notes list skeleton - shows multiple card skeletons in grid
function NotesListSkeleton() {
  // Show 6 skeleton cards for a nice loading effect
  const skeletonCount = 6
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: skeletonCount }).map((_, index) => (
        <NoteCardSkeleton key={index} />
      ))}
    </div>
  )
}

export { Skeleton, EditorSkeleton, NoteCardSkeleton, NotesListSkeleton }
