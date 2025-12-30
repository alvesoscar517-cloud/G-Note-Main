import { useState, useEffect, useMemo } from 'react'
import { useDebounce } from 'use-debounce'
import { useTranslation } from 'react-i18next'
import { Search, Plus, Moon, Sun, LogOut, RefreshCw, Settings, X, Coins, ChevronRight, ArrowLeft, Maximize2, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/stores/authStore'
import { useNotesStore } from '@/stores/notesStore'
import { useThemeStore } from '@/stores/themeStore'
import { useCreditsStore } from '@/stores/creditsStore'
import { useUIStore, type ModalSize } from '@/stores/uiStore'
import { LanguageSelector, LanguageButton } from '@/components/ui/LanguageSelector'
import { OfflineIndicator } from '@/components/ui/OfflineIndicator'
import { TrashView } from '@/components/notes/TrashView'
import { DriveSearchResults } from '@/components/search/DriveSearchResults'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { LogoutConfirmDialog } from '@/components/auth/LogoutConfirmDialog'
import { useModalStatusBar } from '@/hooks/useModalStatusBar'
import { cn } from '@/lib/utils'

// Modal size options
const MODAL_SIZE_OPTIONS: { value: ModalSize; labelKey: string }[] = [
  { value: 'default', labelKey: 'settings.modalSizeDefault' },
  { value: 'large', labelKey: 'settings.modalSizeLarge' },
  { value: 'xlarge', labelKey: 'settings.modalSizeXLarge' }
]

// Hardcoded packages - no API loading needed
const CREDIT_PACKAGES = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 500,
    priceDisplay: '$2.99',
    icon: '/crown-basic.svg',
    iconSize: 'w-5 h-5'
  },
  {
    id: 'popular',
    name: 'Popular',
    credits: 1500,
    priceDisplay: '$7.99',
    badge: 'Best Value',
    icon: '/crown-pro.svg',
    iconSize: 'w-6 h-6'
  },
  {
    id: 'pro',
    name: 'Pro',
    credits: 3500,
    priceDisplay: '$14.99',
    icon: '/crown-ultimate.svg',
    iconSize: 'w-7 h-7'
  }
]

