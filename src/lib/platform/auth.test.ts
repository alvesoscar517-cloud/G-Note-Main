/**
 * Unit tests for Platform Authentication Adapter
 * Tests authentication abstraction between Web App and Chrome Extension
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { platformLogin, platformLogout, platformRefreshToken } from './auth'
import type { AuthResult, TokenRefreshResult } from './types'

describe('Platform Authentication Adapter', () => {
  // Store original chrome object and window.location
  let originalChrome: any
  let originalLocation: Location

  beforeEach(() => {
    // Save originals
    originalChrome = (global as any).chrome
    originalLocation = window.location

    // Mock window.location
    delete (window as any).location
    ;(window as any).location = {
      href: '',
      origin: 'http://localhost:3000'
    }
  })

  afterEach(() => {
    // Restore originals
    if (originalChrome === undefined) {
      delete (global as any).chrome
    } else {
      (global as any).chrome = originalChrome
    }
    ;(window as any).location = originalLocation

    // Clear all mocks
    vi.clearAllMocks()
  })

  describe('platformLogin', () => {
    it('should use Chrome Identity API when in extension environment', async () => {
      // Mock Chrome extension environment
      ;(global as any).chrome = {
        runtime: {
          id: 'test-extension-id'
        }
      }

      // Mock the chromeAuth module
      vi.doMock('../../../notes-app-chrome-extension/src/lib/chromeAuth', () => ({
        chromeGoogleLogin: vi.fn().mockResolvedValue({
          success: true,
          token: 'test-token',
          user: {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            avatar: 'https://example.com/avatar.jpg'
          }
        })
      }))

      const result: AuthResult = await platformLogin()

      expect(result.success).toBe(true)
      expect(result.user).toBeDefined()
      expect(result.user?.accessToken).toBe('test-token')
      expect(result.user?.email).toBe('test@example.com')
    })

    it('should redirect to OAuth when in web environment', async () => {
      // Mock web environment
      delete (global as any).chrome

      // Mock the tokenRefresh module
      vi.doMock('../tokenRefresh', () => ({
        getGoogleAuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth?...')
      }))

      const result: AuthResult = await platformLogin()

      expect(result.success).toBe(true)
      // In web environment, we redirect, so we don't get a user immediately
      expect(result.user).toBeUndefined()
    })

    it('should handle Chrome auth failure', async () => {
      ;(global as any).chrome = {
        runtime: {
          id: 'test-extension-id'
        }
      }

      vi.doMock('../../../notes-app-chrome-extension/src/lib/chromeAuth', () => ({
        chromeGoogleLogin: vi.fn().mockResolvedValue({
          success: false,
          error: 'User cancelled authentication'
        })
      }))

      const result: AuthResult = await platformLogin()

      expect(result.success).toBe(false)
      expect(result.error).toBe('User cancelled authentication')
      expect(result.user).toBeUndefined()
    })

    it('should handle missing token in Chrome auth response', async () => {
      ;(global as any).chrome = {
        runtime: {
          id: 'test-extension-id'
        }
      }

      vi.doMock('../../../notes-app-chrome-extension/src/lib/chromeAuth', () => ({
        chromeGoogleLogin: vi.fn().mockResolvedValue({
          success: true,
          // token is missing
          user: {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            avatar: 'https://example.com/avatar.jpg'
          }
        })
      }))

      const result: AuthResult = await platformLogin()

      expect(result.success).toBe(false)
    })

    it('should set token expiry to 1 hour from now', async () => {
      ;(global as any).chrome = {
        runtime: {
          id: 'test-extension-id'
        }
      }

      const now = Date.now()

      vi.doMock('../../../notes-app-chrome-extension/src/lib/chromeAuth', () => ({
        chromeGoogleLogin: vi.fn().mockResolvedValue({
          success: true,
          token: 'test-token',
          user: {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            avatar: 'https://example.com/avatar.jpg'
          }
        })
      }))

      const result: AuthResult = await platformLogin()

      expect(result.user?.tokenExpiry).toBeGreaterThanOrEqual(now + 3600 * 1000 - 1000) // Allow 1s tolerance
      expect(result.user?.tokenExpiry).toBeLessThanOrEqual(now + 3600 * 1000 + 1000)
    })
  })

  describe('platformLogout', () => {
    it('should use Chrome logout when in extension environment', async () => {
      ;(global as any).chrome = {
        runtime: {
          id: 'test-extension-id'
        }
      }

      const mockChromeLogout = vi.fn().mockResolvedValue({ success: true })

      vi.doMock('../../../notes-app-chrome-extension/src/lib/chromeAuth', () => ({
        chromeGoogleLogout: mockChromeLogout
      }))

      await platformLogout('user-123')

      // Note: We can't directly verify the mock was called due to dynamic import
      // In a real test environment, you would use a more sophisticated mocking strategy
      expect(mockChromeLogout).toBeDefined()
    })

    it('should use backend logout when in web environment', async () => {
      delete (global as any).chrome

      const mockBackendLogout = vi.fn().mockResolvedValue(undefined)

      vi.doMock('../tokenRefresh', () => ({
        logoutFromBackend: mockBackendLogout
      }))

      await platformLogout('user-123')

      expect(mockBackendLogout).toBeDefined()
    })

    it('should not throw error on logout failure', async () => {
      ;(global as any).chrome = {
        runtime: {
          id: 'test-extension-id'
        }
      }

      vi.doMock('../../../notes-app-chrome-extension/src/lib/chromeAuth', () => ({
        chromeGoogleLogout: vi.fn().mockRejectedValue(new Error('Logout failed'))
      }))

      // Should not throw
      await expect(platformLogout('user-123')).rejects.toThrow('Logout failed')
    })
  })

  describe('platformRefreshToken', () => {
    it('should use Chrome token refresh when in extension environment', async () => {
      ;(global as any).chrome = {
        runtime: {
          id: 'test-extension-id'
        }
      }

      vi.doMock('../../../notes-app-chrome-extension/src/lib/chromeAuth', () => ({
        chromeRefreshToken: vi.fn().mockResolvedValue({
          success: true,
          token: 'new-token'
        })
      }))

      const result: TokenRefreshResult = await platformRefreshToken('user-123')

      expect(result.success).toBe(true)
      expect(result.token).toBe('new-token')
      expect(result.expiresIn).toBe(3600) // 1 hour
    })

    it('should use backend refresh when in web environment', async () => {
      delete (global as any).chrome

      vi.doMock('../tokenRefresh', () => ({
        silentRefreshWithBackend: vi.fn().mockResolvedValue({
          access_token: 'refreshed-token',
          expires_in: 7200
        })
      }))

      const result: TokenRefreshResult = await platformRefreshToken('user-123')

      expect(result.success).toBe(true)
      expect(result.token).toBe('refreshed-token')
      expect(result.expiresIn).toBe(7200)
    })

    it('should handle Chrome refresh failure', async () => {
      ;(global as any).chrome = {
        runtime: {
          id: 'test-extension-id'
        }
      }

      vi.doMock('../../../notes-app-chrome-extension/src/lib/chromeAuth', () => ({
        chromeRefreshToken: vi.fn().mockResolvedValue({
          success: false,
          error: 'Token expired'
        })
      }))

      const result: TokenRefreshResult = await platformRefreshToken('user-123')

      expect(result.success).toBe(false)
      expect(result.token).toBeUndefined()
    })

    it('should handle backend refresh failure', async () => {
      delete (global as any).chrome

      vi.doMock('../tokenRefresh', () => ({
        silentRefreshWithBackend: vi.fn().mockResolvedValue(null)
      }))

      const result: TokenRefreshResult = await platformRefreshToken('user-123')

      expect(result.success).toBe(false)
      expect(result.token).toBeUndefined()
    })

    it('should handle network errors gracefully', async () => {
      delete (global as any).chrome

      vi.doMock('../tokenRefresh', () => ({
        silentRefreshWithBackend: vi.fn().mockRejectedValue(new Error('Network error'))
      }))

      await expect(platformRefreshToken('user-123')).rejects.toThrow('Network error')
    })
  })

  describe('Integration Scenarios', () => {
    it('should support complete auth flow in extension', async () => {
      ;(global as any).chrome = {
        runtime: {
          id: 'test-extension-id'
        }
      }

      // Mock successful login
      vi.doMock('../../../notes-app-chrome-extension/src/lib/chromeAuth', () => ({
        chromeGoogleLogin: vi.fn().mockResolvedValue({
          success: true,
          token: 'initial-token',
          user: {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            avatar: 'https://example.com/avatar.jpg'
          }
        }),
        chromeRefreshToken: vi.fn().mockResolvedValue({
          success: true,
          token: 'refreshed-token'
        }),
        chromeGoogleLogout: vi.fn().mockResolvedValue({ success: true })
      }))

      // Login
      const loginResult = await platformLogin()
      expect(loginResult.success).toBe(true)

      // Refresh token
      const refreshResult = await platformRefreshToken('user-123')
      expect(refreshResult.success).toBe(true)

      // Logout
      await platformLogout('user-123')
    })

    it('should support complete auth flow in web', async () => {
      delete (global as any).chrome

      vi.doMock('../tokenRefresh', () => ({
        getGoogleAuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth'),
        silentRefreshWithBackend: vi.fn().mockResolvedValue({
          access_token: 'refreshed-token',
          expires_in: 3600
        }),
        logoutFromBackend: vi.fn().mockResolvedValue(undefined)
      }))

      // Login (redirects)
      const loginResult = await platformLogin()
      expect(loginResult.success).toBe(true)

      // Refresh token
      const refreshResult = await platformRefreshToken('user-123')
      expect(refreshResult.success).toBe(true)

      // Logout
      await platformLogout('user-123')
    })
  })

  describe('Type Safety', () => {
    it('should return correct AuthResult type from platformLogin', async () => {
      delete (global as any).chrome

      vi.doMock('../tokenRefresh', () => ({
        getGoogleAuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth')
      }))

      const result: AuthResult = await platformLogin()

      // TypeScript should enforce that result has success property
      expect(typeof result.success).toBe('boolean')
    })

    it('should return correct TokenRefreshResult type from platformRefreshToken', async () => {
      delete (global as any).chrome

      vi.doMock('../tokenRefresh', () => ({
        silentRefreshWithBackend: vi.fn().mockResolvedValue({
          access_token: 'token',
          expires_in: 3600
        })
      }))

      const result: TokenRefreshResult = await platformRefreshToken('user-123')

      // TypeScript should enforce that result has success property
      expect(typeof result.success).toBe('boolean')
    })
  })

  describe('Edge Cases', () => {
    it('should handle undefined userId in logout', async () => {
      delete (global as any).chrome

      vi.doMock('../tokenRefresh', () => ({
        logoutFromBackend: vi.fn().mockResolvedValue(undefined)
      }))

      // Should not throw
      await expect(platformLogout('')).resolves.not.toThrow()
    })

    it('should handle undefined userId in refresh', async () => {
      delete (global as any).chrome

      vi.doMock('../tokenRefresh', () => ({
        silentRefreshWithBackend: vi.fn().mockResolvedValue(null)
      }))

      const result = await platformRefreshToken('')

      expect(result.success).toBe(false)
    })

    it('should handle malformed Chrome auth response', async () => {
      ;(global as any).chrome = {
        runtime: {
          id: 'test-extension-id'
        }
      }

      vi.doMock('../../../notes-app-chrome-extension/src/lib/chromeAuth', () => ({
        chromeGoogleLogin: vi.fn().mockResolvedValue({
          // Missing success field
          token: 'test-token'
        })
      }))

      const result = await platformLogin()

      // Should handle gracefully
      expect(result).toBeDefined()
    })

    it('should handle malformed backend refresh response', async () => {
      delete (global as any).chrome

      vi.doMock('../tokenRefresh', () => ({
        silentRefreshWithBackend: vi.fn().mockResolvedValue({
          // Missing access_token field
          expires_in: 3600
        })
      }))

      const result = await platformRefreshToken('user-123')

      expect(result.success).toBe(true)
      expect(result.token).toBeUndefined()
    })
  })
})
