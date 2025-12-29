import { Router } from 'express'
import { createOAuth2Client, getAllClientIds, detectPlatform } from '../config/google.js'
import { db, collections } from '../config/firebase.js'

const router = Router()

// Required scope for Drive sync
const REQUIRED_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

// Validate that the user granted the required Drive scope
async function validateDriveScope(accessToken) {
  try {
    const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`)
    if (!response.ok) {
      return { valid: false, error: 'token_invalid' }
    }
    const tokenInfo = await response.json()
    const grantedScopes = tokenInfo.scope ? tokenInfo.scope.split(' ') : []
    
    const hasDriveScope = grantedScopes.some(scope => 
      scope === REQUIRED_DRIVE_SCOPE || 
      scope === 'https://www.googleapis.com/auth/drive'
    )
    
    return { 
      valid: hasDriveScope, 
      grantedScopes,
      error: hasDriveScope ? null : 'drive_scope_missing'
    }
  } catch (error) {
    console.error('Scope validation error:', error)
    return { valid: false, error: 'validation_failed' }
  }
}

// POST /auth/google - Exchange authorization code for tokens
router.post('/google', async (req, res) => {
  try {
    const { code, redirectUri } = req.body

    if (!code || !redirectUri) {
      return res.status(400).json({ error: 'Missing code or redirectUri' })
    }

    // Detect platform and create appropriate OAuth client
    const platform = detectPlatform(redirectUri, req.headers.origin)
    const oauth2Client = createOAuth2Client(redirectUri, platform)
    
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    // Validate that user granted Drive scope
    const scopeValidation = await validateDriveScope(tokens.access_token)
    if (!scopeValidation.valid) {
      return res.status(403).json({ 
        error: scopeValidation.error,
        message: 'Drive permission is required to sync notes. Please sign in again and grant Drive access.',
        grantedScopes: scopeValidation.grantedScopes
      })
    }

    // Verify ID token - accept any of our configured client IDs
    const validClientIds = getAllClientIds()
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: validClientIds
    })
    const payload = ticket.getPayload()

    const user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      avatar: payload.picture
    }

    // Store refresh token in Firestore
    if (tokens.refresh_token) {
      await db.collection(collections.refreshTokens).doc(user.id).set({
        refreshToken: tokens.refresh_token,
        updatedAt: Date.now()
      })
    }

    // Store/update user in Firestore
    await db.collection(collections.users).doc(user.id).set({
      ...user,
      lastLogin: Date.now()
    }, { merge: true })

    res.json({
      user,
      accessToken: tokens.access_token,
      expiresIn: tokens.expiry_date 
        ? Math.floor((tokens.expiry_date - Date.now()) / 1000)
        : 3600,
      grantedScopes: scopeValidation.grantedScopes
    })
  } catch (error) {
    console.error('Auth error:', error)
    res.status(500).json({ error: error.message })
  }
})

// POST /auth/refresh - Refresh access token
router.post('/refresh', async (req, res) => {
  try {
    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' })
    }

    // Get refresh token from Firestore
    const doc = await db.collection(collections.refreshTokens).doc(userId).get()
    
    if (!doc.exists) {
      return res.status(401).json({ error: 'No refresh token found' })
    }

    const { refreshToken } = doc.data()
    const oauth2Client = createOAuth2Client('')
    oauth2Client.setCredentials({ refresh_token: refreshToken })

    // Refresh the access token
    const { credentials } = await oauth2Client.refreshAccessToken()

    // Update refresh token if new one provided
    if (credentials.refresh_token) {
      await db.collection(collections.refreshTokens).doc(userId).update({
        refreshToken: credentials.refresh_token,
        updatedAt: Date.now()
      })
    }

    res.json({
      accessToken: credentials.access_token,
      expiresIn: credentials.expiry_date
        ? Math.floor((credentials.expiry_date - Date.now()) / 1000)
        : 3600
    })
  } catch (error) {
    console.error('Refresh error:', error)
    res.status(500).json({ error: error.message })
  }
})

// POST /auth/logout - Remove refresh token
router.post('/logout', async (req, res) => {
  try {
    const { userId } = req.body

    if (userId) {
      await db.collection(collections.refreshTokens).doc(userId).delete()
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
