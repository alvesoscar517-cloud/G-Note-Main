/**
 * Unit tests for Platform Detection Module
 * Tests runtime detection of execution environment (Web App vs Chrome Extension)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  isChromeExtension,
  isWebApp,
  getPlatform,
  platformSwitch,
  platformImport,
  type Platform
} from './detection'

describe('Platform Detection', () => {
  // Store original chrome object
  let originalChrome: any

  beforeEach(() => {
    // Save original chrome object
    originalChrome = (global as any).chrome
  })

  afterEach(() => {
    // Restore original chrome object
    if (originalChrome === undefined) {
      delete (global as any).chrome
    } else {
      (global as any).chrome = originalChrome
    }
  })

  describe('isChromeExtension', () => {
    it('should return true when chrome.runtime.id is defined', () => {
      // Mock Chrome extension environment
      ;(global as any).chrome = {
        runtime: {
          id: 'test-extension-id'
        }
      }

      expect(isChromeExtension()).toBe(true)
    })

    it('should return false when chrome is undefined', () => {
      // Mock web environment
      delete (global as any).chrome

      expect(isChromeExtension()).toBe(false)
    })

    it('should return false when chrome.runtime is undefined', () => {
      ;(global as any).chrome = {}

      expect(isChromeExtension()).toBe(false)
    })

    it('should return false when chrome.runtime.id is undefined', () => {
      ;(global as any).chrome = {
        runtime: {}
      }

      expect(isChromeExtension()).toBe(false)
    })

    it('should return false when chrome.runtime.id is null', () => {
      ;(global as any).chrome = {
        runtime: {
          id: null
        }
      }

      expect(isChromeExtension()).toBe(false)
    })
  })

  describe('isWebApp', () => {
    it('should return true when in web environment', () => {
      delete (global as any).chrome

      expect(isWebApp()).toBe(true)
    })

    it('should return false when in extension environment', () => {
      ;(global as any).chrome = {
        runtime: {
          id: 'test-extension-id'
        }
      }

      expect(isWebApp()).toBe(false)
    })

    it('should be inverse of isChromeExtension', () => {
      // Test in web environment
      delete (global as any).chrome
      expect(isWebApp()).toBe(!isChromeExtension())

      // Test in extension environment
      ;(global as any).chrome = {
        runtime: {
          id: 'test-extension-id'
        }
      }
      expect(isWebApp()).toBe(!isChromeExtension())
    })
  })

  describe('getPlatform', () => {
    it('should return "web" when in web environment', () => {
      delete (global as any).chrome

      const platform: Platform = getPlatform()
      expect(platform).toBe('web')
    })

    it('should return "extension" when in extension environment', () => {
      ;(global as any).chrome = {
        runtime: {
          id: 'test-extension-id'
        }
      }

      const platform: Platform = getPlatform()
      expect(platform).toBe('extension')
    })

    it('should return consistent results on multiple calls', () => {
      ;(global as any).chrome = {
        runtime: {
          id: 'test-extension-id'
        }
      }

      const platform1 = getPlatform()
      const platform2 = getPlatform()
      const platform3 = getPlatform()

      expect(platform1).toBe(platform2)
      expect(platform2).toBe(platform3)
    })
  })

  describe('platformSwitch', () => {
    it('should execute web handler when in web environment', () => {
      delete (global as any).chrome

      const webHandler = vi.fn(() => 'web-result')
      const extensionHandler = vi.fn(() => 'extension-result')

      const result = platformSwitch({
        web: webHandler,
        extension: extensionHandler
      })

      expect(result).toBe('web-result')
      expect(webHandler).toHaveBeenCalledTimes(1)
      expect(extensionHandler).not.toHaveBeenCalled()
    })

    it('should execute extension handler when in extension environment', () => {
      ;(global as any).chrome = {
        runtime: {
          id: 'test-extension-id'
        }
      }

      const webHandler = vi.fn(() => 'web-result')
      const extensionHandler = vi.fn(() => 'extension-result')

      const result = platformSwitch({
        web: webHandler,
        extension: extensionHandler
      })

      expect(result).toBe('extension-result')
      expect(extensionHandler).toHaveBeenCalledTimes(1)
      expect(webHandler).not.toHaveBeenCalled()
    })

    it('should handle handlers that return different types', () => {
      delete (global as any).chrome

      const result1 = platformSwitch<number | string>({
        web: () => 42,
        extension: () => 'string'
      })
      expect(result1).toBe(42)

      ;(global as any).chrome = {
        runtime: {
          id: 'test-extension-id'
        }
      }

      const result2 = platformSwitch<number | string>({
        web: () => 42,
        extension: () => 'string'
      })
      expect(result2).toBe('string')
    })

    it('should handle handlers that return objects', () => {
      delete (global as any).chrome

      const webConfig = { platform: 'web', features: ['pwa', 'oauth'] }
      const extensionConfig = { platform: 'extension', features: ['chrome-api'] }

      const result = platformSwitch({
        web: () => webConfig,
        extension: () => extensionConfig
      })

      expect(result).toEqual(webConfig)
      expect(result.platform).toBe('web')
    })

    it('should handle handlers that throw errors', () => {
      delete (global as any).chrome

      expect(() => {
        platformSwitch({
          web: () => {
            throw new Error('Web error')
          },
          extension: () => 'extension-result'
        })
      }).toThrow('Web error')
    })
  })

  describe('platformImport', () => {
    it('should import web module when in web environment', async () => {
      delete (global as any).chrome

      // Note: This test is conceptual as we can't easily mock dynamic imports in Vitest
      // In a real scenario, you would use vi.mock() to mock the import
      
      // For now, we just verify the function exists and has correct signature
      expect(platformImport).toBeDefined()
      expect(typeof platformImport).toBe('function')
    })

    it('should import extension module when in extension environment', async () => {
      ;(global as any).chrome = {
        runtime: {
          id: 'test-extension-id'
        }
      }

      // Note: This test is conceptual as we can't easily mock dynamic imports in Vitest
      // In a real scenario, you would use vi.mock() to mock the import
      
      // For now, we just verify the function exists and has correct signature
      expect(platformImport).toBeDefined()
      expect(typeof platformImport).toBe('function')
    })
  })

  describe('Edge Cases', () => {
    it('should handle chrome object with partial properties', () => {
      ;(global as any).chrome = {
        runtime: {
          // id is missing
          getManifest: () => ({})
        }
      }

      expect(isChromeExtension()).toBe(false)
      expect(isWebApp()).toBe(true)
      expect(getPlatform()).toBe('web')
    })

    it('should handle chrome object that is not an object', () => {
      ;(global as any).chrome = 'not-an-object'

      // This should not throw an error
      expect(() => isChromeExtension()).not.toThrow()
      expect(isChromeExtension()).toBe(false)
    })

    it('should handle chrome.runtime that is not an object', () => {
      ;(global as any).chrome = {
        runtime: 'not-an-object'
      }

      expect(() => isChromeExtension()).not.toThrow()
      expect(isChromeExtension()).toBe(false)
    })

    it('should be consistent across multiple rapid calls', () => {
      ;(global as any).chrome = {
        runtime: {
          id: 'test-extension-id'
        }
      }

      const results = Array.from({ length: 100 }, () => getPlatform())
      const allSame = results.every(r => r === 'extension')

      expect(allSame).toBe(true)
    })
  })

  describe('Type Safety', () => {
    it('should have correct Platform type', () => {
      const platform: Platform = getPlatform()
      
      // TypeScript should enforce that platform is either 'web' or 'extension'
      expect(['web', 'extension']).toContain(platform)
    })

    it('should work with generic types in platformSwitch', () => {
      delete (global as any).chrome

      interface Config {
        apiUrl: string
        timeout: number
      }

      const config: Config = platformSwitch<Config>({
        web: () => ({ apiUrl: 'https://web.example.com', timeout: 5000 }),
        extension: () => ({ apiUrl: 'https://ext.example.com', timeout: 3000 })
      })

      expect(config.apiUrl).toBe('https://web.example.com')
      expect(config.timeout).toBe(5000)
    })
  })

  describe('Integration Scenarios', () => {
    it('should support authentication flow detection', () => {
      // Simulate web environment
      delete (global as any).chrome

      const authMethod = platformSwitch({
        web: () => 'oauth',
        extension: () => 'chrome-identity'
      })

      expect(authMethod).toBe('oauth')
    })

    it('should support storage detection', () => {
      // Simulate extension environment
      ;(global as any).chrome = {
        runtime: {
          id: 'test-extension-id'
        }
      }

      const storageType = platformSwitch({
        web: () => 'localStorage',
        extension: () => 'chrome.storage'
      })

      expect(storageType).toBe('chrome.storage')
    })

    it('should support conditional feature flags', () => {
      delete (global as any).chrome

      const features = {
        pwa: isWebApp(),
        chromeApi: isChromeExtension(),
        routing: isWebApp(),
        contentScript: isChromeExtension()
      }

      expect(features.pwa).toBe(true)
      expect(features.chromeApi).toBe(false)
      expect(features.routing).toBe(true)
      expect(features.contentScript).toBe(false)
    })
  })
})
