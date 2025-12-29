// Background service worker for Chrome Extension
// Handles OAuth authentication, token management, and context menu

// Context menu translations for different languages
const contextMenuTitles = {
  en: 'Add to G-Note',
  vi: 'Thêm vào G-Note',
  ja: 'G-Noteに追加',
  ko: 'G-Note에 추가',
  'zh-CN': '添加到 G-Note',
  'zh-TW': '新增到 G-Note',
  de: 'Zu G-Note hinzufügen',
  fr: 'Ajouter à G-Note',
  es: 'Agregar a G-Note',
  'pt-BR': 'Adicionar ao G-Note',
  it: 'Aggiungi a G-Note',
  nl: 'Toevoegen aan G-Note',
  ar: 'إضافة إلى G-Note',
  hi: 'G-Note में जोड़ें',
  tr: "G-Note'a ekle",
  pl: 'Dodaj do G-Note',
  th: 'เพิ่มไปยัง G-Note',
  id: 'Tambahkan ke G-Note'
}

// Get browser language and return appropriate title
function getContextMenuTitle() {
  const lang = chrome.i18n.getUILanguage()
  // Try exact match first, then language code only
  return contextMenuTitles[lang] || contextMenuTitles[lang.split('-')[0]] || contextMenuTitles.en
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('G-Note extension installed')
  
  // Create context menu for adding selected text to notes
  chrome.contextMenus.create({
    id: 'add-to-gnote',
    title: getContextMenuTitle(),
    contexts: ['selection']
  })
})

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'add-to-gnote' && tab?.id) {
    try {
      // Send message to content script to get selected HTML
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_SELECTED_HTML' })
      
      if (response && (response.html || response.text)) {
        // Store the content for the popup/app to retrieve
        await chrome.storage.local.set({
          pendingWebContent: {
            html: response.html,
            text: response.text,
            sourceUrl: response.sourceUrl,
            sourceTitle: response.sourceTitle,
            timestamp: Date.now()
          }
        })
        
        // Open the extension in a new tab
        const url = chrome.runtime.getURL('index.html')
        const tabs = await chrome.tabs.query({ url })
        
        if (tabs.length > 0) {
          // Focus existing tab and notify it
          await chrome.tabs.update(tabs[0].id, { active: true })
          await chrome.windows.update(tabs[0].windowId, { focused: true })
          // Send message to the app to handle the pending content
          chrome.tabs.sendMessage(tabs[0].id, { type: 'WEB_CONTENT_ADDED' })
        } else {
          // Open new tab - the app will check for pending content on load
          await chrome.tabs.create({ url })
        }
      }
    } catch (error) {
      console.error('Error getting selected content:', error)
      // Fallback: use the selection text from info
      if (info.selectionText) {
        await chrome.storage.local.set({
          pendingWebContent: {
            html: `<p>${info.selectionText}</p>`,
            text: info.selectionText,
            sourceUrl: tab.url || '',
            sourceTitle: tab.title || '',
            timestamp: Date.now()
          }
        })
        
        const url = chrome.runtime.getURL('index.html')
        await chrome.tabs.create({ url })
      }
    }
  }
})

// Open app in new tab when clicking extension icon
chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL('index.html')
  
  // Check if tab already exists
  const tabs = await chrome.tabs.query({ url })
  
  if (tabs.length > 0) {
    // Focus existing tab
    await chrome.tabs.update(tabs[0].id, { active: true })
    await chrome.windows.update(tabs[0].windowId, { focused: true })
  } else {
    // Open new tab
    await chrome.tabs.create({ url })
  }
})

// Handle OAuth authentication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GOOGLE_AUTH') {
    handleGoogleAuth()
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }))
    return true // Keep message channel open for async response
  }
  
  if (request.type === 'GOOGLE_LOGOUT') {
    handleGoogleLogout()
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }))
    return true
  }
  
  if (request.type === 'REFRESH_TOKEN') {
    handleTokenRefresh()
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }))
    return true
  }
})

async function handleGoogleAuth() {
  try {
    // chrome.identity.getAuthToken returns { token: string } in MV3
    const authResult = await chrome.identity.getAuthToken({ interactive: true })
    const token = authResult?.token || authResult
    
    if (!token) {
      throw new Error('Failed to get auth token')
    }
    
    // Validate that user granted Drive scope
    const scopeValidation = await validateDriveScope(token)
    if (!scopeValidation.valid) {
      // Remove the token since it doesn't have required permissions
      await chrome.identity.removeCachedAuthToken({ token })
      return {
        success: false,
        error: 'DRIVE_PERMISSION_DENIED',
        message: 'Drive permission is required to sync notes. Please sign in again and grant Drive access.'
      }
    }
    
    // Get user info
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    })
    
    if (!userInfoResponse.ok) {
      // Token might be invalid, try to remove and get new one
      if (userInfoResponse.status === 401) {
        await chrome.identity.removeCachedAuthToken({ token })
        throw new Error('Token expired, please try again')
      }
      throw new Error('Failed to get user info')
    }
    
    const userInfo = await userInfoResponse.json()
    
    return {
      success: true,
      token,
      user: {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        avatar: userInfo.picture
      }
    }
  } catch (error) {
    console.error('Auth error:', error)
    return { success: false, error: error.message }
  }
}

// Validate that the access token has Drive scope
async function validateDriveScope(accessToken) {
  try {
    const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`)
    if (!response.ok) {
      return { valid: false, error: 'token_invalid' }
    }
    const tokenInfo = await response.json()
    const grantedScopes = tokenInfo.scope ? tokenInfo.scope.split(' ') : []
    
    const hasDriveScope = grantedScopes.some(scope => 
      scope === 'https://www.googleapis.com/auth/drive.file' || 
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

async function handleGoogleLogout() {
  try {
    const authResult = await chrome.identity.getAuthToken({ interactive: false })
    const token = authResult?.token || authResult
    if (token) {
      await chrome.identity.removeCachedAuthToken({ token })
      // Revoke token
      await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`)
    }
    // Clear user identity cache
    await chrome.identity.clearAllCachedAuthTokens()
    return { success: true }
  } catch (error) {
    console.error('Logout error:', error)
    return { success: false, error: error.message }
  }
}


// Silent token refresh - Chrome Identity API handles this automatically
// but we need to force refresh when token is expired
async function handleTokenRefresh() {
  try {
    // First, try to get cached token
    const cachedResult = await chrome.identity.getAuthToken({ interactive: false })
    const cachedToken = cachedResult?.token || cachedResult
    
    if (cachedToken) {
      // Remove cached token to force refresh
      await chrome.identity.removeCachedAuthToken({ token: cachedToken })
    }
    
    // Get new token (non-interactive first, then interactive if needed)
    let authResult = await chrome.identity.getAuthToken({ interactive: false })
    let token = authResult?.token || authResult
    
    if (!token) {
      // If non-interactive fails, try interactive
      authResult = await chrome.identity.getAuthToken({ interactive: true })
      token = authResult?.token || authResult
    }
    
    if (!token) {
      throw new Error('Failed to refresh token')
    }
    
    return {
      success: true,
      token
    }
  } catch (error) {
    console.error('Token refresh error:', error)
    return { success: false, error: error.message }
  }
}