export function Header() {
  const { t } = useTranslation()
  const { user, logout } = useAuthStore()
  
  // Use selectors to prevent unnecessary re-renders
  const setSearchQuery = useNotesStore(state => state.setSearchQuery)
  const addNote = useNotesStore(state => state.addNote)
  const syncWithDrive = useNotesStore(state => state.syncWithDrive)
  const loadSharedNotes = useNotesStore(state => state.loadSharedNotes)
  const isSyncing = useNotesStore(state => state.isSyncing)
  const notes = useNotesStore(state => state.notes)
  
  const { theme, toggleTheme } = useThemeStore()
  const { credits, fetchCredits, openCheckout } = useCreditsStore()
  const { modalSize, setModalSize } = useUIStore()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [packagesOpen, setPackagesOpen] = useState(false)
  const [languageOpen, setLanguageOpen] = useState(false)
  const [modalSizeOpen, setModalSizeOpen] = useState(false)
  const [trashOpen, setTrashOpen] = useState(false)
  const [driveSearchEnabled, setDriveSearchEnabled] = useState(false)
  const [showDriveResults, setShowDriveResults] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  
  // Update status bar color when any modal is open
  const anyModalOpen = settingsOpen || packagesOpen || languageOpen || modalSizeOpen || trashOpen
  useModalStatusBar(anyModalOpen)
  
  // Local search input state + debounce
  const [localSearch, setLocalSearch] = useState('')
  const [debouncedSearch] = useDebounce(localSearch, 200)
  
  // Memoize trash count to prevent unnecessary re-renders
  const trashCount = useMemo(() => {
    return notes.filter(n => n.isDeleted).length
  }, [notes])
  
  // Update store when debounced value changes
  useEffect(() => {
    // Only update local search when Drive search is disabled
    if (!driveSearchEnabled) {
      setSearchQuery(debouncedSearch)
    } else {
      // Clear local search when Drive search is enabled
      setSearchQuery('')
    }
    // Show Drive results when searching with Drive enabled
    if (driveSearchEnabled && debouncedSearch.trim()) {
      setShowDriveResults(true)
    } else {
      setShowDriveResults(false)
    }
  }, [debouncedSearch, setSearchQuery, driveSearchEnabled])

  // Fetch credits when user logs in
  useEffect(() => {
    if (user?.id) {
      fetchCredits(user.id)
    }
  }, [user?.id, fetchCredits])

  // Listen for open credits modal event
  useEffect(() => {
    const handleOpenCredits = () => {
      setPackagesOpen(true)
      // Fetch fresh credits when modal opens
      if (user?.id) {
        fetchCredits(user.id)
      }
    }
    window.addEventListener('open-credits-modal', handleOpenCredits)
    return () => window.removeEventListener('open-credits-modal', handleOpenCredits)
  }, [user?.id, fetchCredits])

  const handleAddNote = () => {
    addNote()
  }

  const handleSync = async () => {
    if (user?.accessToken && !isSyncing) {
      await syncWithDrive(user.accessToken)
      // Also load shared notes after sync
      await loadSharedNotes(user.accessToken)
    }
  }

  const handleLogout = async () => {
    // Close settings modal and show confirmation dialog
    setSettingsOpen(false)
    setShowLogoutConfirm(true)
  }

  const handleConfirmLogout = async () => {
    setShowLogoutConfirm(false)
    setIsLoggingOut(true)
    setSettingsOpen(false)
    try {
      await logout()
    } finally {
      setIsLoggingOut(false)
    }
  }

  const handleToggleTheme = () => {
    toggleTheme()
  }

  const handleBuyPackage = (packageId: string) => {
    if (user?.id) {
      openCheckout(packageId, user.id)
    }
  }

  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  // Close modal on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSettingsOpen(false)
        setPackagesOpen(false)
        setLanguageOpen(false)
        setModalSizeOpen(false)
        setTrashOpen(false)
      }
    }
    if (settingsOpen || packagesOpen || languageOpen || modalSizeOpen || trashOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [settingsOpen, packagesOpen, languageOpen, modalSizeOpen, trashOpen])

  return (
    <>
      {/* Logout Loading Overlay */}
      <LoadingOverlay isVisible={isLoggingOut} text={t('settings.loggingOut')} />

      {/* Logout Confirmation Dialog */}
      <LogoutConfirmDialog
        open={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleConfirmLogout}
      />

      <header className="px-4 safe-top safe-x relative z-40">
        <div className="max-w-6xl mx-auto bg-white/80 dark:bg-neutral-900/80 backdrop-blur-lg border border-neutral-200 dark:border-neutral-800 rounded-[16px] px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Logo & Search */}
            <div className="flex items-center gap-3 flex-1">
              <img 
                src={isDark ? "/g-note-dark.svg" : "/g-note.svg"} 
                alt="G-Note" 
                className="w-8 h-8 sm:w-9 sm:h-9 flex-shrink-0" 
              />
              
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <Input
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  placeholder={driveSearchEnabled ? t('driveSearch.toggle') : t('header.search')}
                  className="pl-9 pr-10"
                />
                {/* Drive Search Toggle */}
                <button
                  onClick={() => {
                    setDriveSearchEnabled(!driveSearchEnabled)
                    // Clear search when toggling
                    if (!driveSearchEnabled) {
                      setSearchQuery('')
                    }
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors"
                  title={t('driveSearch.toggleHint')}
                >
                  {driveSearchEnabled ? (
                    <img src="/drive-color-svgrepo-com.svg" alt="Drive" className="w-4 h-4" />
                  ) : (
                    <img 
                      src="/drive-google-svgrepo-com.svg" 
                      alt="Drive" 
                      className="w-4 h-4 opacity-50"
                      style={{ filter: isDark ? 'invert(1)' : 'none' }}
                    />
                  )}
                </button>
                
                {/* Drive Search Results Dropdown */}
                {showDriveResults && debouncedSearch.trim() && (
                  <div className="absolute top-full left-0 right-0 mt-2 z-[100] mx-0 sm:mx-0">
                    <DriveSearchResults 
                      query={debouncedSearch}
                      onClose={() => setShowDriveResults(false)}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              {/* Offline Indicator */}
              <OfflineIndicator className="mr-1" />
              
              <button 
                onClick={handleAddNote} 
                className="p-2 rounded-full text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors touch-manipulation"
              >
                <Plus className="w-5 h-5" />
              </button>

              <button
                onClick={() => setSettingsOpen(true)}
                className="p-2 rounded-full text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors touch-manipulation"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 safe-x">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={() => setSettingsOpen(false)}
          />
          
          {/* Modal - scrollable in landscape */}
          <div className="relative w-full max-w-xs sm:max-w-sm max-h-[90vh] overflow-y-auto bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95 border border-neutral-200 dark:border-neutral-700 modal-safe-area">
            {/* Close button */}
            <button
              onClick={() => setSettingsOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-full text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {/* User profile section - centered vertical layout */}
            {user && (
              <div className="pt-8 pb-6 px-4 text-center">
                <div className="relative w-20 h-20 mx-auto">
                  <div className="absolute inset-0 rounded-full bg-neutral-200 dark:bg-neutral-700 animate-pulse ring-4 ring-neutral-100 dark:ring-neutral-800" />
                  <img
                    src={user.avatar}
                    alt={user.name}
                    referrerPolicy="no-referrer"
                    className="relative w-20 h-20 rounded-full object-cover ring-4 ring-neutral-100 dark:ring-neutral-800"
                    onLoad={(e) => {
                      const target = e.currentTarget;
                      const placeholder = target.previousElementSibling as HTMLElement;
                      if (placeholder) placeholder.style.display = 'none';
                    }}
                  />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-neutral-900 dark:text-white truncate">
                  {user.name}
                </h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate">
                  {user.email}
                </p>
              </div>
            )}
            
            {/* Menu items */}
            <div className="p-2 pb-6 space-y-0.5">
              {/* AI Credits */}
              <MenuItem
                icon={<Coins className="w-4 h-4" />}
                label={t('settings.aiCredits')}
                onClick={() => {
                  setSettingsOpen(false)
                  setPackagesOpen(true)
                  // Fetch fresh credits when opening modal
                  if (user?.id) {
                    fetchCredits(user.id)
                  }
                }}
                showArrow
                badge={credits.toLocaleString()}
              />
              
              <MenuItem
                icon={<RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />}
                label={t('settings.sync')}
                description={t('settings.syncDescription')}
                onClick={handleSync}
                disabled={isSyncing}
              />
              <MenuItem
                icon={isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                label={isDark ? t('settings.lightMode') : t('settings.darkMode')}
                description={t('settings.themeDescription')}
                onClick={handleToggleTheme}
              />
              
              {/* Language selector */}
              <LanguageButton onClick={() => {
                setSettingsOpen(false)
                setLanguageOpen(true)
              }} />
              
              {/* Trash */}
              <MenuItem
                icon={<Trash2 className="w-4 h-4" />}
                label={t('trash.title')}
                onClick={() => {
                  setSettingsOpen(false)
                  setTrashOpen(true)
                }}
                showArrow
                badge={trashCount > 0 ? trashCount.toString() : undefined}
              />
              
              {/* Modal size - only show on desktop */}
              <div className="hidden md:block">
                <MenuItem
                  icon={<Maximize2 className="w-4 h-4" />}
                  label={t('settings.modalSize')}
                  description={t('settings.modalSizeDescription')}
                  onClick={() => {
                    setSettingsOpen(false)
                    setModalSizeOpen(true)
                  }}
                  showArrow
                />
              </div>
              
              {user && (
                <MenuItem
                  icon={<LogOut className="w-4 h-4" />}
                  label={t('settings.logout')}
                  description={t('settings.logoutDescription')}
                  onClick={handleLogout}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Credits Packages Modal */}
      {packagesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 safe-x">
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={() => setPackagesOpen(false)}
          />
          
          <div className="relative w-full max-w-[320px] sm:max-w-sm max-h-[85vh] overflow-y-auto bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95 border border-neutral-200 dark:border-neutral-700 modal-safe-area">
            <button
              onClick={() => setPackagesOpen(false)}
              className="absolute top-2 right-2 p-1.5 rounded-full text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors z-10"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            
            {/* Header - compact */}
            <div className="pt-4 pb-2 px-4 text-center">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 mb-2">
                <Coins className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white">
                {t('credits.title')}
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {t('credits.balance')}: <span className="font-semibold">{credits.toLocaleString()}</span> {t('credits.aiCredits')}
              </p>
            </div>
            
            {/* Packages - compact spacing */}
            <div className="px-3 pb-3 space-y-2">
              {CREDIT_PACKAGES.map((pkg) => (
                <div
                  key={pkg.id}
                  onClick={() => handleBuyPackage(pkg.id)}
                  className={cn(
                    "relative p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer hover:shadow-md active:scale-[0.98]",
                    pkg.badge 
                      ? "border-neutral-400 dark:border-neutral-500 bg-neutral-50 dark:bg-neutral-800" 
                      : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-500"
                  )}
                >
                  {pkg.badge && (
                    <span className="absolute -top-2 left-3 px-1.5 py-0.5 text-[10px] font-semibold bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full">
                      {t('credits.bestValue')}
                    </span>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center flex-shrink-0">
                        <img src={pkg.icon} alt="" className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-xs sm:text-sm text-neutral-900 dark:text-white">
                          {pkg.name}
                        </h3>
                        <p className="text-[10px] sm:text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-0.5">
                          <Coins className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
                          {pkg.credits.toLocaleString()} {t('credits.aiCredits')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white">
                        {pkg.priceDisplay}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Footer with Lemon Squeezy logo */}
            <div className="px-4 pb-3 pt-1 flex items-center justify-center">
              <img 
                src="/lemonsqueezy-black.svg" 
                alt="Lemon Squeezy" 
                className="h-3 dark:hidden"
              />
              <img 
                src="/lemonsqueezy-white.svg" 
                alt="Lemon Squeezy" 
                className="h-3 hidden dark:block"
              />
            </div>
          </div>
        </div>
      )}

      {/* Language Modal */}
      {languageOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 safe-x">
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={() => setLanguageOpen(false)}
          />
          
          <div className="relative w-full max-w-xs sm:max-w-sm max-h-[90vh] overflow-y-auto bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95 border border-neutral-200 dark:border-neutral-700 modal-safe-area">
            {/* Header */}
            <div className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-3 sticky top-0 bg-white dark:bg-neutral-900 z-10">
              <button
                onClick={() => {
                  setLanguageOpen(false)
                  setSettingsOpen(true)
                }}
                className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h3 className="text-sm sm:text-base font-semibold text-neutral-900 dark:text-white">
                {t('common.language')}
              </h3>
            </div>
            
            <LanguageSelector onClose={() => setLanguageOpen(false)} />
          </div>
        </div>
      )}

      {/* Modal Size Selector */}
      {modalSizeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 safe-x">
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={() => setModalSizeOpen(false)}
          />
          
          <div className="relative w-full max-w-xs sm:max-w-sm max-h-[90vh] overflow-y-auto bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95 border border-neutral-200 dark:border-neutral-700 modal-safe-area">
            {/* Header */}
            <div className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-3">
              <button
                onClick={() => {
                  setModalSizeOpen(false)
                  setSettingsOpen(true)
                }}
                className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h3 className="text-sm sm:text-base font-semibold text-neutral-900 dark:text-white">
                {t('settings.modalSize')}
              </h3>
            </div>
            
            {/* Size options */}
            <div className="p-2 sm:p-3 space-y-1">
              {MODAL_SIZE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setModalSize(option.value)
                    setModalSizeOpen(false)
                    setSettingsOpen(true)
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-colors",
                    modalSize === option.value
                      ? "bg-neutral-100 dark:bg-neutral-800"
                      : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                  )}
                >
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {t(option.labelKey)}
                  </span>
                  {modalSize === option.value && (
                    <div className="w-2 h-2 rounded-full bg-neutral-900 dark:bg-white" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Trash View */}
      <TrashView open={trashOpen} onClose={() => setTrashOpen(false)} />
    </>
  )
}

function MenuItem({ 
  icon, 
  label,
  description,
  onClick, 
  disabled,
  showArrow,
  badge
}: { 
  icon: React.ReactNode
  label: string
  description?: string
  onClick: () => void
  disabled?: boolean
  showArrow?: boolean
  badge?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-2.5 rounded-xl text-left",
        "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800",
        "transition-colors touch-manipulation",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <div className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="text-[11px] mt-0.5 text-neutral-500 dark:text-neutral-500">
            {description}
          </p>
        )}
      </div>
      {badge && (
        <span className="px-2 py-0.5 text-xs font-medium bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-full">
          {badge}
        </span>
      )}
      {showArrow && (
        <ChevronRight className="w-4 h-4 text-neutral-400" />
      )}
    </button>
  )
}
