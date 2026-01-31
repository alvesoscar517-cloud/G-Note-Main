import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop'
import { X, RotateCw, FlipHorizontal, FlipVertical } from 'lucide-react'
import { useEdgeSwipeBack, EdgeSwipeIndicator } from '@/hooks/useEdgeSwipeBack'
import { useHistoryBack } from '@/hooks/useHistoryBack'

// Import CSS
import 'react-image-crop/dist/ReactCrop.css'

interface ImageEditorProps {
  src: string
  onSave: (croppedImage: string) => void
  onCancel: () => void
}

function getCroppedImg(
  image: HTMLImageElement,
  crop: PixelCrop,
  rotation: number,
  flipH: boolean,
  flipV: boolean,
  targetSize?: { width: number; height: number }
): string {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No 2d context')

  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height

  const cropWidth = crop.width * scaleX
  const cropHeight = crop.height * scaleY
  const rotRad = (rotation * Math.PI) / 180

  canvas.width = cropWidth
  canvas.height = cropHeight

  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate(rotRad)
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1)
  ctx.translate(-canvas.width / 2, -canvas.height / 2)

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight
  )

  if (targetSize) {
    const scaledCanvas = document.createElement('canvas')
    scaledCanvas.width = targetSize.width
    scaledCanvas.height = targetSize.height
    const scaledCtx = scaledCanvas.getContext('2d')
    if (scaledCtx) {
      scaledCtx.drawImage(canvas, 0, 0, targetSize.width, targetSize.height)
      return scaledCanvas.toDataURL('image/jpeg', 0.9)
    }
  }

  return canvas.toDataURL('image/jpeg', 0.9)
}

