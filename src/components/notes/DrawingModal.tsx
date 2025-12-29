import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Eraser, Undo2, Redo2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/Tooltip'
import { useResponsiveDrawingToolbar } from '@/hooks/useResponsiveDrawingToolbar'
import { useEdgeSwipeBack, EdgeSwipeIndicator } from '@/hooks/useEdgeSwipeBack'

interface Point {
  x: number
  y: number
}

interface Stroke {
  points: Point[]
  color: string
  width: number
}

const COLORS = ['#000000', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff']
const STROKE_WIDTHS = [2, 4, 8, 16]

interface DrawingModalProps {
  open: boolean
  onClose: () => void
  onSave: (imageDataUrl: string) => void
}

export function DrawingModal({ open, onClose, onSave }: DrawingModalProps) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  
  // State kept for potential future use, using ref for actual drawing logic
  const [_isDrawing, setIsDrawing] = useState(false)
  const [currentColor, setCurrentColor] = useState('#000000')
  const [currentWidth, setCurrentWidth] = useState(4)
  const [isEraser, setIsEraser] = useState(false)
  
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
  
  // Use refs for performance-critical data
  const strokesRef = useRef<Stroke[]>([])
  const currentStrokeRef = useRef<Point[]>([])
  const undoStackRef = useRef<Stroke[][]>([])
  const redoStackRef = useRef<Stroke[][]>([])
  
  // Force re-render for UI updates
  const [, forceUpdate] = useState(0)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  // Draw a single stroke on canvas
  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (stroke.points.length < 2) return
    ctx.beginPath()
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = stroke.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
    }
    ctx.stroke()
  }, [])

  // Full redraw
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    strokesRef.current.forEach(stroke => drawStroke(ctx, stroke))
  }, [drawStroke])

  // Setup canvas size
  useEffect(() => {
    if (!open) return
    
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const resize = () => {
      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      
      canvas.style.width = rect.width + 'px'
      canvas.style.height = rect.height + 'px'
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(dpr, dpr)
      }
      
      redrawCanvas()
    }

    requestAnimationFrame(resize)
    
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [open, redrawCanvas])

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      strokesRef.current = []
      currentStrokeRef.current = []
      undoStackRef.current = []
      redoStackRef.current = []
      setCurrentColor('#000000')
      setCurrentWidth(4)
      setIsEraser(false)
      forceUpdate(n => n + 1)
    }
  }, [open])

  const getPoint = useCallback((e: MouseEvent | TouchEvent): Point => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    
    if ('touches' in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      }
    }
    if ('clientX' in e) {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      }
    }
    return { x: 0, y: 0 }
  }, [])

  // Use refs to track drawing state for native event handlers
  const isDrawingRef = useRef(false)
  const isEraserRef = useRef(false)
  const currentColorRef = useRef('#000000')
  const currentWidthRef = useRef(4)
  
  // Keep refs in sync with state
  useEffect(() => {
    isEraserRef.current = isEraser
    currentColorRef.current = currentColor
    currentWidthRef.current = currentWidth
  }, [isEraser, currentColor, currentWidth])

  const startDrawing = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault()
    setIsDrawing(true)
    isDrawingRef.current = true
    const point = getPoint(e)
    currentStrokeRef.current = [point]
  }, [getPoint])

  const draw = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDrawingRef.current) return
    e.preventDefault()
    
    const point = getPoint(e)
    currentStrokeRef.current.push(point)
    
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const points = currentStrokeRef.current
    if (points.length < 2) return
    
    const color = isEraserRef.current ? '#ffffff' : currentColorRef.current
    const width = isEraserRef.current ? 24 : currentWidthRef.current
    
    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    
    const lastIndex = points.length - 1
    ctx.moveTo(points[lastIndex - 1].x, points[lastIndex - 1].y)
    ctx.lineTo(points[lastIndex].x, points[lastIndex].y)
    ctx.stroke()
  }, [getPoint])

  const stopDrawing = useCallback(() => {
    if (!isDrawingRef.current) return
    setIsDrawing(false)
    isDrawingRef.current = false
    
    if (currentStrokeRef.current.length > 1) {
      undoStackRef.current.push([...strokesRef.current])
      redoStackRef.current = []
      
      const newStroke: Stroke = {
        points: [...currentStrokeRef.current],
        color: isEraserRef.current ? '#ffffff' : currentColorRef.current,
        width: isEraserRef.current ? 24 : currentWidthRef.current
      }
      strokesRef.current.push(newStroke)
      forceUpdate(n => n + 1)
    }
    currentStrokeRef.current = []
  }, [])

  // Setup native event listeners with { passive: false } to allow preventDefault
  useEffect(() => {
    if (!open) return
    
    const canvas = canvasRef.current
    if (!canvas) return

    // Mouse events
    canvas.addEventListener('mousedown', startDrawing)
    canvas.addEventListener('mousemove', draw)
    canvas.addEventListener('mouseup', stopDrawing)
    canvas.addEventListener('mouseleave', stopDrawing)
    
    // Touch events with { passive: false }
    canvas.addEventListener('touchstart', startDrawing, { passive: false })
    canvas.addEventListener('touchmove', draw, { passive: false })
    canvas.addEventListener('touchend', stopDrawing, { passive: false })

    return () => {
      canvas.removeEventListener('mousedown', startDrawing)
      canvas.removeEventListener('mousemove', draw)
      canvas.removeEventListener('mouseup', stopDrawing)
      canvas.removeEventListener('mouseleave', stopDrawing)
      canvas.removeEventListener('touchstart', startDrawing)
      canvas.removeEventListener('touchmove', draw)
      canvas.removeEventListener('touchend', stopDrawing)
    }
  }, [open, startDrawing, draw, stopDrawing])

  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return
    const prev = undoStackRef.current.pop()!
    redoStackRef.current.push([...strokesRef.current])
    strokesRef.current = prev
    redrawCanvas()
    forceUpdate(n => n + 1)
  }, [redrawCanvas])

  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return
    const next = redoStackRef.current.pop()!
    undoStackRef.current.push([...strokesRef.current])
    strokesRef.current = next
    redrawCanvas()
    forceUpdate(n => n + 1)
  }, [redrawCanvas])

  const handleClear = useCallback(() => {
    if (strokesRef.current.length === 0) return
    undoStackRef.current.push([...strokesRef.current])
    redoStackRef.current = []
    strokesRef.current = []
    redrawCanvas()
    forceUpdate(n => n + 1)
    setShowClearConfirm(false)
  }, [redrawCanvas])

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    if (strokesRef.current.length === 0) {
      onClose()
      return
    }
    
    const exportCanvas = document.createElement('canvas')
    const container = containerRef.current
    if (!container) return
    
    const rect = container.getBoundingClientRect()
    exportCanvas.width = rect.width
    exportCanvas.height = rect.height
    
    const ctx = exportCanvas.getContext('2d')
    if (!ctx) return
    
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
    strokesRef.current.forEach(stroke => drawStroke(ctx, stroke))
    
    const imageDataUrl = exportCanvas.toDataURL('image/png', 0.9)
    onSave(imageDataUrl)
    onClose()
  }, [onSave, onClose, drawStroke])

  // ESC to close
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const visibleColors = COLORS.slice(0, toolbarVisibility.visibleColorsCount)
  const visibleStrokeWidths = STROKE_WIDTHS.slice(0, toolbarVisibility.visibleStrokeWidthsCount)
  const buttonSize = toolbarVisibility.compactMode ? 'w-6 h-6' : 'w-7 h-7 sm:w-8 sm:h-8'
  const colorSize = toolbarVisibility.compactMode ? 'w-5 h-5' : 'w-5 h-5 sm:w-6 sm:h-6'
  const iconSize = toolbarVisibility.compactMode ? 'w-4 h-4' : 'w-4 h-4 sm:w-5 sm:h-5'

  return (
    <div 
      className="fixed inset-0 z-50 bg-white dark:bg-neutral-900 flex flex-col status-bar-bg"
      style={edgeSwipeState.isDragging ? edgeSwipeStyle : undefined}
      {...edgeSwipeHandlers}
    >
      {/* Edge swipe indicator */}
      <EdgeSwipeIndicator 
        progress={edgeSwipeProgress} 
        isActive={edgeSwipeState.isDragging && edgeSwipeState.startedFromEdge} 
      />
      
      <ConfirmDialog
        open={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClear}
        title={t('drawing.clear')}
        description={t('notes.deleteConfirm')}
        confirmText={t('notes.delete')}
        cancelText={t('notes.cancel')}
      />

      {/* Header */}
      <div 
        className="flex items-center justify-between pb-1.5 sm:py-2 border-b border-neutral-200 dark:border-neutral-700 px-2 safe-top"
      >
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
        className="flex-1 overflow-hidden bg-white"
      >
        <canvas
          ref={canvasRef}
          className={cn(
            "touch-none",
            isEraser ? "cursor-cell" : "cursor-crosshair"
          )}
        />
      </div>

      {/* Responsive Bottom Toolbar */}
      <div 
        ref={toolbarRef}
        className="pt-1.5 sm:py-2 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-2 safe-bottom"
      >
        <div className="flex items-center justify-between max-w-xl mx-auto gap-1 sm:gap-2">
          {/* Colors - only show visible colors based on screen size */}
          <div className="flex items-center gap-1">
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
          
          {/* Stroke Width - only show visible widths based on screen size */}
          <div className="flex items-center gap-0.5">
            {visibleStrokeWidths.map(width => (
              <button
                key={width}
                onClick={() => { setCurrentWidth(width); setIsEraser(false) }}
                className={cn(
                  buttonSize,
                  "rounded-lg flex items-center justify-center transition-colors touch-manipulation",
                  currentWidth === width && !isEraser 
                    ? "bg-blue-100 dark:bg-blue-900/40" 
                    : "hover:bg-neutral-200 dark:hover:bg-neutral-700"
                )}
              >
                <div 
                  className="rounded-full bg-neutral-800 dark:bg-neutral-200" 
                  style={{ width: Math.min(width + 2, 14), height: Math.min(width + 2, 14) }}
                />
              </button>
            ))}
          </div>

          {/* Tools */}
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setIsEraser(!isEraser)}
                  className={cn(
                    "p-1.5 rounded-lg transition-colors touch-manipulation",
                    isEraser 
                      ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400" 
                      : "hover:bg-neutral-200 dark:hover:bg-neutral-700"
                  )}
                >
                  <Eraser className={iconSize} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('drawing.eraser')}</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleUndo}
                  disabled={undoStackRef.current.length === 0}
                  className="p-1.5 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-30 transition-colors touch-manipulation"
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
                  disabled={redoStackRef.current.length === 0}
                  className="p-1.5 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-30 transition-colors touch-manipulation"
                >
                  <Redo2 className={iconSize} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('editor.redo')}</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => strokesRef.current.length > 0 && setShowClearConfirm(true)}
                  disabled={strokesRef.current.length === 0}
                  className="p-1.5 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-30 transition-colors touch-manipulation"
                >
                  <Trash2 className={iconSize} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('drawing.clear')}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  )
}
