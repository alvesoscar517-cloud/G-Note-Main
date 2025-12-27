// Token refresh utilities
// Uses Cloud Run backend for proper refresh token flow

const API_URL = import.meta.env.VITE_API_URL || ''
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const SCOPES = 'email profile https://www.googleapis.com/auth/drive.file'

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
}

// Check if token is expired or about to expire (within 5 minutes)
export function isTokenExpired(tokenExpiry?: number): boolean {
  if (!tokenExpiry) return true
  const bufferTime = 5 * 60 * 1000 // 5 minutes
  return Date.now() > tokenExpiry - bufferTime
}

// Check if backend is available
export function hasAuthBackend(): boolean {
  return !!API_URL
}

// Get API URL
export function getApiUrl(): string {
  return API_URL
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
      const error = await response.json()
      throw new Error(error.error || 'Token exchange failed')
    }

    return response.json()
  } catch (error) {
    console.error('Token exchange error:', error)
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

// Fallback: Attempt silent token refresh using hidden iframe (implicit flow)
// Used when no backend is available
export function silentRefreshImplicit(): Promise<TokenResponse | null> {
  return new Promise((resolve) => {
    if (!GOOGLE_CLIENT_ID) {
      resolve(null)
      return
    }

    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID)
    authUrl.searchParams.set('redirect_uri', window.location.origin)
    authUrl.searchParams.set('response_type', 'token')
    authUrl.searchParams.set('scope', SCOPES)
    authUrl.searchParams.set('prompt', 'none') // Silent - no UI
    
    const state = Math.random().toString(36).substring(7)
    authUrl.searchParams.set('state', state)
    
    const timeout = setTimeout(() => {
      cleanup()
      resolve(null)
    }, 10000)

    const cleanup = () => {
      clearTimeout(timeout)
      window.removeEventListener('message', handleMessage)
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe)
      }
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      
      try {
        const data = event.data
        if (data.type === 'oauth_response' && data.state === state) {
          cleanup()
          if (data.access_token) {
            resolve({
              access_token: data.access_token,
              expires_in: parseInt(data.expires_in) || 3600
            })
          } else {
            resolve(null)
          }
        }
      } catch {
        // Ignore parse errors
      }
    }

    window.addEventListener('message', handleMessage)
    
    iframe.src = authUrl.toString()
    document.body.appendChild(iframe)
  })
}

// Parse OAuth response from URL hash (for implicit flow fallback)
export function parseOAuthResponse(): TokenResponse | null {
  const hash = window.location.hash.substring(1)
  if (!hash) return null
  
  const params = new URLSearchParams(hash)
  const accessToken = params.get('access_token')
  const expiresIn = params.get('expires_in')
  
  if (accessToken) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    
    return {
      access_token: accessToken,
      expires_in: parseInt(expiresIn || '3600')
    }
  }
  
  return null
}
