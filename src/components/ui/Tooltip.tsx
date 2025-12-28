import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils'
import { isTouchDevice } from '@/hooks/useIsTouchDevice'

const TooltipProvider = TooltipPrimitive.Provider

// Context to track if tooltip should be disabled
const TooltipDisabledContext = React.createContext(false)

// Smart Tooltip that disables on touch devices
const Tooltip = ({ children, ...props }: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>) => {
  // On touch devices, don't show tooltip at all
  const [isTouch, setIsTouch] = React.useState(() => isTouchDevice())
  
  React.useEffect(() => {
    // Listen for input type changes
    const handleTouch = () => setIsTouch(true)
    const handleMouse = (e: MouseEvent) => {
      if (e.movementX !== 0 || e.movementY !== 0) {
        setIsTouch(false)
      }
    }
    
    window.addEventListener('touchstart', handleTouch, { passive: true })
    window.addEventListener('mousemove', handleMouse, { passive: true })
    
    return () => {
      window.removeEventListener('touchstart', handleTouch)
      window.removeEventListener('mousemove', handleMouse)
    }
  }, [])
  
  return (
    <TooltipDisabledContext.Provider value={isTouch}>
      <TooltipPrimitive.Root 
        {...props}
        // Close immediately on click
        disableHoverableContent
      >
        {children}
      </TooltipPrimitive.Root>
    </TooltipDisabledContext.Provider>
  )
}

const TooltipTrigger = TooltipPrimitive.Trigger

// Hook to detect dark mode from document class
function useIsDark() {
  const [isDark, setIsDark] = React.useState(() => 
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  )

  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    return () => observer.disconnect()
  }, [])

  return isDark
}

const TooltipContent = React.forwardRef<
  React.ComponentRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => {
  const isDark = useIsDark()
  const isDisabled = React.useContext(TooltipDisabledContext)
  
  // Don't render tooltip content on touch devices
  if (isDisabled) {
    return null
  }
  
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn(
          'z-[100] overflow-hidden rounded-lg px-3 py-1.5 text-xs font-medium',
          'shadow-lg',
          'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          isDark ? 'bg-neutral-800 text-neutral-100 border border-neutral-700' : 'bg-neutral-900 text-white border border-neutral-800',
          className
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  )
})
TooltipContent.displayName = TooltipPrimitive.Content.displayName

// Simple wrapper component for buttons with tooltip
interface TooltipButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tooltip: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  delayDuration?: number
}

const TooltipButton = React.forwardRef<HTMLButtonElement, TooltipButtonProps>(
  ({ tooltip, side = 'top', delayDuration = 300, children, ...props }, ref) => (
    <Tooltip delayDuration={delayDuration}>
      <TooltipTrigger asChild>
        <button ref={ref} {...props}>
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side={side}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
)
TooltipButton.displayName = 'TooltipButton'

export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  TooltipButton,
}
