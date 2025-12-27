import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from '@tiptap/react'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2, Download, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/Tooltip'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/ContextMenu'
import { ImageEditor } from './ImageEditor'

// Extend commands interface
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    resizableImage: {
      setImage: (options: { src: string; alt?: string; title?: string }) => ReturnType
    }
  }
}

// NodeView component for resizable image
function ResizableImageComponent({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const { t } = useTranslation()
  const [isResizing, setIsResizing] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const startPos = useRef({ x: 0, y: 0, width: 0, height: 0 })

  const { src, alt, width, height } = node.attrs as { 
    src: string
    alt?: string
    title?: string
    width?: number
    height?: number 
  }

  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent, corner: string) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!imageRef.current) return
    
    const rect = imageRef.current.getBoundingClientRect()
    startPos.current = {
      x: e.clientX,
      y: e.clientY,
      width: rect.width,
      height: rect.height,
    }
    
    setIsResizing(true)

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startPos.current.x
      const deltaY = e.clientY - startPos.current.y
      
      let newWidth = startPos.current.width
      let newHeight = startPos.current.height
      const aspectRatio = startPos.current.width / startPos.current.height

      // Calculate new dimensions based on corner
      if (corner.includes('e')) newWidth = Math.max(100, startPos.current.width + deltaX)
      if (corner.includes('w')) newWidth = Math.max(100, startPos.current.width - deltaX)
      if (corner.includes('s')) newHeight = Math.max(100, startPos.current.height + deltaY)
      if (corner.includes('n')) newHeight = Math.max(100, startPos.current.height - deltaY)

      // Maintain aspect ratio if shift is held or for corner handles
      if (e.shiftKey || corner.length === 2) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          newHeight = newWidth / aspectRatio
        } else {
          newWidth = newHeight * aspectRatio
        }
      }

      updateAttributes({ width: Math.round(newWidth), height: Math.round(newHeight) })
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [updateAttributes])

  // Handle image edit save
  const handleEditSave = useCallback((newSrc: string) => {
    updateAttributes({ src: newSrc, width: undefined, height: undefined })
    setShowEditor(false)
  }, [updateAttributes])

  // Handle copy image
  const handleCopyImage = useCallback(async () => {
    try {
      const response = await fetch(src)
      const blob = await response.blob()
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ])
    } catch {
      // Fallback: copy as text (data URL)
      navigator.clipboard.writeText(src)
    }
  }, [src])

  // Handle download image
  const handleDownloadImage = useCallback(() => {
    const link = document.createElement('a')
    link.href = src
    link.download = alt || 'image'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [src, alt])

  // Activate on click/touch, deactivate on click outside
  const handleImageClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    setIsActive(true)
  }, [])

  // Click outside to deactivate
  useEffect(() => {
    if (!isActive) return

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as globalThis.Node)) {
        setIsActive(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isActive])

  // Sync with editor selection
  useEffect(() => {
    if (selected) setIsActive(true)
  }, [selected])

  const showControls = isActive || isResizing

  return (
    <NodeViewWrapper className="relative inline-block my-2">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={containerRef}
            className={cn(
              "relative inline-block",
              isResizing && "select-none"
            )}
            onClick={handleImageClick}
            onTouchStart={handleImageClick}
          >
            <img
              ref={imageRef}
              src={src}
              alt={alt || ''}
              draggable={false}
              className={cn(
                "max-w-full rounded-lg transition-shadow cursor-pointer",
                showControls && "ring-2 ring-neutral-400 dark:ring-neutral-500 ring-offset-2"
              )}
              style={{
                width: width ? `${width}px` : 'auto',
                height: height ? `${height}px` : 'auto',
              }}
            />

            {/* Controls overlay - only show when active */}
            {showControls && (
              <>
                {/* Top toolbar */}
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-neutral-800 dark:bg-neutral-700 rounded-lg p-1 shadow-lg">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowEditor(true) }}
                        className="p-1.5 rounded hover:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-200 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{t('imageEditor.edit')}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteNode() }}
                        className="p-1.5 rounded hover:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-200 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{t('imageEditor.delete')}</TooltipContent>
                  </Tooltip>
                  <div className="w-px h-4 bg-neutral-600 mx-1" />
                  <div className="px-2 text-xs text-neutral-400">
                    {width && height ? `${width}×${height}` : 'Auto'}
                  </div>
                </div>

                {/* Resize handles */}
                {['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'].map((corner) => (
                  <div
                    key={corner}
                    onMouseDown={(e) => handleResizeStart(e, corner)}
                    onTouchStart={(e) => {
                      const touch = e.touches[0]
                      handleResizeStart({ 
                        clientX: touch.clientX, 
                        clientY: touch.clientY, 
                        preventDefault: () => e.preventDefault(),
                        stopPropagation: () => e.stopPropagation()
                      } as React.MouseEvent, corner)
                    }}
                    className={cn(
                      "absolute w-3 h-3 bg-neutral-700 dark:bg-neutral-300 border-2 border-white dark:border-neutral-800 rounded-sm cursor-pointer shadow-md z-10",
                      "hover:bg-neutral-600 dark:hover:bg-neutral-400 transition-colors",
                      corner === 'nw' && "top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nw-resize",
                      corner === 'ne' && "top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-ne-resize",
                      corner === 'sw' && "bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-sw-resize",
                      corner === 'se' && "bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-se-resize",
                      corner === 'n' && "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-n-resize",
                      corner === 's' && "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-s-resize",
                      corner === 'e' && "top-1/2 right-0 translate-x-1/2 -translate-y-1/2 cursor-e-resize",
                      corner === 'w' && "top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 cursor-w-resize"
                    )}
                  />
                ))}
              </>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => setShowEditor(true)}>
            <Pencil className="w-4 h-4 mr-2" />
            {t('contextMenu.edit')}
          </ContextMenuItem>
          <ContextMenuItem onClick={handleCopyImage}>
            <Copy className="w-4 h-4 mr-2" />
            {t('contextMenu.copy')}
          </ContextMenuItem>
          <ContextMenuItem onClick={handleDownloadImage}>
            <Download className="w-4 h-4 mr-2" />
            {t('contextMenu.download')}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => deleteNode()}>
            <Trash2 className="w-4 h-4 mr-2" />
            {t('contextMenu.delete')}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Image Editor Modal */}
      {showEditor && (
        <ImageEditor
          src={src}
          onSave={handleEditSave}
          onCancel={() => setShowEditor(false)}
        />
      )}
    </NodeViewWrapper>
  )
}

