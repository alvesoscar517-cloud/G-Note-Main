import { useState, useEffect, useCallback } from 'react'

// Toolbar feature priority levels
// Lower number = higher priority (always visible on smaller screens)
export type ToolbarPriority = 1 | 2 | 3 | 4 | 5

// Breakpoint thresholds (in pixels)
const BREAKPOINTS = {
  xs: 0,      // Always visible
  sm: 480,    // Small mobile
  md: 640,    // Large mobile / small tablet
  lg: 800,    // Tablet
  xl: 1024,   // Desktop
} as const

// Map priority to minimum width required
const PRIORITY_BREAKPOINTS: Record<ToolbarPriority, number> = {
  1: BREAKPOINTS.xs,   // Always visible: AI, Voice, Bold, Italic, Underline, Undo, Redo, Delete
  2: BREAKPOINTS.sm,   // Small+: Strikethrough, Highlight, H1, Bullet List
  3: BREAKPOINTS.md,   // Medium+: H2, H3, Ordered List, Task List, Align Left
  4: BREAKPOINTS.lg,   // Large+: Other alignments, Code, Quote, Link
  5: BREAKPOINTS.xl,   // XL+: Sub/Superscript, HR, Clear, Image, Drawing, Style, Share, History, Fullscreen
}

export interface ToolbarVisibility {
  // Priority 1 - Always visible
  ai: boolean
  voice: boolean
  bold: boolean
  italic: boolean
  underline: boolean
  undo: boolean
  redo: boolean
  delete: boolean
  drawing: boolean
  style: boolean
  share: boolean
  history: boolean
  fullscreen: boolean
  image: boolean
  
  // Priority 2 - sm+
  strikethrough: boolean
  highlight: boolean
  heading1: boolean
  bulletList: boolean
  
  // Priority 3 - md+
  heading2: boolean
  heading3: boolean
  orderedList: boolean
  taskList: boolean
  alignLeft: boolean
  
  // Priority 4 - lg+
  alignCenter: boolean
  alignRight: boolean
  alignJustify: boolean
  inlineCode: boolean
  codeBlock: boolean
  blockquote: boolean
  link: boolean
  
  // Priority 5 - xl+
  subscript: boolean
  superscript: boolean
  horizontalRule: boolean
  clearFormatting: boolean
  exportImport: boolean
  
  // Dividers visibility
  dividerAfterVoice: boolean
  dividerAfterHighlight: boolean
  dividerAfterHeadings: boolean
  dividerAfterLists: boolean
  dividerAfterAlignment: boolean
  dividerAfterCode: boolean
  dividerAfterSubscript: boolean
  dividerAfterLink: boolean
  dividerAfterStyle: boolean
  dividerAfterUndoRedo: boolean
}

function getVisibilityForWidth(width: number): ToolbarVisibility {
  const p1 = width >= PRIORITY_BREAKPOINTS[1]
  const p2 = width >= PRIORITY_BREAKPOINTS[2]
  const p3 = width >= PRIORITY_BREAKPOINTS[3]
  const p4 = width >= PRIORITY_BREAKPOINTS[4]
  const p5 = width >= PRIORITY_BREAKPOINTS[5]
  
  return {
    // Priority 1 - Always visible
    ai: p1,
    voice: p1,
    bold: p1,
    italic: p1,
    underline: p1,
    undo: p1,
    redo: p1,
    delete: p1,
    drawing: p1,
    style: p1,
    share: p1,
    history: p1,
    fullscreen: p1,
    image: p1,
    
    // Priority 2 - sm+
    strikethrough: p2,
    highlight: p2,
    heading1: p2,
    bulletList: p2,
    
    // Priority 3 - md+
    heading2: p3,
    heading3: p3,
    orderedList: p3,
    taskList: p3,
    alignLeft: p3,
    
    // Priority 4 - lg+
    alignCenter: p4,
    alignRight: p4,
    alignJustify: p4,
    inlineCode: p4,
    codeBlock: p4,
    blockquote: p4,
    link: p4,
    
    // Priority 5 - xl+
    subscript: p5,
    superscript: p5,
    horizontalRule: p5,
    clearFormatting: p5,
    exportImport: p5,
    
    // Dividers - show only when adjacent items are visible
    dividerAfterVoice: p1,
    dividerAfterHighlight: p2,
    dividerAfterHeadings: p2,
    dividerAfterLists: p3,
    dividerAfterAlignment: p4,
    dividerAfterCode: p4,
    dividerAfterSubscript: p5,
    dividerAfterLink: p5,
    dividerAfterStyle: p5,
    dividerAfterUndoRedo: p5,
  }
}

export function useResponsiveToolbar(containerRef?: React.RefObject<HTMLElement | null>) {
  const [visibility, setVisibility] = useState<ToolbarVisibility>(() => 
    getVisibilityForWidth(typeof window !== 'undefined' ? window.innerWidth : 1024)
  )
  
  const updateVisibility = useCallback(() => {
    // Use container width if available, otherwise use window width
    const width = containerRef?.current?.offsetWidth ?? window.innerWidth
    setVisibility(getVisibilityForWidth(width))
  }, [containerRef])
  
  useEffect(() => {
    // Initial update
    updateVisibility()
    
    // Listen to window resize
    window.addEventListener('resize', updateVisibility)
    
    // Use ResizeObserver for container if provided
    let resizeObserver: ResizeObserver | null = null
    if (containerRef?.current) {
      resizeObserver = new ResizeObserver(updateVisibility)
      resizeObserver.observe(containerRef.current)
    }
    
    return () => {
      window.removeEventListener('resize', updateVisibility)
      resizeObserver?.disconnect()
    }
  }, [updateVisibility, containerRef])
  
  return visibility
}

// CSS class helper for conditional rendering
export function getToolbarClass(visible: boolean): string {
  return visible ? '' : 'hidden'
}
