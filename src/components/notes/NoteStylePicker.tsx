import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useDropzone } from 'react-dropzone'
import imageCompression from 'browser-image-compression'
import { Palette, X, Check, Upload } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/stores/themeStore'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/Tooltip'
import type { NoteStyle } from '@/types'

// Google Keep color palettes - optimized for readability
const LIGHT_COLORS = [
  { name: 'Default', value: '#ffffff', textColor: '#171717' },
  { name: 'Coral', value: '#F28B82', textColor: '#171717' },
  { name: 'Peach', value: '#FBBC04', textColor: '#171717' },
  { name: 'Sand', value: '#FFF475', textColor: '#171717' },
  { name: 'Mint', value: '#CCFF90', textColor: '#171717' },
  { name: 'Sage', value: '#A7FFEB', textColor: '#171717' },
  { name: 'Fog', value: '#CBF0F8', textColor: '#171717' },
  { name: 'Storm', value: '#AECBFA', textColor: '#171717' },
  { name: 'Dusk', value: '#D7AEFB', textColor: '#171717' },
  { name: 'Blossom', value: '#FDCFE8', textColor: '#171717' },
  { name: 'Clay', value: '#E6C9A8', textColor: '#171717' },
  { name: 'Chalk', value: '#E8EAED', textColor: '#171717' },
]

const DARK_COLORS = [
  { name: 'Default', value: '#202124', textColor: '#fafafa' },
  { name: 'Coral', value: '#5C2B29', textColor: '#fafafa' },
  { name: 'Peach', value: '#614A19', textColor: '#fafafa' },
  { name: 'Sand', value: '#635D19', textColor: '#fafafa' },
  { name: 'Mint', value: '#345920', textColor: '#fafafa' },
  { name: 'Sage', value: '#16504B', textColor: '#fafafa' },
  { name: 'Fog', value: '#2D555E', textColor: '#fafafa' },
  { name: 'Storm', value: '#1E3A5F', textColor: '#fafafa' },
  { name: 'Dusk', value: '#42275E', textColor: '#fafafa' },
  { name: 'Blossom', value: '#5B2245', textColor: '#fafafa' },
  { name: 'Clay', value: '#442F19', textColor: '#fafafa' },
  { name: 'Chalk', value: '#3C3F43', textColor: '#fafafa' },
]

// Instagram-inspired filters
export const IMAGE_FILTERS = [
  { name: 'Normal', value: '', css: '' },
  { name: 'Clarendon', value: 'clarendon', css: 'contrast(1.2) saturate(1.35)' },
  { name: 'Gingham', value: 'gingham', css: 'brightness(1.05) hue-rotate(-10deg)' },
  { name: 'Moon', value: 'moon', css: 'grayscale(1) contrast(1.1) brightness(1.1)' },
  { name: 'Lark', value: 'lark', css: 'contrast(0.9) saturate(1.2) brightness(1.1)' },
  { name: 'Reyes', value: 'reyes', css: 'sepia(0.22) brightness(1.1) contrast(0.85) saturate(0.75)' },
  { name: 'Juno', value: 'juno', css: 'sepia(0.35) contrast(1.15) brightness(1.15) saturate(1.8)' },
  { name: 'Slumber', value: 'slumber', css: 'saturate(0.66) brightness(1.05) sepia(0.1)' },
  { name: 'Crema', value: 'crema', css: 'sepia(0.5) contrast(0.9) brightness(1.1) saturate(0.9)' },
  { name: 'Ludwig', value: 'ludwig', css: 'saturate(0.8) contrast(1.05) brightness(1.05)' },
  { name: 'Aden', value: 'aden', css: 'hue-rotate(-20deg) contrast(0.9) saturate(0.85) brightness(1.2)' },
  { name: 'Perpetua', value: 'perpetua', css: 'contrast(1.1) brightness(1.25) saturate(1.1)' },
]

// Default background images - illustrations like Google Keep
const DEFAULT_BACKGROUNDS = [
  { name: 'Groceries', src: '/background- (1).svg' },
  { name: 'Notes', src: '/background- (2).svg' },
  { name: 'Travel', src: '/background- (3).svg' },
  { name: 'Ideas', src: '/background- (4).svg' },
]

// Default opacity values for default backgrounds based on theme
const DEFAULT_BG_OPACITY_LIGHT = 0.7  // Light mode: 70% opacity
const DEFAULT_BG_OPACITY_DARK = 0.35  // Dark mode: 35% opacity (lower to keep text readable)

interface NoteStylePickerProps {
  style?: NoteStyle
  onChange: (style: NoteStyle) => void
}

