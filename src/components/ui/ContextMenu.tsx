import * as React from 'react'
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu'
import { Check, ChevronRight, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

// Custom hook for long press detection on mobile devices
function useLongPress(
  onLongPress: (e: React.TouchEvent) => void,
  options: { delay?: number } = {}
) {
  const { delay = 500 } = options
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartPosRef = React.useRef<{ x: number; y: number } | null>(null)

  const start = React.useCallback((e: React.TouchEvent) => {
    touchStartPosRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    }
    
    timerRef.current = setTimeout(() => {
      // Vibrate on supported devices (wrapped in try-catch to avoid Chrome warnings)
      try {
        navigator.vibrate?.(50)
      } catch {
        // Ignore vibration errors
      }
      onLongPress(e)
    }, delay)
  }, [onLongPress, delay])

  const move = React.useCallback((e: React.TouchEvent) => {
    // Cancel if moved too far (> 10px)
    if (touchStartPosRef.current) {
      const deltaX = Math.abs(e.touches[0].clientX - touchStartPosRef.current.x)
      const deltaY = Math.abs(e.touches[0].clientY - touchStartPosRef.current.y)
      if (deltaX > 10 || deltaY > 10) {
        if (timerRef.current) {
          clearTimeout(timerRef.current)
          timerRef.current = null
        }
      }
    }
  }, [])

  const end = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    touchStartPosRef.current = null
  }, [])

  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  return {
    onTouchStart: start,
    onTouchMove: move,
    onTouchEnd: end,
    onTouchCancel: end,
  }
}

// Context for mobile menu state
interface MobileMenuContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  position: { x: number; y: number } | null
  setPosition: (pos: { x: number; y: number } | null) => void
}

const MobileMenuContext = React.createContext<MobileMenuContextValue | null>(null)

const ContextMenu = ({ children, ...props }: ContextMenuPrimitive.ContextMenuProps) => {
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [position, setPosition] = React.useState<{ x: number; y: number } | null>(null)

  return (
    <MobileMenuContext.Provider value={{ open: mobileOpen, setOpen: setMobileOpen, position, setPosition }}>
      <ContextMenuPrimitive.Root {...props}>
        {children}
      </ContextMenuPrimitive.Root>
    </MobileMenuContext.Provider>
  )
}

const ContextMenuTrigger = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Trigger> & {
    longPressDelay?: number
  }
>(({ children, longPressDelay = 500, ...props }, ref) => {
  const mobileContext = React.useContext(MobileMenuContext)

  const handleLongPress = React.useCallback((e: React.TouchEvent) => {
    if (mobileContext) {
      const touch = e.touches[0] || e.changedTouches[0]
      if (touch) {
        mobileContext.setPosition({ x: touch.clientX, y: touch.clientY })
        mobileContext.setOpen(true)
      }
    }
  }, [mobileContext])

  const longPressHandlers = useLongPress(handleLongPress, { delay: longPressDelay })

  return (
    <ContextMenuPrimitive.Trigger
      ref={ref}
      data-allow-context-menu
      {...longPressHandlers}
      {...props}
    >
      {children}
    </ContextMenuPrimitive.Trigger>
  )
})
ContextMenuTrigger.displayName = ContextMenuPrimitive.Trigger.displayName

const ContextMenuGroup = ContextMenuPrimitive.Group
const ContextMenuPortal = ContextMenuPrimitive.Portal
const ContextMenuSub = ContextMenuPrimitive.Sub
const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup

const ContextMenuSubTrigger = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubTrigger> & {
    inset?: boolean
  }
>(({ className, inset, children, ...props }, ref) => (
  <ContextMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      'flex cursor-default select-none items-center rounded-md px-2 py-1.5 text-sm outline-none',
      'focus:bg-neutral-100 dark:focus:bg-neutral-800',
      'data-[state=open]:bg-neutral-100 dark:data-[state=open]:bg-neutral-800',
      inset && 'pl-8',
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto h-4 w-4" />
  </ContextMenuPrimitive.SubTrigger>
))
ContextMenuSubTrigger.displayName = ContextMenuPrimitive.SubTrigger.displayName

const ContextMenuSubContent = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      'z-50 min-w-[8rem] overflow-hidden rounded-xl border p-1 shadow-lg',
      'border-neutral-200 bg-white text-neutral-900',
      'dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
      'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
      'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
      className
    )}
    {...props}
  />
))
ContextMenuSubContent.displayName = ContextMenuPrimitive.SubContent.displayName

