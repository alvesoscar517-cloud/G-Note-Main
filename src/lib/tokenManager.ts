/**
 * Token Manager - Centralized token validation and refresh
 * Ensures valid access token before any Google API call
 */

import { useAuthStore } from '@/stores/authStore'
import { silentRefreshWithBackend, hasAuthBackend } from './tokenRefresh'

// Token expiry buffer (5 minutes)
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000

/**
 * TokenManager class - Handles token validation and refresh
 */
class TokenManager {
  private refreshPromise: Promise<string | null> | null = null

  /**
   * Get a valid access token, refreshing if necessary
   */
  async getValidToken(): Promise<string | null> {
    const { user } = useAuthStore.getState()
    
    if (!user?.accessToken) {
      console.log('[TokenManager] No user or access token')
      return null
    }

    // Check if token is still valid (with buffer)
    if (!this.isExpired(user.tokenExpiry)) {
      return user.accessToken
    }

    console.log('[TokenManager] Token expired or expiring soon, refreshing...')

    // If already refreshing, wait for that to complete
    if (this.refreshPromise) {
      return this.refreshPromise
    }

    // Start refresh
    this.refreshPromise = this.refresh()
    
    try {
      const newToken = await this.refreshPromise
      return newToken
    } finally {
      this.refreshPromise = null
    }
  }

  /**
   * Refresh the access token
   */
  private async refresh(): Promise<string | null> {
    const { user, setUser } = useAuthStore.getState()
    
    if (!user) return null

    try {
      // Try backend refresh (has refresh token)
      if (hasAuthBackend()) {
        const result = await silentRefreshWithBackend(user.id)
        if (result?.access_token) {
          const newExpiry = Date.now() + (result.expires_in * 1000)
          setUser({
            ...user,
            accessToken: result.access_token,
            tokenExpiry: newExpiry
          })
          console.log('[TokenManager] Token refreshed successfully')
          return result.access_token
        }
      }

      // If backend refresh fails, user needs to re-login
      console.log('[TokenManager] Token refresh failed, user needs to re-login')
      return null
    } catch (error) {
      console.error('[TokenManager] Token refresh error:', error)
      return null
    }
  }

  /**
   * Check if token is expired (with buffer)
   */
  private isExpired(tokenExpiry?: number): boolean {
    if (!tokenExpiry) return true
    return Date.now() > tokenExpiry - TOKEN_EXPIRY_BUFFER_MS
  }

  /**
   * Get current token without refresh (for quick checks)
   */
  getCurrentToken(): string | null {
    const { user } = useAuthStore.getState()
    return user?.accessToken || null
  }
}

// Export singleton instance
export const tokenManager = new TokenManager()

/**
 * Get a valid access token (legacy function for backward compatibility)
 */
export async function getValidAccessToken(): Promise<string | null> {
  return tokenManager.getValidToken()
}

/**
 * Wrapper for API calls that automatically handles token refresh
 */
export async function withValidToken<T>(
  apiCall: (accessToken: string) => Promise<T>
): Promise<T> {
  const token = await tokenManager.getValidToken()
  
  if (!token) {
    throw new TokenExpiredError('Unable to get valid access token. Please sign in again.')
  }

  try {
    return await apiCall(token)
  } catch (error) {
    // Check if it's a 401 error (token invalid despite our check)
    if (error instanceof Error && error.message.includes('401')) {
      // Force token refresh and retry once
      const { user, setUser } = useAuthStore.getState()
      if (user) {
        // Clear current token expiry to force refresh
        setUser({ ...user, tokenExpiry: 0 })
        const newToken = await tokenManager.getValidToken()
        if (newToken) {
          return await apiCall(newToken)
        }
      }
      throw new TokenExpiredError('Session expired. Please sign in again.')
    }
    throw error
  }
}

/**
 * Check if token is expired (utility function)
 */
export function isTokenExpired(tokenExpiry?: number): boolean {
  if (!tokenExpiry) return true
  return Date.now() > tokenExpiry - TOKEN_EXPIRY_BUFFER_MS
}

export class TokenExpiredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TokenExpiredError'
  }
}
