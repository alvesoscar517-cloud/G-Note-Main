// Background service worker for Chrome Extension
// Handles OAuth authentication, token management, and context menu

// Context menu translations for different languages
// Get context menu title from locale
function getContextMenuTitle() {
  return chrome.i18n.getMessage('addToGNote') || 'Add to G-Note AI'
}

// Update side panel behavior based on launch type setting
async function updateSidePanelBehavior() {
  const result = await chrome.storage.local.get('launchType')
  const launchType = result.launchType || 'fullscreen'

  if (launchType === 'sidePanel') {
    // Enable side panel to open on action click
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  } else {
    // Disable side panel on action click (will use our custom handler)
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  console.log('G-Note extension installed')

  // Create context menu for adding selected text to notes
  chrome.contextMenus.create({
    id: 'add-to-gnote',
    title: getContextMenuTitle(),
    contexts: ['selection']
  })

  // Initialize side panel behavior
  await updateSidePanelBehavior()
})

// Listen for storage changes to update side panel behavior
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.launchType) {
    updateSidePanelBehavior()
  }
})

// Also update on startup
chrome.runtime.onStartup.addListener(async () => {
  await updateSidePanelBehavior()
})

// Handle context menu click

let currentLaunchType = 'fullscreen';

// Initialize launch type from storage
chrome.storage.local.get('launchType', (result) => {
  currentLaunchType = result.launchType || 'fullscreen';
});

// Update global variable when storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.launchType) {
    currentLaunchType = changes.launchType.newValue;
    updateSidePanelBehavior();
  }
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'add-to-gnote' && tab?.id) {

    // CRITICAL FIX: Open UI IMMEDIATELY to preserve user gesture
    // "sidePanel.open() may only be called in response to a user gesture"
    // We cannot await anything before this call.
    const shouldOpenSidePanel = currentLaunchType === 'sidePanel';

    if (shouldOpenSidePanel) {
      // Open side panel immediately
      // Use catch to prevent unhandled promise rejections if it fails
      chrome.sidePanel.open({ windowId: tab.windowId }).catch(console.error);
    }

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

        if (!shouldOpenSidePanel) {
          // Open in fullscreen tab if not side panel
          await openAppInTab()
        } else {
          // For side panel, we already opened it.
          // However, if it was already open, it needs to know about the new data.
          // We'll send a message to runtime. 
          // If the app just opened, it will check storage on mount.
          chrome.runtime.sendMessage({ type: 'WEB_CONTENT_ADDED' }).catch(() => {
            // Ignore error if no receiver (app not ready yet)
            // The app will check storage on startup anyway
          });
        }
      }
    } catch (error) {
      // Suppress "Receiving end does not exist" error as it just means no content script on that tab
      if (error && error.message && !error.message.includes('Receiving end does not exist')) {
        console.error('Error getting selected content:', error)
      }

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

        if (!shouldOpenSidePanel) {
          await openAppInTab()
        } else {
          // Notify side panel if open
          chrome.runtime.sendMessage({ type: 'WEB_CONTENT_ADDED' }).catch(() => { });
        }
      }
    }
  }
})

// Helper function to open app in a tab (used by context menu)
async function openAppInTab() {
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

// Open app in fullscreen tab when clicking extension icon (only when sidePanel is disabled)
// When sidePanel is enabled, Chrome handles opening it automatically via setPanelBehavior
chrome.action.onClicked.addListener(async () => {
  // This handler only runs when openPanelOnActionClick is false (fullscreen mode)
  await openInTab()
})

// Helper function to open app in a new tab
async function openInTab() {
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
}

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

  // Handle reset offscreen document request (after permission granted)
  if (request.type === 'reset-offscreen') {
    closeOffscreenDocument()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ error: error.message }))
    return true
  }
})

// Close offscreen document to force recreation with new permissions
async function closeOffscreenDocument() {
  try {
    const offscreenUrl = chrome.runtime.getURL('offscreen.html')

    if ('getContexts' in chrome.runtime) {
      const contexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [offscreenUrl]
      })

      if (contexts.length > 0) {
        await chrome.offscreen.closeDocument()
        console.log('[Background] Offscreen document closed for permission refresh')
      }
    }
  } catch (err) {
    console.error('[Background] Error closing offscreen document:', err)
  }
}

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
