import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Eraser, Undo2, Redo2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/Tooltip'

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
  
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentColor, setCurrentColor] = useState('#000000')
  const [currentWidth, setCurrentWidth] = useState(4)
  const [isEraser, setIsEraser] = useState(false)
  
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
      
      // Set display size
      canvas.style.width = rect.width + 'px'
      canvas.style.height = rect.height + 'px'
      
      // Set actual size in memory (scaled for retina)
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      
      // Scale context for retina
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(dpr, dpr)
      }
      
      redrawCanvas()
    }

    // Use requestAnimationFrame for smoother initial render
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

  const getPoint = useCallback((e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      }
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
  }, [])

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    setIsDrawing(true)
    const point = getPoint(e)
    currentStrokeRef.current = [point]
  }, [getPoint])

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return
    e.preventDefault()
    
    const point = getPoint(e)
    currentStrokeRef.current.push(point)
    
    // Draw incrementally for better performance
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const points = currentStrokeRef.current
    if (points.length < 2) return
    
    const color = isEraser ? '#ffffff' : currentColor
    const width = isEraser ? 24 : currentWidth
    
    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    
    // Only draw the last segment for performance
    const lastIndex = points.length - 1
    ctx.moveTo(points[lastIndex - 1].x, points[lastIndex - 1].y)
    ctx.lineTo(points[lastIndex].x, points[lastIndex].y)
    ctx.stroke()
  }, [isDrawing, getPoint, isEraser, currentColor, currentWidth])

  const stopDrawing = useCallback(() => {
    if (!isDrawing) return
    setIsDrawing(false)
    
    if (currentStrokeRef.current.length > 1) {
      undoStackRef.current.push([...strokesRef.current])
      redoStackRef.current = []
      
      const newStroke: Stroke = {
        points: [...currentStrokeRef.current],
        color: isEraser ? '#ffffff' : currentColor,
        width: isEraser ? 24 : currentWidth
      }
      strokesRef.current.push(newStroke)
      forceUpdate(n => n + 1)
    }
    currentStrokeRef.current = []
  }, [isDrawing, isEraser, currentColor, currentWidth])

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
    
    // Create a new canvas without retina scaling for export
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

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-neutral-900 flex flex-col">
      {/* Clear Confirm Dialog */}
      <ConfirmDialog
        open={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClear}
        title={t('drawing.clear')}
        description={t('notes.deleteConfirm')}
        confirmText={t('notes.delete')}
        cancelText={t('notes.cancel')}
      />

      {/* Compact Header */}
      <div className="flex items-center justify-between px-2 sm:px-3 py-1.5 sm:py-2 border-b border-neutral-200 dark:border-neutral-700">
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
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className={cn(
            "touch-none",
            isEraser ? "cursor-cell" : "cursor-crosshair"
          )}
        />
      </div>

      {/* Compact Bottom Toolbar - more compact in landscape */}
      <div className="px-2 sm:px-3 py-1.5 sm:py-2 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800">
        <div className="flex items-center justify-between max-w-xl mx-auto gap-1 sm:gap-2">
          {/* Colors - scrollable on small screens */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {COLORS.map(color => (
              <button
                key={color}
                onClick={() => { setCurrentColor(color); setIsEraser(false) }}
                className={cn(
                  "w-5 h-5 sm:w-6 sm:h-6 rounded-full transition-all touch-manipulation flex-shrink-0",
                  color === '#ffffff' ? "border border-neutral-300 dark:border-neutral-600" : "",
                  currentColor === color && !isEraser 
                    ? "ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-neutral-800" 
                    : ""
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          
          {/* Stroke Width */}
          <div className="flex items-center gap-0.5">
            {STROKE_WIDTHS.map(width => (
              <button
                key={width}
                onClick={() => { setCurrentWidth(width); setIsEraser(false) }}
                className={cn(
                  "w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-colors touch-manipulation",
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
                  <Eraser className="w-4 h-4 sm:w-5 sm:h-5" />
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
                  <Undo2 className="w-4 h-4 sm:w-5 sm:h-5" />
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
                  <Redo2 className="w-4 h-4 sm:w-5 sm:h-5" />
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
                  <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
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