const ContextMenuContent = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const mobileContext = React.useContext(MobileMenuContext)

  // Clone children for mobile menu (without Radix context)
  const mobileChildren = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      // For mobile, render simple buttons instead of Radix MenuItem
      const childProps = child.props as { onClick?: () => void; children?: React.ReactNode }
      return (
        <button
          className={cn(
            'relative flex w-full cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors',
            'hover:bg-neutral-100 dark:hover:bg-neutral-800',
            'touch-manipulation'
          )}
          onClick={() => {
            childProps.onClick?.()
            mobileContext?.setOpen(false)
            mobileContext?.setPosition(null)
          }}
        >
          {childProps.children}
        </button>
      )
    }
    return child
  })

  return (
    <>
      {/* Desktop: Radix context menu - hidden on mobile when mobile menu is open */}
      <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.Content
          ref={ref}
          className={cn(
            'z-50 min-w-[8rem] overflow-hidden rounded-xl border p-1 shadow-lg',
            'border-neutral-200 bg-white text-neutral-900',
            'dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100',
            'animate-in fade-in-0 zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
            'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
            // Hide on mobile (< md breakpoint)
            'hidden md:block',
            className
          )}
          {...props}
        >
          {children}
        </ContextMenuPrimitive.Content>
      </ContextMenuPrimitive.Portal>

      {/* Mobile: Custom positioned menu on long press */}
      {mobileContext?.open && mobileContext.position && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-50 md:hidden"
            onClick={() => {
              mobileContext.setOpen(false)
              mobileContext.setPosition(null)
            }}
          />
          {/* Menu */}
          <div
            className={cn(
              'fixed z-50 min-w-[8rem] overflow-hidden rounded-xl border p-1 shadow-lg md:hidden',
              'border-neutral-200 bg-white text-neutral-900',
              'dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100',
              'animate-in fade-in-0 zoom-in-95'
            )}
            style={{
              top: Math.min(mobileContext.position.y, window.innerHeight - 200),
              left: Math.min(Math.max(mobileContext.position.x - 64, 16), window.innerWidth - 144),
            }}
          >
            {mobileChildren}
          </div>
        </>
      )}
    </>
  )
})
ContextMenuContent.displayName = ContextMenuPrimitive.Content.displayName

const ContextMenuItem = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & {
    inset?: boolean
  }
>(({ className, inset, onClick, ...props }, ref) => {
  const mobileContext = React.useContext(MobileMenuContext)

  const handleClick = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    onClick?.(e)
    // Close mobile menu after click
    if (mobileContext) {
      mobileContext.setOpen(false)
      mobileContext.setPosition(null)
    }
  }, [onClick, mobileContext])

  return (
    <ContextMenuPrimitive.Item
      ref={ref}
      className={cn(
        'relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors',
        'focus:bg-neutral-100 dark:focus:bg-neutral-800',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        'touch-manipulation',
        inset && 'pl-8',
        className
      )}
      onClick={handleClick}
      {...props}
    />
  )
})
ContextMenuItem.displayName = ContextMenuPrimitive.Item.displayName

const ContextMenuCheckboxItem = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <ContextMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-md py-1.5 pl-8 pr-2 text-sm outline-none transition-colors',
      'focus:bg-neutral-100 dark:focus:bg-neutral-800',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      'touch-manipulation',
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <ContextMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </ContextMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.CheckboxItem>
))
ContextMenuCheckboxItem.displayName = ContextMenuPrimitive.CheckboxItem.displayName

const ContextMenuRadioItem = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <ContextMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-md py-1.5 pl-8 pr-2 text-sm outline-none transition-colors',
      'focus:bg-neutral-100 dark:focus:bg-neutral-800',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      'touch-manipulation',
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <ContextMenuPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </ContextMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.RadioItem>
))
ContextMenuRadioItem.displayName = ContextMenuPrimitive.RadioItem.displayName

const ContextMenuLabel = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Label> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <ContextMenuPrimitive.Label
    ref={ref}
    className={cn(
      'px-2 py-1.5 text-sm font-semibold text-neutral-500 dark:text-neutral-400',
      inset && 'pl-8',
      className
    )}
    {...props}
  />
))
ContextMenuLabel.displayName = ContextMenuPrimitive.Label.displayName

const ContextMenuSeparator = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-neutral-200 dark:bg-neutral-700', className)}
    {...props}
  />
))
ContextMenuSeparator.displayName = ContextMenuPrimitive.Separator.displayName

const ContextMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn('ml-auto text-xs tracking-widest text-neutral-500 dark:text-neutral-400', className)}
    {...props}
  />
)
ContextMenuShortcut.displayName = 'ContextMenuShortcut'

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
  useLongPress,
}
