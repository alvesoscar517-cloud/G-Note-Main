import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import './locales' // Initialize i18n
import { hideSplashScreen } from '@/lib/splashScreen'

// Check if we're in OAuth callback - keep splash visible
const hasAuthCode = window.location.search.includes('code=')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

// Only auto-hide splash if NOT in OAuth callback
// OAuth callback will hide splash after processing
if (!hasAuthCode) {
  requestAnimationFrame(() => {
    setTimeout(hideSplashScreen, 100)
  })
}
