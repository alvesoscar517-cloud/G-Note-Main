import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-[16px] border border-neutral-200 bg-white p-4 transition-all',
        'hover:shadow-md hover:border-neutral-300',
        'dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600',
        className
      )}
      {...props}
    />
  )
)
Card.displayName = 'Card'

export { Card }
