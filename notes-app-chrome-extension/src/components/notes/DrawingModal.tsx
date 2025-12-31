import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { X, Eraser, Undo2, Redo2, RotateCcw, Pen } from 'lucide-react'
import getStroke from 'perfect-freehand'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/Tooltip'
import { useResponsiveDrawingToolbar } from '@/hooks/useResponsiveDrawingToolbar'
import { useEdgeSwipeBack, EdgeSwipeIndicator } from '@/hooks/useEdgeSwipeBack'

interface Point {
  x: number
  y: number
  pressure?: number
}

interface Stroke {
  points: Point[]
  color: string
  size: number
  isEraser: boolean
}

// Full color palette
const COLORS = ['#000000', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff']

// Full stroke sizes
const SIZES = [3, 6, 12, 20]

interface DrawingModalProps {
  open: boolean
  onClose: () => void
  onSave: (imageDataUrl: string) => void
}

// Convert perfect-freehand points to SVG path
function getSvgPathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return ''

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length]
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
      return acc
    },
    ['M', ...stroke[0], 'Q']
  )

  d.push('Z')
  return d.join(' ')
}

// Get stroke options based on size
function getStrokeOptions(size: number, isEraser: boolean) {
  return {
    size: isEraser ? size * 2.5 : size,
    thinning: isEraser ? 0 : 0.5,
    smoothing: 0.5,
    streamline: 0.5,
    easing: (t: number) => t,
    start: {
      taper: 0,
      cap: true,
    },
    end: {
      taper: isEraser ? 0 : size * 2,
      cap: true,
    },
  }
}

