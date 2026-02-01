/**
 * Platform Authentication Adapter
 * Abstracts authentication differences between Web and Extension
 */

import { isChromeExtension } from './detection'
import type { AuthResult, TokenRefreshResult } from './types'
import type { User } from '@/types'

/**
 * Platform-agnostic login
 * Routes to appropriate auth method based on platform
 */
export async function platformLogin(): Promise<AuthResult> {
  if (isChromeExtension()) {
    // Dynamic import to avoid bundling Chrome-specific code in web build
    const { chromeGoogleLogin } = await import(
      '../../../notes-app-chrome-extension/src/lib/chromeAuth'
    )
    const result = await chromeGoogleLogin()
    
    if (result.success && result.token && result.user) {
      return {
        success: true,
        user: {
          ...result.user,
          accessToken: result.token,
          tokenExpiry: Date.now() + 3600 * 1000 // 1 hour
        } as User
      }
    }
    
    return { success: false, error: result.error }
  } else {
    // Web OAuth flow - redirect to Google
    const { getGoogleAuthUrl } = await import('../tokenRefresh')
    window.location.href = getGoogleAuthUrl()
    
    // Return pending state (actual result comes from OAuth callback)
    return { success: true }
  }
}

/**
 * Platform-agnostic logout
 * Routes to appropriate logout method based on platform
 */
export async function platformLogout(userId: string): Promise<void> {
  if (isChromeExtension()) {
    const { chromeGoogleLogout } = await import(
      '../../../notes-app-chrome-extension/src/lib/chromeAuth'
    )
    await chromeGoogleLogout()
  } else {
    const { logoutFromBackend } = await import('../tokenRefresh')
    await logoutFromBackend(userId)
  }
}

/**
 * Platform-agnostic token refresh
 * Routes to appropriate refresh method based on platform
 */
export async function platformRefreshToken(
  userId: string
): Promise<TokenRefreshResult> {
  if (isChromeExtension()) {
    const { chromeRefreshToken } = await import(
      '../../../notes-app-chrome-extension/src/lib/chromeAuth'
    )
    const result = await chromeRefreshToken()
    
    return {
      success: result.success,
      token: result.token,
      expiresIn: 3600 // 1 hour
    }
  } else {
    const { silentRefreshWithBackend } = await import('../tokenRefresh')
    const result = await silentRefreshWithBackend(userId)
    
    if (result) {
      return {
        success: true,
        token: result.access_token,
        expiresIn: result.expires_in
      }
    }
    
    return { success: false }
  }
}
