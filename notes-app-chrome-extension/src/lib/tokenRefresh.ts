// Token refresh utilities
// Uses Cloud Run backend for proper refresh token flow

const API_URL = import.meta.env.VITE_API_URL || ''
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const SCOPES = 'email profile https://www.googleapis.com/auth/drive.file'
const REQUIRED_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

interface TokenResponse {
  access_token: string
  expires_in: number
}

interface AuthResponse {
  user: {
    id: string
    email: string
    name: string
    avatar: string
  }
  accessToken: string
  expiresIn: number
  grantedScopes?: string[]
  isNewUser?: boolean
}

interface AuthError {
  error: string
  message: string
  grantedScopes?: string[]
}

// Check if backend is available
export function hasAuthBackend(): boolean {
  return !!API_URL
}

// Get API URL
export function getApiUrl(): string {
  return API_URL
}

// Validate that the access token has Drive scope
export async function validateDriveScope(accessToken: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`)
    if (!response.ok) {
      return { valid: false, error: 'token_invalid' }
    }
    const tokenInfo = await response.json()
    const grantedScopes: string[] = tokenInfo.scope ? tokenInfo.scope.split(' ') : []
    
    const hasDriveScope = grantedScopes.some(scope => 
      scope === REQUIRED_DRIVE_SCOPE || 
      scope === 'https://www.googleapis.com/auth/drive'
    )
    
    return { 
      valid: hasDriveScope, 
      error: hasDriveScope ? undefined : 'drive_scope_missing'
    }
  } catch {
    return { valid: false, error: 'validation_failed' }
  }
}

// Exchange authorization code for tokens via backend
export async function exchangeCodeForTokens(code: string): Promise<AuthResponse | null> {
  if (!API_URL) return null

  try {
    const response = await fetch(`${API_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        redirectUri: window.location.origin
      })
    })

    if (!response.ok) {
      const error: AuthError = await response.json()
      // Check for permission error
      if (response.status === 403 && error.error === 'drive_scope_missing') {
        throw new Error('DRIVE_PERMISSION_DENIED')
      }
      throw new Error(error.error || 'Token exchange failed')
    }

    return response.json()
  } catch (error) {
    console.error('Token exchange error:', error)
    // Re-throw permission errors
    if (error instanceof Error && error.message === 'DRIVE_PERMISSION_DENIED') {
      throw error
    }
    return null
  }
}

// Silent refresh using backend (no popup needed)
export async function silentRefreshWithBackend(userId: string): Promise<TokenResponse | null> {
  if (!API_URL) return null

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return {
      access_token: data.accessToken,
      expires_in: data.expiresIn
    }
  } catch (error) {
    console.error('Silent refresh error:', error)
    return null
  }
}

// Logout - remove refresh token from backend
export async function logoutFromBackend(userId: string): Promise<void> {
  if (!API_URL) return

  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    })
  } catch (error) {
    console.error('Logout error:', error)
  }
}

// Generate Google OAuth URL for authorization code flow
export function getGoogleAuthUrl(): string {
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', window.location.origin)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', SCOPES)
  authUrl.searchParams.set('access_type', 'offline') // Request refresh token
  authUrl.searchParams.set('prompt', 'consent') // Force consent to get refresh token
  
  return authUrl.toString()
}

// Check if there's an auth code in URL (for showing loading state immediately)
export function hasAuthCodeInUrl(): boolean {
  const params = new URLSearchParams(window.location.search)
  return !!params.get('code')
}

// Parse authorization code from URL (for redirect callback)
export function parseAuthCode(): string | null {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  
  if (code) {
    // Clear code from URL
    window.history.replaceState(null, '', window.location.pathname)
    return code
  }
  
  return null
}
