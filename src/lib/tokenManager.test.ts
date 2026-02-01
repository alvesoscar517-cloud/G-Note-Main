/**
 * Token Manager Tests
 * Tests for centralized token validation and refresh
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { tokenManager, getValidAccessToken, withValidToken, isTokenExpired, TokenExpiredError } from './tokenManager'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types'

// Mock the platform auth module
vi.mock('@/lib/platform/auth', () => ({
  platformRefreshToken: vi.fn()
}))

// Mock the auth store
vi.mock('@/stores/authStore', () => ({
  useAuthStore: {
    getState: vi.fn(),
    setState: vi.fn()
  }
}))

describe('Token Manager', () => {
  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    avatar: 'https://example.com/avatar.jpg',
    accessToken: 'valid-token',
    tokenExpiry: Date.now() + 3600 * 1000 // 1 hour from now
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getValidToken', () => {
    it('should return current token if not expired', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({
        user: mockUser,
        setUser: vi.fn()
      } as any)

      const token = await tokenManager.getValidToken()

      expect(token).toBe('valid-token')
    })

    it('should return null if no user', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({
        user: null,
        setUser: vi.fn()
      } as any)

      const token = await tokenManager.getValidToken()

      expect(token).toBeNull()
    })

    it('should return null if no access token', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({
        user: { ...mockUser, accessToken: undefined },
        setUser: vi.fn()
      } as any)

      const token = await tokenManager.getValidToken()

      expect(token).toBeNull()
    })

    it('should refresh token if expired', async () => {
      const expiredUser = {
        ...mockUser,
        tokenExpiry: Date.now() - 1000 // Expired 1 second ago
      }

      const setUserMock = vi.fn()
      vi.mocked(useAuthStore.getState).mockReturnValue({
        user: expiredUser,
        setUser: setUserMock
      } as any)

      // Mock platformRefreshToken
      const { platformRefreshToken } = await import('@/lib/platform/auth')
      vi.mocked(platformRefreshToken).mockResolvedValue({
        success: true,
        token: 'refreshed-token',
        expiresIn: 3600
      })

      const token = await tokenManager.getValidToken()

      expect(token).toBe('refreshed-token')
      expect(platformRefreshToken).toHaveBeenCalledWith('user-123')
      expect(setUserMock).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: 'refreshed-token',
          tokenExpiry: expect.any(Number)
        })
      )
    })

    it('should return null if refresh fails', async () => {
      const expiredUser = {
        ...mockUser,
        tokenExpiry: Date.now() - 1000
      }

      vi.mocked(useAuthStore.getState).mockReturnValue({
        user: expiredUser,
        setUser: vi.fn()
      } as any)

      const { platformRefreshToken } = await import('@/lib/platform/auth')
      vi.mocked(platformRefreshToken).mockResolvedValue({
        success: false
      })

      const token = await tokenManager.getValidToken()

      expect(token).toBeNull()
    })

    it('should handle refresh errors gracefully', async () => {
      const expiredUser = {
        ...mockUser,
        tokenExpiry: Date.now() - 1000
      }

      vi.mocked(useAuthStore.getState).mockReturnValue({
        user: expiredUser,
        setUser: vi.fn()
      } as any)

      const { platformRefreshToken } = await import('@/lib/platform/auth')
      vi.mocked(platformRefreshToken).mockRejectedValue(new Error('Network error'))

      const token = await tokenManager.getValidToken()

      expect(token).toBeNull()
    })

    it('should not start multiple refresh operations', async () => {
      const expiredUser = {
        ...mockUser,
        tokenExpiry: Date.now() - 1000
      }

      const setUserMock = vi.fn()
      vi.mocked(useAuthStore.getState).mockReturnValue({
        user: expiredUser,
        setUser: setUserMock
      } as any)

      const { platformRefreshToken } = await import('@/lib/platform/auth')
      vi.mocked(platformRefreshToken).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          token: 'refreshed-token',
          expiresIn: 3600
        }), 100))
      )

      // Call getValidToken multiple times simultaneously
      const promises = [
        tokenManager.getValidToken(),
        tokenManager.getValidToken(),
        tokenManager.getValidToken()
      ]

      const tokens = await Promise.all(promises)

      // All should return the same token
      expect(tokens).toEqual(['refreshed-token', 'refreshed-token', 'refreshed-token'])
      // But platformRefreshToken should only be called once
      expect(platformRefreshToken).toHaveBeenCalledTimes(1)
    })
  })

  describe('getCurrentToken', () => {
    it('should return current token without refresh', () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({
        user: mockUser,
        setUser: vi.fn()
      } as any)

      const token = tokenManager.getCurrentToken()

      expect(token).toBe('valid-token')
    })

    it('should return null if no user', () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({
        user: null,
        setUser: vi.fn()
      } as any)

      const token = tokenManager.getCurrentToken()

      expect(token).toBeNull()
    })
  })

  describe('getValidAccessToken', () => {
    it('should be an alias for tokenManager.getValidToken', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({
        user: mockUser,
        setUser: vi.fn()
      } as any)

      const token = await getValidAccessToken()

      expect(token).toBe('valid-token')
    })
  })

  describe('withValidToken', () => {
    it('should call API with valid token', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({
        user: mockUser,
        setUser: vi.fn()
      } as any)

      const apiCall = vi.fn().mockResolvedValue({ data: 'success' })
      const result = await withValidToken(apiCall)

      expect(apiCall).toHaveBeenCalledWith('valid-token')
      expect(result).toEqual({ data: 'success' })
    })

    it('should throw TokenExpiredError if no token available', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({
        user: null,
        setUser: vi.fn()
      } as any)

      const apiCall = vi.fn()

      await expect(withValidToken(apiCall)).rejects.toThrow(TokenExpiredError)
      expect(apiCall).not.toHaveBeenCalled()
    })

    it('should retry once on 401 error', async () => {
      const setUserMock = vi.fn()
      
      // First call returns the original user, second call returns updated user
      let callCount = 0
      vi.mocked(useAuthStore.getState).mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return {
            user: mockUser,
            setUser: setUserMock
          } as any
        } else {
          // After setUser is called, return updated user
          return {
            user: {
              ...mockUser,
              accessToken: 'refreshed-token',
              tokenExpiry: Date.now() + 3600 * 1000
            },
            setUser: setUserMock
          } as any
        }
      })

      const { platformRefreshToken } = await import('@/lib/platform/auth')
      vi.mocked(platformRefreshToken).mockResolvedValue({
        success: true,
        token: 'refreshed-token',
        expiresIn: 3600
      })

      const apiCall = vi.fn()
        .mockRejectedValueOnce(new Error('401 Unauthorized'))
        .mockResolvedValueOnce({ data: 'success' })

      const result = await withValidToken(apiCall)

      expect(apiCall).toHaveBeenCalledTimes(2)
      expect(apiCall).toHaveBeenNthCalledWith(1, 'valid-token')
      expect(apiCall).toHaveBeenNthCalledWith(2, 'refreshed-token')
      expect(result).toEqual({ data: 'success' })
    })

    it('should throw TokenExpiredError if retry fails', async () => {
      const setUserMock = vi.fn()
      
      // First call: return user with valid token
      // Second call (after setUser): return user with expired token
      let callCount = 0
      vi.mocked(useAuthStore.getState).mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // Initial call - valid token
          return {
            user: mockUser,
            setUser: setUserMock
          } as any
        } else {
          // After setUser is called with tokenExpiry: 0
          return {
            user: {
              ...mockUser,
              tokenExpiry: 0 // Expired
            },
            setUser: setUserMock
          } as any
        }
      })

      const { platformRefreshToken } = await import('@/lib/platform/auth')
      // Mock refresh to fail
      vi.mocked(platformRefreshToken).mockResolvedValue({
        success: false
      })

      // API call fails with 401
      const apiCall = vi.fn().mockRejectedValue(new Error('401 Unauthorized'))

      // Should throw TokenExpiredError when retry fails
      await expect(withValidToken(apiCall)).rejects.toThrow(TokenExpiredError)
    })

    it('should propagate non-401 errors', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({
        user: mockUser,
        setUser: vi.fn()
      } as any)

      const apiCall = vi.fn().mockRejectedValue(new Error('Network error'))

      await expect(withValidToken(apiCall)).rejects.toThrow('Network error')
    })
  })

  describe('isTokenExpired', () => {
    it('should return true if no expiry', () => {
      expect(isTokenExpired(undefined)).toBe(true)
    })

    it('should return true if expired', () => {
      const expiry = Date.now() - 1000 // 1 second ago
      expect(isTokenExpired(expiry)).toBe(true)
    })

    it('should return true if expiring within buffer', () => {
      const expiry = Date.now() + 4 * 60 * 1000 // 4 minutes from now (within 5 min buffer)
      expect(isTokenExpired(expiry)).toBe(true)
    })

    it('should return false if not expired', () => {
      const expiry = Date.now() + 10 * 60 * 1000 // 10 minutes from now
      expect(isTokenExpired(expiry)).toBe(false)
    })
  })

  describe('TokenExpiredError', () => {
    it('should be an instance of Error', () => {
      const error = new TokenExpiredError('Test message')
      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('TokenExpiredError')
      expect(error.message).toBe('Test message')
    })
  })
})
