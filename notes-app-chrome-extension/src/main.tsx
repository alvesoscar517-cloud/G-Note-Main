import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/locales' // Initialize i18n FIRST (shared from web app)
import App from './App'
import './index.css'

// Hide native splash screen - called from App when ready
export const hideSplashScreen = () => {
  const splash = document.getElementById('splash-screen')
  if (splash) {
    splash.classList.add('hidden')
    // Remove from DOM after transition
    setTimeout(() => splash.remove(), 300)
  }
}

// Check if we're in OAuth callback - keep splash visible
const hasAuthCode = window.location.search.includes('code=')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>
  </StrictMode>
)

// Only auto-hide splash if NOT in OAuth callback
// OAuth callback will hide splash after processing
if (!hasAuthCode) {
  requestAnimationFrame(() => {
    setTimeout(hideSplashScreen, 100)
  })
}