export function NoteStylePicker({ style, onChange }: NoteStylePickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'color' | 'image'>('color')
  const { theme } = useThemeStore()
  
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  // Always show light colors in picker for better visibility, but apply dark colors when in dark mode
  const displayColors = LIGHT_COLORS
  const applyColors = isDark ? DARK_COLORS : LIGHT_COLORS
  const defaultBgOpacity = isDark ? DEFAULT_BG_OPACITY_DARK : DEFAULT_BG_OPACITY_LIGHT

  // Handle open change with event prevention to avoid triggering note close
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
  }

  const handleColorSelect = (index: number) => {
    const applyColor = applyColors[index]
    onChange({
      ...style,
      backgroundColor: applyColor.value === (isDark ? '#202124' : '#ffffff') ? undefined : applyColor.value,
      backgroundImage: undefined,
      backgroundFilter: undefined,
    })
  }

  // Find which color index is currently selected
  const getSelectedIndex = () => {
    if (!style?.backgroundColor) return 0 // Default
    const index = applyColors.findIndex(c => c.value === style.backgroundColor)
    return index >= 0 ? index : 0
  }
  const selectedIndex = getSelectedIndex()

  const handleImageUpload = useCallback(async (file: File) => {
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
      })
      
      const reader = new FileReader()
      reader.onload = () => {
        onChange({
          ...style,
          backgroundImage: reader.result as string,
          backgroundOpacity: style?.backgroundOpacity ?? 0.3,
        })
      }
      reader.readAsDataURL(compressed)
    } catch (error) {
      console.error('Image compression failed:', error)
    }
  }, [style, onChange])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => files[0] && handleImageUpload(files[0]),
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif'] },
    maxFiles: 1,
  })

  const handleFilterSelect = (filter: typeof IMAGE_FILTERS[0]) => {
    onChange({
      ...style,
      backgroundFilter: filter.value || undefined,
    })
  }

  const handleOpacityChange = (opacity: number) => {
    onChange({
      ...style,
      backgroundOpacity: opacity,
    })
  }

  const handleRemoveImage = () => {
    onChange({
      ...style,
      backgroundImage: undefined,
      backgroundFilter: undefined,
      backgroundOpacity: undefined,
    })
  }

  const handleDefaultBgSelect = (bgSrc: string) => {
    onChange({
      ...style,
      backgroundImage: bgSrc,
      backgroundOpacity: defaultBgOpacity,
    })
  }

  const hasCustomStyle = style?.backgroundColor || style?.backgroundImage

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Popover.Trigger asChild>
            <button
              className={cn(
                'p-2 sm:p-1.5 rounded-full text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors touch-manipulation',
                hasCustomStyle && 'bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-white'
              )}
            >
              <Palette className="w-5 h-5 sm:w-[18px] sm:h-[18px]" />
            </button>
          </Popover.Trigger>
        </TooltipTrigger>
        <TooltipContent side="top">{t('stylePicker.colorAndBackground')}</TooltipContent>
      </Tooltip>

      <Popover.Content
        side="top"
        align="center"
        sideOffset={8}
        collisionPadding={16}
        avoidCollisions={true}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="z-[100] w-[280px] max-w-[calc(100vw-32px)] bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700 p-3 animate-in fade-in-0 zoom-in-95"
      >
          {/* Tabs */}
          <div className="flex gap-1 mb-3">
            <button
              onClick={() => setTab('color')}
              className={cn(
                'flex-1 py-1.5 px-3 text-sm font-medium rounded-lg transition-colors',
                tab === 'color'
                  ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-white'
                  : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              )}
            >
              {t('stylePicker.colorTab')}
            </button>
            <button
              onClick={() => setTab('image')}
              className={cn(
                'flex-1 py-1.5 px-3 text-sm font-medium rounded-lg transition-colors',
                tab === 'image'
                  ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-white'
                  : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              )}
            >
              {t('stylePicker.imageTab')}
            </button>
          </div>

          {tab === 'color' && (
            <div className="grid grid-cols-6 gap-2">
              {displayColors.map((color, index) => (
                <Tooltip key={color.name}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleColorSelect(index)}
                      className={cn(
                        'w-8 h-8 rounded-full border-2 transition-all hover:scale-110 flex items-center justify-center',
                        selectedIndex === index
                          ? 'border-neutral-900 dark:border-white'
                          : 'border-neutral-300 dark:border-neutral-600'
                      )}
                      style={{ backgroundColor: color.value }}
                    >
                      {selectedIndex === index && (
                        <Check className="w-4 h-4" style={{ color: color.textColor }} />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{color.name}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}

          {tab === 'image' && (
            <div className="space-y-3">
              {/* Default backgrounds */}
              {!style?.backgroundImage && (
                <div className="space-y-1">
                  <label className="text-xs text-neutral-500 dark:text-neutral-400">{t('stylePicker.templates')}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {DEFAULT_BACKGROUNDS.map((bg) => (
                      <Tooltip key={bg.name}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleDefaultBgSelect(bg.src)}
                            className="h-16 rounded-lg border border-neutral-200 dark:border-neutral-600 hover:border-neutral-400 dark:hover:border-neutral-400 transition-colors overflow-hidden"
                          >
                            <img 
                              src={bg.src} 
                              alt={bg.name}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{bg.name}</TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload area - only show when no image selected */}
              {!style?.backgroundImage && (
                <div
                  {...getRootProps()}
                  className={cn(
                    'border-2 border-dashed rounded-lg p-2 text-center cursor-pointer transition-colors',
                    isDragActive
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 dark:hover:border-neutral-500'
                  )}
                >
                  <input {...getInputProps()} />
                  <Upload className="w-5 h-5 mx-auto mb-1 text-neutral-400" />
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {isDragActive ? t('stylePicker.dropImage') : t('stylePicker.uploadImage')}
                  </p>
                </div>
              )}

              {/* Current image preview & controls */}
              {style?.backgroundImage && (
                <div className="space-y-2">
                  <div className="relative rounded-lg overflow-hidden h-20 bg-white dark:bg-neutral-800">
                    <img
                      src={style.backgroundImage}
                      alt="Background"
                      className="w-full h-full object-cover"
                      style={{ filter: IMAGE_FILTERS.find(f => f.value === style.backgroundFilter)?.css }}
                    />
                    <button
                      onClick={handleRemoveImage}
                      className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Opacity slider */}
                  <div className="space-y-1">
                    <label className="text-xs text-neutral-500 dark:text-neutral-400">
                      {t('stylePicker.opacity')}: {Math.round((style.backgroundOpacity ?? 1) * 100)}%
                    </label>
                    <input
                      type="range"
                      min="0.3"
                      max="1"
                      step="0.05"
                      value={style.backgroundOpacity ?? 1}
                      onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full appearance-none cursor-pointer accent-neutral-900 dark:accent-white"
                    />
                  </div>

                  {/* Filters - only show for uploaded images (base64), not for default backgrounds */}
                  {style.backgroundImage.startsWith('data:') && (
                    <div className="space-y-1">
                      <label className="text-xs text-neutral-500 dark:text-neutral-400">{t('stylePicker.filter')}</label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {IMAGE_FILTERS.map((filter) => (
                          <button
                            key={filter.name}
                            onClick={() => handleFilterSelect(filter)}
                            className={cn(
                              'relative rounded-md overflow-hidden h-12 transition-all',
                              style.backgroundFilter === filter.value || (!style.backgroundFilter && !filter.value)
                                ? 'ring-2 ring-neutral-900 dark:ring-white'
                                : 'hover:ring-1 hover:ring-neutral-400'
                            )}
                          >
                            <img
                              src={style.backgroundImage}
                              alt={filter.name}
                              className="w-full h-full object-cover"
                              style={{ filter: filter.css }}
                            />
                            <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] py-0.5 text-center">
                              {filter.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <Popover.Arrow className="fill-white dark:fill-neutral-800" />
        </Popover.Content>
    </Popover.Root>
  )
}

// Helper to get background styles for note rendering
export function getNoteBackgroundStyle(style?: NoteStyle) {
  if (!style) return {}

  const baseStyle: React.CSSProperties = {}

  if (style.backgroundColor) {
    baseStyle.backgroundColor = style.backgroundColor
  }

  return baseStyle
}

// Component to render note background with image
// Uses a solid base color underneath so the image blends with it instead of being transparent
export function NoteBackground({ style, className }: { style?: NoteStyle; className?: string }) {
  if (!style?.backgroundImage) return null

  const filter = IMAGE_FILTERS.find(f => f.value === style.backgroundFilter)
  const opacity = style.backgroundOpacity ?? 1

  return (
    <>
      {/* Solid base layer - prevents seeing through to content below */}
      <div 
        className={cn('absolute inset-0 pointer-events-none bg-white dark:bg-neutral-900', className)} 
      />
      {/* Image layer on top */}
      <div
        className={cn('absolute inset-0 pointer-events-none', className)}
        style={{ opacity }}
      >
        <img
          src={style.backgroundImage}
          alt=""
          className="w-full h-full object-cover"
          style={{ filter: filter?.css }}
        />
      </div>
    </>
  )
}