export function ImageEditor({ src, onSave, onCancel }: ImageEditorProps) {
  const { t } = useTranslation()
  const imgRef = useRef<HTMLImageElement>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [rotation, setRotation] = useState(0)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Resizing state
  const [showResizePanel, setShowResizePanel] = useState(false)
  const [targetSize, setTargetSize] = useState<{ width: number; height: number } | null>(null)
  const [lockAspectRatio, setLockAspectRatio] = useState(true)
  const [lastEdited, setLastEdited] = useState<'width' | 'height'>('width')

  // Edge swipe back gesture
  const {
    swipeStyle: edgeSwipeStyle,
    swipeState: edgeSwipeState,
    progress: edgeSwipeProgress
  } = useEdgeSwipeBack({
    onSwipeBack: onCancel,
    edgeWidth: 25,
    threshold: 100,
    enabled: true
  })

  // History back support for system back gesture (Android swipe, browser back button)
  useHistoryBack({
    isOpen: true,
    onBack: onCancel,
    stateKey: 'image-editor'
  })

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget
    // Default crop: center 80% of image
    const cropSize = Math.min(width, height) * 0.8
    const x = (width - cropSize) / 2
    const y = (height - cropSize) / 2
    setCrop({
      unit: 'px',
      x,
      y,
      width: cropSize,
      height: cropSize,
    })
  }, [])

  // Update target size when crop changes if locked
  useEffect(() => {
    if (!completedCrop || !showResizePanel) return

    // If target size is not set yet, set it to current crop size
    if (!targetSize) {
      // Scale crop to natural dimensions
      if (imgRef.current) {
        const scaleX = imgRef.current.naturalWidth / imgRef.current.width
        const scaleY = imgRef.current.naturalHeight / imgRef.current.height
        setTargetSize({
          width: Math.round(completedCrop.width * scaleX),
          height: Math.round(completedCrop.height * scaleY)
        })
      }
      return
    }

    // If locked, update the non-edited dimension to match new aspect ratio
    if (lockAspectRatio && imgRef.current) {
      const scaleX = imgRef.current.naturalWidth / imgRef.current.width
      const scaleY = imgRef.current.naturalHeight / imgRef.current.height
      const currentCropW = completedCrop.width * scaleX
      const currentCropH = completedCrop.height * scaleY
      const aspect = currentCropW / currentCropH

      if (lastEdited === 'width') {
        // Width is fixed/dominant, update height based on new crop aspect
        // But wait, if I keep Width fixed, and aspect changes (drag crop), Height should change.
        setTargetSize(prev => prev ? ({ ...prev, height: Math.round(prev.width / aspect) }) : null)
      } else {
        // Height is fixed, update width
        setTargetSize(prev => prev ? ({ ...prev, width: Math.round(prev.height * aspect) }) : null)
      }
    }
  }, [completedCrop, lockAspectRatio, lastEdited, showResizePanel])

  const handleSave = async () => {
    if (!imgRef.current || !completedCrop) return

    setIsSaving(true)
    try {
      // Calculate final target size if not manually set (use natural crop size)
      let finalSize = targetSize
      if (!finalSize && imgRef.current) {
        const scaleX = imgRef.current.naturalWidth / imgRef.current.width
        const scaleY = imgRef.current.naturalHeight / imgRef.current.height
        finalSize = {
          width: Math.round(completedCrop.width * scaleX),
          height: Math.round(completedCrop.height * scaleY)
        }
      }

      const croppedImage = getCroppedImg(imgRef.current, completedCrop, rotation, flipH, flipV, finalSize ?? undefined)
      onSave(croppedImage)
    } catch (e) {
      console.error('Error cropping image:', e)
    } finally {
      setIsSaving(false)
    }
  }

  const handleRotate = () => setRotation((r) => (r + 90) % 360)
  const handleFlipH = () => setFlipH((f) => !f)
  const handleFlipV = () => setFlipV((f) => !f)

  const handleResizeChange = (dimension: 'width' | 'height', value: string) => {
    const numValue = parseInt(value.replace(/\D/g, '')) || 0
    setLastEdited(dimension)

    if (!targetSize) return

    let newTarget = { ...targetSize }

    if (!lockAspectRatio) {
      newTarget = { ...targetSize, [dimension]: numValue }
    } else {
      // Maintain aspect ratio based on original crop to avoid drift and 0-calculation errors
      let aspect = targetSize.width / targetSize.height

      if (completedCrop && imgRef.current) {
        const scaleX = imgRef.current.naturalWidth / imgRef.current.width
        const scaleY = imgRef.current.naturalHeight / imgRef.current.height
        const currentCropW = completedCrop.width * scaleX
        const currentCropH = completedCrop.height * scaleY
        if (currentCropH > 0) {
          aspect = currentCropW / currentCropH
        }
      }

      if (dimension === 'width') {
        newTarget = { width: numValue, height: Math.round(numValue / aspect) }
      } else {
        newTarget = { width: Math.round(numValue * aspect), height: numValue }
      }
    }

    setTargetSize(newTarget)

    if (imgRef.current && crop) {
      const scaleX = imgRef.current.naturalWidth / imgRef.current.width
      const scaleY = imgRef.current.naturalHeight / imgRef.current.height

      const newCropWidth = newTarget.width / scaleX
      const newCropHeight = newTarget.height / scaleY

      setCrop({
        unit: 'px',
        x: crop.x + (crop.width - newCropWidth) / 2,
        y: crop.y + (crop.height - newCropHeight) / 2,
        width: newCropWidth,
        height: newCropHeight,
      })
    }
  }

  const toggleResizePanel = () => {
    if (!showResizePanel && !targetSize && completedCrop && imgRef.current) {
      // Initialize with current natural size
      const scaleX = imgRef.current.naturalWidth / imgRef.current.width
      const scaleY = imgRef.current.naturalHeight / imgRef.current.height
      setTargetSize({
        width: Math.round(completedCrop.width * scaleX),
        height: Math.round(completedCrop.height * scaleY)
      })
    }
    setShowResizePanel(!showResizePanel)
  }

  const handleResetResize = () => {
    if (completedCrop && imgRef.current) {
      const scaleX = imgRef.current.naturalWidth / imgRef.current.width
      const scaleY = imgRef.current.naturalHeight / imgRef.current.height
      setTargetSize({
        width: Math.round(completedCrop.width * scaleX),
        height: Math.round(completedCrop.height * scaleY)
      })
    }
  }

  // Build transform style
  const imageTransform = [
    rotation ? `rotate(${rotation}deg)` : '',
    flipH ? 'scaleX(-1)' : '',
    flipV ? 'scaleY(-1)' : '',
  ].filter(Boolean).join(' ')

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-white dark:bg-neutral-950 flex flex-col status-bar-bg"
      style={edgeSwipeStyle}
    >
      <EdgeSwipeIndicator
        progress={edgeSwipeProgress}
        isActive={edgeSwipeState.isDragging && edgeSwipeState.startedFromEdge}
      />

      {/* Header - with safe area support */}
      <div className="flex items-center justify-between px-2 pb-2 sm:p-4 shrink-0 safe-top safe-x">
        <button
          onClick={onCancel}
          className="p-1.5 rounded-full border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors touch-manipulation"
        >
          <X className="w-5 h-5" />
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving || !completedCrop}
          className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
        >
          {isSaving ? t('imageEditor.saving') : t('imageEditor.apply')}
        </button>
      </div>

      {/* Crop Area - flexible height for landscape */}
      <div className="flex-1 flex items-center justify-center overflow-auto p-2 sm:p-4 min-h-0">
        <ReactCrop
          crop={crop}
          onChange={(c) => setCrop(c)}
          onComplete={(c) => setCompletedCrop(c)}
        >
          <img
            ref={imgRef}
            src={src}
            alt="Edit"
            onLoad={onImageLoad}
            style={{
              maxHeight: '50vh',
              maxWidth: '100%',
              transform: imageTransform || undefined,
            }}
            crossOrigin="anonymous"
          />
        </ReactCrop>
      </div>

      {/* Resize Panel */}
      {showResizePanel && targetSize && (
        <div className="bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 p-3 sm:px-4 safe-x animate-in slide-in-from-bottom-5 fade-in duration-200">
          <div className="flex items-center justify-center gap-3 sm:gap-4 max-w-md mx-auto">
            <div className="flex-1 space-y-1">
              <label className="text-[10px] uppercase text-neutral-500 font-semibold tracking-wider">{t('imageEditor.width')}</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={targetSize.width}
                onChange={(e) => handleResizeChange('width', e.target.value)}
                className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2 py-1.5 text-sm text-center font-mono"
              />
            </div>

            <div className="pt-5">
              <button
                onClick={() => setLockAspectRatio(!lockAspectRatio)}
                className={`p-1.5 rounded-lg transition-colors ${lockAspectRatio ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
                title={t('imageEditor.rotate')} // Using reusing key or new one
              >
                {/* Simple link icon */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
              </button>
            </div>

            <div className="flex-1 space-y-1">
              <label className="text-[10px] uppercase text-neutral-500 font-semibold tracking-wider">{t('imageEditor.height')}</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={targetSize.height}
                onChange={(e) => handleResizeChange('height', e.target.value)}
                className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2 py-1.5 text-sm text-center font-mono"
              />
            </div>

            <div className="pt-5">
              <button
                onClick={handleResetResize}
                className="p-1.5 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                title={t('imageEditor.auto')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Controls - with safe area support */}
      <div className="bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 pt-2 sm:p-4 shrink-0 safe-bottom safe-x">
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          <button
            onClick={toggleResizePanel}
            className={`flex flex-col items-center gap-0.5 sm:gap-1 p-2 sm:p-3 rounded-xl transition-colors touch-manipulation ${showResizePanel ? 'bg-neutral-200 dark:bg-neutral-800 text-blue-600 dark:text-blue-400' : 'hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'}`}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 sm:w-6 sm:h-6"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>
            <span className="text-[10px] sm:text-xs">{t('imageEditor.resize')}</span>
          </button>

          <div className="w-px h-8 bg-neutral-300 dark:bg-neutral-700 mx-1" />

          <button
            onClick={handleRotate}
            className="flex flex-col items-center gap-0.5 sm:gap-1 p-2 sm:p-3 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors touch-manipulation"
          >
            <RotateCw className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-[10px] sm:text-xs">{t('imageEditor.rotate')}</span>
          </button>
          <button
            onClick={handleFlipH}
            className={`flex flex-col items-center gap-0.5 sm:gap-1 p-2 sm:p-3 rounded-xl transition-colors touch-manipulation ${flipH ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-white' : 'hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
              }`}
          >
            <FlipHorizontal className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-[10px] sm:text-xs">{t('imageEditor.flipH')}</span>
          </button>
          <button
            onClick={handleFlipV}
            className={`flex flex-col items-center gap-0.5 sm:gap-1 p-2 sm:p-3 rounded-xl transition-colors touch-manipulation ${flipV ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-white' : 'hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
              }`}
          >
            <FlipVertical className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-[10px] sm:text-xs">{t('imageEditor.flipV')}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
