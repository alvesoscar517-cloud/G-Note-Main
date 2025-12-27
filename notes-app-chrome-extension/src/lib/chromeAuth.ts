// Chrome Extension Authentication Helper
// Uses Chrome Identity API for OAuth

export interface ChromeAuthResult {
  success: boolean
  token?: string
  user?: {
    id: string
    email: string
    name: string
    avatar: string
  }
  error?: string
}

export async function chromeGoogleLogin(): Promise<ChromeAuthResult> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'GOOGLE_AUTH' },
      (response: ChromeAuthResult) => {
        if (chrome.runtime.lastError) {
          resolve({
            success: false,
            error: chrome.runtime.lastError.message
          })
        } else {
          resolve(response)
        }
      }
    )
  })
}

export async function chromeGoogleLogout(): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'GOOGLE_LOGOUT' },
      (response: { success: boolean; error?: string }) => {
        if (chrome.runtime.lastError) {
          resolve({
            success: false,
            error: chrome.runtime.lastError.message
          })
        } else {
          resolve(response)
        }
      }
    )
  })
}

// Check if running in Chrome Extension context
export function isChromeExtension(): boolean {
  return typeof chrome !== 'undefined' && 
         typeof chrome.runtime !== 'undefined' && 
         typeof chrome.runtime.id !== 'undefined'
}

// Refresh token silently
export async function chromeRefreshToken(): Promise<{ success: boolean; token?: string; error?: string }> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'REFRESH_TOKEN' },
      (response: { success: boolean; token?: string; error?: string }) => {
        if (chrome.runtime.lastError) {
          resolve({
            success: false,
            error: chrome.runtime.lastError.message
          })
        } else {
          resolve(response)
        }
      }
    )
  })
}
