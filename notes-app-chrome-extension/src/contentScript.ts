// Content script for capturing selected text with HTML formatting
// This script runs on all web pages when the extension is active

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === 'GET_SELECTED_HTML') {
    const selection = window.getSelection()
    
    if (!selection || selection.rangeCount === 0) {
      sendResponse({ html: '', text: '' })
      return true
    }
    
    const range = selection.getRangeAt(0)
    const container = document.createElement('div')
    container.appendChild(range.cloneContents())
    
    // Clean up the HTML - remove scripts, styles, and dangerous attributes
    const cleanHtml = sanitizeHtml(container)
    const plainText = selection.toString()
    
    sendResponse({
      html: cleanHtml,
      text: plainText,
      sourceUrl: window.location.href,
      sourceTitle: document.title
    })
    
    return true
  }
})

// Sanitize HTML to remove potentially dangerous content
function sanitizeHtml(container: HTMLElement): string {
  // Remove script and style tags
  const scripts = container.querySelectorAll('script, style, noscript')
  scripts.forEach(el => el.remove())
  
  // Remove dangerous attributes
  const allElements = container.querySelectorAll('*')
  allElements.forEach(el => {
    // Remove event handlers and javascript: URLs
    const attrs = Array.from(el.attributes)
    attrs.forEach(attr => {
      if (attr.name.startsWith('on') || 
          attr.value.toLowerCase().includes('javascript:')) {
        el.removeAttribute(attr.name)
      }
    })
    
    // Remove id attributes to avoid conflicts
    el.removeAttribute('id')
    
    // Clean up class names (keep only basic styling classes)
    // Remove classes that might conflict with TipTap styles
  })
  
  // Convert relative URLs to absolute
  const links = container.querySelectorAll('a[href]')
  links.forEach(link => {
    const href = link.getAttribute('href')
    if (href && !href.startsWith('http') && !href.startsWith('mailto:')) {
      try {
        const absoluteUrl = new URL(href, window.location.href).href
        link.setAttribute('href', absoluteUrl)
      } catch {
        // Invalid URL, leave as is
      }
    }
  })
  
  // Convert relative image URLs to absolute
  const images = container.querySelectorAll('img[src]')
  images.forEach(img => {
    const src = img.getAttribute('src')
    if (src && !src.startsWith('http') && !src.startsWith('data:')) {
      try {
        const absoluteUrl = new URL(src, window.location.href).href
        img.setAttribute('src', absoluteUrl)
      } catch {
        // Invalid URL, leave as is
      }
    }
  })
  
  return container.innerHTML
}

// Notify background script that content script is ready
chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY' })
