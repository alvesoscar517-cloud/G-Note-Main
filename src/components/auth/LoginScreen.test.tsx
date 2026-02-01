import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LoginScreen } from './LoginScreen'
import * as platformDetection from '@/lib/platform/detection'
import * as platformAuth from '@/lib/platform/auth'
import { BrowserRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from 'i18next'

// Initialize i18n for tests
i18n.init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: {
      translation: {
        'app.tagline': 'Your notes, everywhere',
        'auth.loginWithGoogle': 'Sign in with Google',
        'auth.agreeToTerms.prefix': 'By signing in, you agree to our',
        'auth.agreeToTerms.terms': 'Terms of Service',
        'auth.agreeToTerms.and': 'and',
        'auth.agreeToTerms.privacy': 'Privacy Policy',
        'offline.loginRequiresNetwork': 'Login requires network connection'
      }
    }
  }
})

// Mock the platform modules
vi.mock('@/lib/platform/detection')
vi.mock('@/lib/platform/auth')
vi.mock('@/lib/tokenRefresh')
vi.mock('@react-oauth/google', () => ({
  useGoogleLogin: vi.fn(() => vi.fn())
}))

// Mock stores with proper state management
let mockIsOnline = true
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    setUser: vi.fn(),
    setLoading: vi.fn(),
    setLoginTransition: vi.fn()
  })
}))

vi.mock('@/stores/appStore', () => ({
  useAppStore: () => ({
    isOnline: mockIsOnline
  })
}))

// Mock components
vi.mock('@/components/ui/VantaWaves', () => ({
  VantaWaves: () => <div data-testid="vanta-waves" />
}))

vi.mock('@/components/layout/DownloadAppPill', () => ({
  DownloadAppPill: () => <div data-testid="download-app-pill" />
}))

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <I18nextProvider i18n={i18n}>
      <BrowserRouter>{component}</BrowserRouter>
    </I18nextProvider>
  )
}

describe('LoginScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Platform Detection', () => {
    it('should detect web platform and show routing links', () => {
      vi.mocked(platformDetection.isChromeExtension).mockReturnValue(false)
      
      renderWithRouter(<LoginScreen />)
      
      // Should show clickable links for terms and privacy
      const termsLink = screen.getByRole('link', { name: /terms of service/i })
      const privacyLink = screen.getByRole('link', { name: /privacy policy/i })
      expect(termsLink).toHaveAttribute('href', '/terms')
      expect(privacyLink).toHaveAttribute('href', '/privacy')
    })

    it('should detect extension platform and hide web-only features', () => {
      vi.mocked(platformDetection.isChromeExtension).mockReturnValue(true)
      
      renderWithRouter(<LoginScreen />)
      
      // Should show non-clickable text for terms and privacy (no routing)
      expect(screen.queryByRole('link', { name: /terms of service/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /privacy policy/i })).not.toBeInTheDocument()
      
      // Should still show the text content
      expect(screen.getByText(/terms of service/i)).toBeInTheDocument()
      expect(screen.getByText(/privacy policy/i)).toBeInTheDocument()
    })
  })

  describe('Login Behavior', () => {
    it('should use platform adapter for login in extension', async () => {
      mockIsOnline = true
      vi.mocked(platformDetection.isChromeExtension).mockReturnValue(true)
      vi.mocked(platformAuth.platformLogin).mockResolvedValue({
        success: true,
        user: {
          id: 'test-id',
          email: 'test@example.com',
          name: 'Test User',
          avatar: 'https://example.com/avatar.jpg',
          accessToken: 'test-token',
          tokenExpiry: Date.now() + 3600000
        }
      })
      
      renderWithRouter(<LoginScreen />)
      
      const loginButton = screen.getByRole('button', { name: /sign in with google/i })
      fireEvent.click(loginButton)
      
      await waitFor(() => {
        expect(platformAuth.platformLogin).toHaveBeenCalled()
      })
    })

    it('should handle extension login errors gracefully', async () => {
      mockIsOnline = true
      vi.mocked(platformDetection.isChromeExtension).mockReturnValue(true)
      vi.mocked(platformAuth.platformLogin).mockResolvedValue({
        success: false,
        error: 'Authentication failed'
      })
      
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      renderWithRouter(<LoginScreen />)
      
      const loginButton = screen.getByRole('button', { name: /sign in with google/i })
      fireEvent.click(loginButton)
      
      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          'Login failed:',
          'Authentication failed'
        )
      })
      
      consoleError.mockRestore()
    })
  })

  describe('Offline Handling', () => {
    it('should disable login button when offline', () => {
      mockIsOnline = false
      vi.mocked(platformDetection.isChromeExtension).mockReturnValue(false)
      
      renderWithRouter(<LoginScreen />)
      
      const loginButton = screen.getByRole('button', { name: /sign in with google/i })
      expect(loginButton).toBeDisabled()
      
      // Reset for other tests
      mockIsOnline = true
    })
  })

  describe('UI Rendering', () => {
    it('should render all core UI elements', () => {
      vi.mocked(platformDetection.isChromeExtension).mockReturnValue(false)
      
      renderWithRouter(<LoginScreen />)
      
      // Check for logo
      expect(screen.getByAltText('G-Note')).toBeInTheDocument()
      
      // Check for title
      expect(screen.getByText('G-Note')).toBeInTheDocument()
      
      // Check for login button
      expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
      
      // Check for Vanta background
      expect(screen.getByTestId('vanta-waves')).toBeInTheDocument()
    })
  })
})
