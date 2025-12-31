import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop'
import { X, Check, RotateCw, FlipHorizontal, FlipVertical } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/Tooltip'
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
  flipV: boolean
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

  const handleSave = async () => {
    if (!imgRef.current || !completedCrop) return
    
    setIsSaving(true)
    try {
      const croppedImage = getCroppedImg(imgRef.current, completedCrop, rotation, flipH, flipV)
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

  // Build transform style
  const imageTransform = [
    rotation ? `rotate(${rotation}deg)` : '',
    flipH ? 'scaleX(-1)' : '',
    flipV ? 'scaleY(-1)' : '',
  ].filter(Boolean).join(' ')

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] bg-neutral-100 dark:bg-neutral-900 flex flex-col status-bar-bg"
      style={edgeSwipeStyle}
    >
      <EdgeSwipeIndicator 
        progress={edgeSwipeProgress} 
        isActive={edgeSwipeState.isDragging && edgeSwipeState.startedFromEdge} 
      />
      
      {/* Header - with safe area support */}
      <div className="flex items-center justify-between px-2 pb-2 sm:p-4 shrink-0 safe-top safe-x">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onCancel}
              className="p-2 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors touch-manipulation"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('imageEditor.cancel')}</TooltipContent>
        </Tooltip>
        <button
          onClick={handleSave}
          disabled={isSaving || !completedCrop}
          className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-sm sm:text-base font-medium transition-colors hover:bg-neutral-300 dark:hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
        >
          <Check className="w-4 h-4 sm:w-5 sm:h-5" />
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

      {/* Controls - with safe area support */}
      <div className="pt-2 sm:p-4 shrink-0 safe-bottom safe-x">
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          <button
            onClick={handleRotate}
            className="flex flex-col items-center gap-0.5 sm:gap-1 p-2 sm:p-3 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors touch-manipulation"
          >
            <RotateCw className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-[10px] sm:text-xs">{t('imageEditor.rotate')}</span>
          </button>
          <button
            onClick={handleFlipH}
            className={`flex flex-col items-center gap-0.5 sm:gap-1 p-2 sm:p-3 rounded-xl transition-colors touch-manipulation ${
              flipH ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-white' : 'hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
            }`}
          >
            <FlipHorizontal className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-[10px] sm:text-xs">{t('imageEditor.flipH')}</span>
          </button>
          <button
            onClick={handleFlipV}
            className={`flex flex-col items-center gap-0.5 sm:gap-1 p-2 sm:p-3 rounded-xl transition-colors touch-manipulation ${
              flipV ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-white' : 'hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
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
