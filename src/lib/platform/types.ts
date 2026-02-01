/**
 * Platform Types
 * Type definitions for platform-specific functionality
 */

import type { User } from '@/types'

/**
 * Platform type - identifies the execution environment
 */
export type Platform = 'web' | 'extension'

/**
 * Authentication result returned by platform login methods
 */
export interface AuthResult {
  success: boolean
  user?: User
  error?: string
}

/**
 * Token refresh result returned by platform refresh methods
 */
export interface TokenRefreshResult {
  success: boolean
  token?: string
  expiresIn?: number
}

/**
 * Platform-specific configuration options
 */
export interface PlatformConfig {
  platform: Platform
  supportsOAuth: boolean
  supportsChromeIdentity: boolean
  supportsRouting: boolean
  supportsPWA: boolean
}
