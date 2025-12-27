import { OAuth2Client } from 'google-auth-library'

// Support multiple OAuth clients for different platforms
// Format: GOOGLE_CLIENT_ID_<PLATFORM>=xxx, GOOGLE_CLIENT_SECRET_<PLATFORM>=xxx
// Platforms: WEB, EXTENSION, LOCALHOST (or default without suffix)

const OAUTH_CLIENTS = {}

// Default client (backward compatible)
if (process.env.GOOGLE_CLIENT_ID) {
  OAUTH_CLIENTS.default = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET
  }
}

// Web app client
if (process.env.GOOGLE_CLIENT_ID_WEB) {
  OAUTH_CLIENTS.web = {
    clientId: process.env.GOOGLE_CLIENT_ID_WEB,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET_WEB
  }
}

// Chrome extension client
if (process.env.GOOGLE_CLIENT_ID_EXTENSION) {
  OAUTH_CLIENTS.extension = {
    clientId: process.env.GOOGLE_CLIENT_ID_EXTENSION,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET_EXTENSION
  }
}

// Localhost/development client
if (process.env.GOOGLE_CLIENT_ID_LOCALHOST) {
  OAUTH_CLIENTS.localhost = {
    clientId: process.env.GOOGLE_CLIENT_ID_LOCALHOST,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET_LOCALHOST
  }
}

// Detect platform from redirectUri or origin
export function detectPlatform(redirectUri, origin) {
  if (!redirectUri && !origin) return 'default'
  
  const url = redirectUri || origin || ''
  
  // Chrome extension
  if (url.startsWith('chrome-extension://') || url.includes('chromiumapp.org')) {
    return OAUTH_CLIENTS.extension ? 'extension' : 'default'
  }
  
  // Localhost
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    return OAUTH_CLIENTS.localhost ? 'localhost' : 'default'
  }
  
  // Web app (production)
  if (OAUTH_CLIENTS.web) {
    return 'web'
  }
  
  return 'default'
}

// Get OAuth client config for platform
export function getOAuthConfig(platform) {
  return OAUTH_CLIENTS[platform] || OAUTH_CLIENTS.default
}

// Create OAuth2Client for specific platform
export function createOAuth2Client(redirectUri, platform = null) {
  const detectedPlatform = platform || detectPlatform(redirectUri)
  const config = getOAuthConfig(detectedPlatform)
  
  if (!config) {
    throw new Error(`No OAuth config found for platform: ${detectedPlatform}`)
  }
  
  return new OAuth2Client(config.clientId, config.clientSecret, redirectUri)
}

// Get all valid client IDs (for token verification)
export function getAllClientIds() {
  return Object.values(OAUTH_CLIENTS)
    .map(c => c.clientId)
    .filter(Boolean)
}

// Legacy export for backward compatibility
export const CLIENT_ID = process.env.GOOGLE_CLIENT_ID

// Export for debugging
export function getConfiguredPlatforms() {
  return Object.keys(OAUTH_CLIENTS)
}
