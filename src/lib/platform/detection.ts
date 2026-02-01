/**
 * Platform Detection Utilities
 * Provides runtime detection of execution environment
 */

import type { Platform } from './types'

// Re-export Platform type for convenience
export type { Platform }

/**
 * Check if running in Chrome Extension context
 * @returns true if in extension, false otherwise
 */
export function isChromeExtension(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.runtime !== 'undefined' &&
    typeof chrome.runtime.id !== 'undefined' &&
    chrome.runtime.id !== null
  )
}

/**
 * Check if running in Web App context
 * @returns true if in web app, false otherwise
 */
export function isWebApp(): boolean {
  return !isChromeExtension()
}

/**
 * Get current platform
 * @returns 'web' or 'extension'
 */
export function getPlatform(): Platform {
  return isChromeExtension() ? 'extension' : 'web'
}

/**
 * Execute platform-specific code
 * @param handlers Object with web and extension handlers
 * @returns Result from the appropriate handler
 */
export function platformSwitch<T>(handlers: {
  web: () => T
  extension: () => T
}): T {
  return isChromeExtension() ? handlers.extension() : handlers.web()
}

/**
 * Conditionally import platform-specific module
 * @param webModule Path to web module
 * @param extensionModule Path to extension module
 * @returns Promise resolving to the appropriate module
 */
export async function platformImport<T>(
  webModule: string,
  extensionModule: string
): Promise<T> {
  if (isChromeExtension()) {
    return import(extensionModule)
  } else {
    return import(webModule)
  }
}
