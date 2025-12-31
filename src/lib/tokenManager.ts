/**
 * Token Manager - Centralized token validation and refresh
 * Ensures valid access token before any Google API call
 */

import { useAuthStore } from '@/stores/authStore'
import { isTokenExpired, silentRefreshWithBackend, hasAuthBackend } from './tokenRefresh'

// Token refresh lock to prevent multiple simultaneous refreshes
let isRefreshing = false
let refreshPromise: Promise<string | null> | null = null

/**
 * Get a valid access token, refreshing if necessary
 * This should be called before any Google API request
 */
export async function getValidAccessToken(): Promise<string | null> {
  const { user, setUser } = useAuthStore.getState()
  
  if (!user?.accessToken) {
    console.log('[TokenManager] No user or access token')
    return null
  }

  // Check if token is still valid (with 5 min buffer)
  if (!isTokenExpired(user.tokenExpiry)) {
    return user.accessToken
  }

  console.log('[TokenManager] Token expired or expiring soon, refreshing...')

  // If already refreshing, wait for that to complete
  if (isRefreshing && refreshPromise) {
    return refreshPromise
  }

  // Start refresh
  isRefreshing = true
  refreshPromise = refreshToken(user.id, user, setUser)
  
  try {
    const newToken = await refreshPromise
    return newToken
  } finally {
    isRefreshing = false
    refreshPromise = null
  }
}

async function refreshToken(
  userId: string,
  currentUser: NonNullable<ReturnType<typeof useAuthStore.getState>['user']>,
  setUser: (user: typeof currentUser | null) => void
): Promise<string | null> {
  try {
    // Try backend refresh first (has refresh token)
    if (hasAuthBackend()) {
      const result = await silentRefreshWithBackend(userId)
      if (result?.access_token) {
        const newExpiry = Date.now() + (result.expires_in * 1000)
        setUser({
          ...currentUser,
          accessToken: result.access_token,
          tokenExpiry: newExpiry
        })
        console.log('[TokenManager] Token refreshed via backend')
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
 * Wrapper for API calls that automatically handles token refresh
 * If token refresh fails, throws an error that can trigger re-login
 */
export async function withValidToken<T>(
  apiCall: (accessToken: string) => Promise<T>
): Promise<T> {
  const token = await getValidAccessToken()
  
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
        const newToken = await getValidAccessToken()
        if (newToken) {
          return await apiCall(newToken)
        }
      }
      throw new TokenExpiredError('Session expired. Please sign in again.')
    }
    throw error
  }
}

export class TokenExpiredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TokenExpiredError'
  }
}