// Custom Image Extension with resize and edit capabilities
export const ResizableImage = Node.create({
  name: 'image',
  
  group: 'block',
  
  draggable: true,
  
  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
      width: {
        default: null,
      },
      height: {
        default: null,
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'img[src]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent)
  },

  addCommands() {
    return {
      setImage: (options: { src: string; alt?: string; title?: string }) => ({ commands }: { commands: { insertContent: (content: { type: string; attrs: typeof options }) => boolean } }) => {
        return commands.insertContent({
          type: this.name,
          attrs: options,
        })
      },
    }
  },
})


// Read-only image component for public view
function ReadOnlyImageComponent({ node }: NodeViewProps) {
  const { t } = useTranslation()
  const { src, alt, width, height } = node.attrs as { 
    src: string
    alt?: string
    title?: string
    width?: number
    height?: number 
  }

  // Handle copy image
  const handleCopyImage = useCallback(async () => {
    try {
      const response = await fetch(src)
      const blob = await response.blob()
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ])
    } catch {
      navigator.clipboard.writeText(src)
    }
  }, [src])

  // Handle download image
  const handleDownloadImage = useCallback(() => {
    const link = document.createElement('a')
    link.href = src
    link.download = alt || 'image'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [src, alt])

  return (
    <NodeViewWrapper className="relative inline-block my-2">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <img
            src={src}
            alt={alt || ''}
            draggable={false}
            className="max-w-full rounded-lg"
            style={{
              width: width ? `${width}px` : 'auto',
              height: height ? `${height}px` : 'auto',
            }}
          />
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={handleCopyImage}>
            <Copy className="w-4 h-4 mr-2" />
            {t('contextMenu.copy')}
          </ContextMenuItem>
          <ContextMenuItem onClick={handleDownloadImage}>
            <Download className="w-4 h-4 mr-2" />
            {t('contextMenu.download')}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </NodeViewWrapper>
  )
}

// Read-only Image Extension for public view (no resize, no edit)
export const ReadOnlyImage = Node.create({
  name: 'image',
  
  group: 'block',
  
  draggable: false,
  
  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
      width: {
        default: null,
      },
      height: {
        default: null,
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'img[src]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ReadOnlyImageComponent)
  },
})
