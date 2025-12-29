import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from '@tiptap/react'
import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2, Download, Copy } from 'lucide-react'
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
  const [showEditor, setShowEditor] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null)

  const { src, alt, width, height } = node.attrs as { 
    src: string
    alt?: string
    title?: string
    width?: number
    height?: number 
  }

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

  // Activate on click/touch - show toolbar immediately
  const handleImageClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    
    // Blur editor to prevent keyboard from opening
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    
    // Activate immediately on click (both mobile and desktop)
    setIsActive(true)
  }, [])

  // Touch handlers - activate immediately on tap
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Prevent default to stop editor from focusing
    e.stopPropagation()
    
    // Store touch position to detect if it's a tap or scroll
    const touch = e.touches[0]
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartPosRef.current) return
    
    // Cancel tap if finger moved too much (user is scrolling)
    const touch = e.touches[0]
    const deltaX = Math.abs(touch.clientX - touchStartPosRef.current.x)
    const deltaY = Math.abs(touch.clientY - touchStartPosRef.current.y)
    
    if (deltaX > 10 || deltaY > 10) {
      touchStartPosRef.current = null
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    // If touch position still exists, it was a tap (not a scroll)
    if (touchStartPosRef.current) {
      // Blur editor to prevent keyboard from opening
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
      setIsActive(true)
    }
    touchStartPosRef.current = null
  }, [])

  // Click outside to deactivate
  useEffect(() => {
    if (!isActive) return

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      // Don't deactivate if clicking on toolbar buttons or tooltip content
      const target = e.target as HTMLElement
      if (target.closest('[data-image-toolbar]') || target.closest('[data-radix-popper-content-wrapper]')) {
        return
      }
      if (containerRef.current && !containerRef.current.contains(e.target as globalThis.Node)) {
        setIsActive(false)
      }
    }

    // Use setTimeout to avoid immediate deactivation on the same click
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }, 0)
    
    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isActive])

  // Sync with editor selection
  useEffect(() => {
    if (selected) setIsActive(true)
  }, [selected])

  return (
    <NodeViewWrapper className="relative inline-block my-2">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={containerRef}
            className="relative inline-block"
            contentEditable={false}
            onClick={handleImageClick}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onMouseDown={(e) => {
              // Prevent editor from gaining focus when clicking image
              e.preventDefault()
              e.stopPropagation()
            }}
          >
            <img
              ref={imageRef}
              src={src}
              alt={alt || ''}
              draggable={false}
              className="max-w-full rounded-lg cursor-pointer"
              style={{
                width: width ? `${width}px` : 'auto',
                height: height ? `${height}px` : 'auto',
              }}
            />

            {/* Controls overlay - only show when active */}
            {isActive && (
              <div 
                data-image-toolbar
                contentEditable={false}
                className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-neutral-800 rounded-lg p-1 shadow-lg z-20"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  title={t('imageEditor.edit')}
                  onClick={(e) => { 
                    e.preventDefault()
                    e.stopPropagation()
                    // Blur any focused element to prevent keyboard from opening
                    if (document.activeElement instanceof HTMLElement) {
                      document.activeElement.blur()
                    }
                    setShowEditor(true) 
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                  }}
                  className="p-1.5 rounded hover:bg-neutral-700 text-white transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  title={t('imageEditor.delete')}
                  onClick={(e) => { 
                    e.preventDefault()
                    e.stopPropagation()
                    deleteNode() 
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                  }}
                  className="p-1.5 rounded hover:bg-neutral-700 text-white transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
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

      {/* Image Editor Modal - rendered via Portal to avoid TipTap interference */}
      {showEditor && createPortal(
        <ImageEditor
          src={src}
          onSave={handleEditSave}
          onCancel={() => setShowEditor(false)}
        />,
        document.body
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
