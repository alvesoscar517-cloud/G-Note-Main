/**
 * Platform Abstraction Layer
 * 
 * This module provides a unified interface for platform-specific functionality,
 * allowing the codebase to work seamlessly across both Web App and Chrome Extension
 * environments without duplicating code.
 * 
 * @module platform
 * 
 * @example
 * ```typescript
 * import { isChromeExtension, platformLogin } from '@/lib/platform'
 * 
 * if (isChromeExtension()) {
 *   console.log('Running in Chrome Extension')
 * }
 * 
 * const result = await platformLogin()
 * ```
 */

// Export platform detection utilities
export {
  isChromeExtension,
  isWebApp,
  getPlatform,
  platformSwitch,
  platformImport
} from './detection'

// Export authentication adapters
export {
  platformLogin,
  platformLogout,
  platformRefreshToken
} from './auth'

// Export platform types
export type {
  Platform,
  AuthResult,
  TokenRefreshResult,
  PlatformConfig
} from './types'