export function DrawingModal({ open, onClose, onSave }: DrawingModalProps) {
  const { t } = useTranslation()
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  
  const [currentColor, setCurrentColor] = useState('#000000')
  const [currentSize, setCurrentSize] = useState(6)
  const [isEraser, setIsEraser] = useState(false)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [currentStroke, setCurrentStroke] = useState<Point[]>([])
  const [undoStack, setUndoStack] = useState<Stroke[][]>([])
  const [redoStack, setRedoStack] = useState<Stroke[][]>([])
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  
  // Responsive toolbar visibility
  const toolbarVisibility = useResponsiveDrawingToolbar(toolbarRef)
  
  // Edge swipe back gesture
  const { 
    handlers: edgeSwipeHandlers, 
    swipeStyle: edgeSwipeStyle,
    swipeState: edgeSwipeState,
    progress: edgeSwipeProgress 
  } = useEdgeSwipeBack({
    onSwipeBack: onClose,
    edgeWidth: 25,
    threshold: 100,
    enabled: open
  })

  // Setup canvas size
  useEffect(() => {
    if (!open) return
    
    const container = containerRef.current
    if (!container) return

    const resize = () => {
      const rect = container.getBoundingClientRect()
      setCanvasSize({ width: rect.width, height: rect.height })
    }

    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [open])

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStrokes([])
      setCurrentStroke([])
      setUndoStack([])
      setRedoStack([])
      setCurrentColor('#000000')
      setCurrentSize(6)
      setIsEraser(false)
    }
  }, [open])

  const getPoint = useCallback((e: React.PointerEvent): Point => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    
    const rect = svg.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure || 0.5,
    }
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const point = getPoint(e)
    setCurrentStroke([point])
  }, [getPoint])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (currentStroke.length === 0) return
    e.preventDefault()
    const point = getPoint(e)
    setCurrentStroke(prev => [...prev, point])
  }, [currentStroke.length, getPoint])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    
    if (currentStroke.length > 1) {
      setUndoStack(prev => [...prev, strokes])
      setRedoStack([])
      
      const newStroke: Stroke = {
        points: currentStroke,
        color: isEraser ? '#ffffff' : currentColor,
        size: currentSize,
        isEraser,
      }
      setStrokes(prev => [...prev, newStroke])
    }
    setCurrentStroke([])
  }, [currentStroke, strokes, isEraser, currentColor, currentSize])

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return
    const prev = undoStack[undoStack.length - 1]
    setUndoStack(stack => stack.slice(0, -1))
    setRedoStack(stack => [...stack, strokes])
    setStrokes(prev)
  }, [undoStack, strokes])

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    setRedoStack(stack => stack.slice(0, -1))
    setUndoStack(stack => [...stack, strokes])
    setStrokes(next)
  }, [redoStack, strokes])

  const handleClear = useCallback(() => {
    if (strokes.length === 0) return
    setUndoStack(prev => [...prev, strokes])
    setRedoStack([])
    setStrokes([])
  }, [strokes])

  const handleSave = useCallback(() => {
    if (strokes.length === 0) {
      onClose()
      return
    }

    const svg = svgRef.current
    if (!svg) return

    // Create canvas for export
    const canvas = document.createElement('canvas')
    const dpr = window.devicePixelRatio || 1
    canvas.width = canvasSize.width * dpr
    canvas.height = canvasSize.height * dpr
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height)

    // Draw all strokes
    strokes.forEach(stroke => {
      const outlinePoints = getStroke(
        stroke.points.map(p => [p.x, p.y, p.pressure || 0.5]),
        getStrokeOptions(stroke.size, stroke.isEraser)
      )
      
      const pathData = getSvgPathFromStroke(outlinePoints)
      const path = new Path2D(pathData)
      ctx.fillStyle = stroke.color
      ctx.fill(path)
    })

    const imageDataUrl = canvas.toDataURL('image/png', 0.9)
    onSave(imageDataUrl)
    onClose()
  }, [strokes, canvasSize, onSave, onClose])

  // ESC to close, Ctrl+Z/Ctrl+Shift+Z for undo/redo
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        if (e.shiftKey) handleRedo()
        else handleUndo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose, handleUndo, handleRedo])

  if (!open) return null

  // Get visible items based on toolbar width
  const visibleColors = COLORS.slice(0, toolbarVisibility.visibleColorsCount)
  const visibleSizes = SIZES.slice(0, toolbarVisibility.visibleStrokeWidthsCount)
  const { compactMode, breakpoint } = toolbarVisibility

  // Dynamic sizing based on breakpoint
  const buttonSize = compactMode ? 'w-7 h-7' : 'w-8 h-8'
  const colorSize = compactMode ? 'w-6 h-6' : 'w-7 h-7'
  const iconSize = compactMode ? 'w-4 h-4' : 'w-5 h-5'
  const gap = breakpoint === 'xs' ? 'gap-0.5' : breakpoint === 'sm' ? 'gap-1' : 'gap-1.5'

  // Render stroke as SVG path
  const renderStroke = (stroke: Stroke, index: number) => {
    const outlinePoints = getStroke(
      stroke.points.map(p => [p.x, p.y, p.pressure || 0.5]),
      getStrokeOptions(stroke.size, stroke.isEraser)
    )
    
    return (
      <path
        key={index}
        d={getSvgPathFromStroke(outlinePoints)}
        fill={stroke.color}
      />
    )
  }

  // Render current stroke being drawn
  const renderCurrentStroke = () => {
    if (currentStroke.length < 2) return null
    
    const outlinePoints = getStroke(
      currentStroke.map(p => [p.x, p.y, p.pressure || 0.5]),
      getStrokeOptions(currentSize, isEraser)
    )
    
    return (
      <path
        d={getSvgPathFromStroke(outlinePoints)}
        fill={isEraser ? '#ffffff' : currentColor}
      />
    )
  }

  return createPortal(
    <div 
      className="fixed inset-0 z-50 bg-white dark:bg-neutral-900 flex flex-col"
      style={edgeSwipeState.isDragging ? edgeSwipeStyle : undefined}
      {...edgeSwipeHandlers}
    >
      {/* Edge swipe indicator */}
      <EdgeSwipeIndicator 
        progress={edgeSwipeProgress} 
        isActive={edgeSwipeState.isDragging && edgeSwipeState.startedFromEdge} 
      />

      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 sm:py-2 pt-2 border-b border-neutral-200 dark:border-neutral-700 px-2 sm:px-3">
        <button
          onClick={onClose}
          className="p-1.5 -ml-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors touch-manipulation"
        >
          <X className="w-5 h-5" />
        </button>
        
        <span className="text-sm font-medium">{t('drawing.title')}</span>
        
        <button
          onClick={handleSave}
          className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors touch-manipulation"
        >
          {t('drawing.done')}
        </button>
      </div>

      {/* Canvas Area */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-hidden bg-white touch-none"
      >
        <svg
          ref={svgRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className={cn(
            "touch-none",
            isEraser ? "cursor-cell" : "cursor-crosshair"
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{ touchAction: 'none' }}
        >
          {/* White background */}
          <rect width="100%" height="100%" fill="#ffffff" />
          
          {/* Completed strokes */}
          {strokes.map(renderStroke)}
          
          {/* Current stroke being drawn */}
          {renderCurrentStroke()}
        </svg>
      </div>

      {/* Bottom Toolbar - Responsive */}
      <div 
        ref={toolbarRef}
        className="border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-2 py-1.5 sm:py-2"
      >
        <div className={cn("flex items-center justify-between max-w-xl mx-auto", gap)}>
          {/* Tool Toggle: Pen/Eraser */}
          <div className="flex items-center gap-0.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg p-0.5 flex-shrink-0">
            <button
              onClick={() => setIsEraser(false)}
              className={cn(
                "p-1.5 rounded-md transition-colors touch-manipulation",
                !isEraser 
                  ? "bg-white dark:bg-neutral-600 shadow-sm" 
                  : "hover:bg-neutral-300 dark:hover:bg-neutral-600"
              )}
            >
              <Pen className={iconSize} />
            </button>
            <button
              onClick={() => setIsEraser(true)}
              className={cn(
                "p-1.5 rounded-md transition-colors touch-manipulation",
                isEraser 
                  ? "bg-white dark:bg-neutral-600 shadow-sm" 
                  : "hover:bg-neutral-300 dark:hover:bg-neutral-600"
              )}
            >
              <Eraser className={iconSize} />
            </button>
          </div>

          {/* Colors */}
          <div className={cn("flex items-center flex-shrink-0", gap)}>
            {visibleColors.map(color => (
              <button
                key={color}
                onClick={() => { setCurrentColor(color); setIsEraser(false) }}
                className={cn(
                  colorSize,
                  "rounded-full transition-all touch-manipulation flex-shrink-0",
                  color === '#ffffff' ? "border border-neutral-300 dark:border-neutral-600" : "",
                  currentColor === color && !isEraser 
                    ? "ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-neutral-800" 
                    : ""
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          
          {/* Stroke Sizes */}
          <div className={cn("flex items-center flex-shrink-0", gap)}>
            {visibleSizes.map(size => (
              <button
                key={size}
                onClick={() => { setCurrentSize(size); setIsEraser(false) }}
                className={cn(
                  buttonSize,
                  "rounded-lg flex items-center justify-center transition-colors touch-manipulation",
                  currentSize === size && !isEraser 
                    ? "bg-blue-100 dark:bg-blue-900/40" 
                    : "hover:bg-neutral-200 dark:hover:bg-neutral-700"
                )}
              >
                <div 
                  className="rounded-full bg-neutral-800 dark:bg-neutral-200" 
                  style={{ 
                    width: Math.min(size + 2, 14), 
                    height: Math.min(size + 2, 14) 
                  }}
                />
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className={cn("flex items-center flex-shrink-0", gap)}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleUndo}
                  disabled={undoStack.length === 0}
                  className={cn(
                    buttonSize,
                    "rounded-lg flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-30 transition-colors touch-manipulation"
                  )}
                >
                  <Undo2 className={iconSize} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('editor.undo')}</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  className={cn(
                    buttonSize,
                    "rounded-lg flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-30 transition-colors touch-manipulation"
                  )}
                >
                  <Redo2 className={iconSize} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('editor.redo')}</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleClear}
                  disabled={strokes.length === 0}
                  className={cn(
                    buttonSize,
                    "rounded-lg flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-30 transition-colors touch-manipulation"
                  )}
                >
                  <RotateCcw className={iconSize} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('drawing.clear')}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
