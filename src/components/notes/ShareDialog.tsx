import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Check, Users, Link2, Mail, Loader2, Globe, WifiOff, AlertCircle } from 'lucide-react'
import { Dialog, DialogHeader, DialogContent, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { generateRoomId, sanitizeRoomId, isValidRoomId, checkRoomExists } from '@/lib/collaboration'
import { driveShare } from '@/lib/driveShare'
import { useAuthStore } from '@/stores/authStore'
import { useNotesStore } from '@/stores/notesStore'
import { useNetworkStore } from '@/stores/networkStore'
import { getValidAccessToken, TokenExpiredError } from '@/lib/tokenManager'

interface ShareDialogProps {
  open: boolean
  onClose: () => void
  noteId: string
  existingRoomId?: string | null
  onCreateRoom: (roomId: string) => void
  onJoinRoom: (roomId: string) => void
  onStopSharing?: () => void
}

type TabType = 'public' | 'realtime' | 'email' | 'join'

export function ShareDialog({ 
  open, 
  onClose, 
  existingRoomId,
  onCreateRoom,
  onJoinRoom,
  onStopSharing
}: ShareDialogProps) {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const { getSelectedNote, updateNote } = useNotesStore()
  const isOnline = useNetworkStore(state => state.isOnline)
  const note = getSelectedNote()
  
  const [copied, setCopied] = useState(false)
  const [joinRoomId, setJoinRoomId] = useState('')
  const [shareEmail, setShareEmail] = useState('')
  const [mode, setMode] = useState<TabType>('public')
  const [isSharing, setIsSharing] = useState(false)
  const [isCheckingRoom, setIsCheckingRoom] = useState(false)
  const [shareSuccess, setShareSuccess] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [publicLink, setPublicLink] = useState<string | null>(null)
  
  // Check if currently in a realtime session
  const isInRealtimeSession = !!existingRoomId

  // Check if note already has a public link when dialog opens
  useEffect(() => {
    if (open && note?.publicFileId) {
      const link = `${window.location.origin}?view=${note.publicFileId}`
      setPublicLink(link)
    }
  }, [open, note?.publicFileId])

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleStartRealtime = () => {
    // Generate new roomId when starting - don't close dialog, show the code
    const newRoomId = generateRoomId()
    onCreateRoom(newRoomId)
    // Don't close - user needs to see and share the code
  }

  const handleJoinRoom = async () => {
    const sanitized = sanitizeRoomId(joinRoomId)
    if (!sanitized || !isValidRoomId(sanitized)) return
    
    setIsCheckingRoom(true)
    setJoinError(null)
    
    try {
      // Check if room exists before joining
      const roomInfo = await checkRoomExists(sanitized)
      
      if (!roomInfo.exists) {
        setJoinError(t('share.roomNotFound'))
        return
      }
      
      onJoinRoom(sanitized)
      onClose()
    } catch (error) {
      // If check fails, try to join anyway
      onJoinRoom(sanitized)
      onClose()
    } finally {
      setIsCheckingRoom(false)
    }
  }

  const handleSharePublic = async () => {
    if (!note) return
    
    setIsSharing(true)
    setShareError(null)
    
    try {
      // Get valid token (auto-refresh if expired)
      const accessToken = await getValidAccessToken()
      if (!accessToken) {
        setShareError(t('share.sessionExpired'))
        return
      }
      
      driveShare.setAccessToken(accessToken)
      // Pass existing publicFileId to update instead of creating new
      const fileId = await driveShare.sharePublic(note, note.publicFileId)
      const link = `${window.location.origin}?view=${fileId}`
      setPublicLink(link)
      setShareSuccess(true)
      
      // Save publicFileId to note if it's new
      if (!note.publicFileId) {
        updateNote(note.id, { publicFileId: fileId })
      }
    } catch (error) {
      console.error('Share failed:', error)
      if (error instanceof TokenExpiredError) {
        setShareError(t('share.sessionExpired'))
      } else {
        setShareError(error instanceof Error ? error.message : t('share.error'))
      }
    } finally {
      setIsSharing(false)
    }
  }

  const handleShareViaEmail = async () => {
    if (!shareEmail.trim() || !note) return
    
    setIsSharing(true)
    setShareError(null)
    setShareSuccess(false)
    
    try {
      // Get valid token (auto-refresh if expired)
      const accessToken = await getValidAccessToken()
      if (!accessToken) {
        setShareError(t('share.sessionExpired'))
        return
      }
      
      driveShare.setAccessToken(accessToken)
      const fileId = await driveShare.createShareableNote(note)
      await driveShare.shareWithEmail(fileId, shareEmail.trim(), 'writer')
      
      setShareSuccess(true)
      setShareEmail('')
      setTimeout(() => {
        onClose()
        setShareSuccess(false)
      }, 2000)
    } catch (error) {
      console.error('Share failed:', error)
      if (error instanceof TokenExpiredError) {
        setShareError(t('share.sessionExpired'))
      } else {
        setShareError(error instanceof Error ? error.message : t('share.error'))
      }
    } finally {
      setIsSharing(false)
    }
  }

  const resetState = () => {
    // Don't reset publicLink if note already has publicFileId
    if (!note?.publicFileId) {
      setPublicLink(null)
    }
    setShareSuccess(false)
    setShareError(null)
    setJoinError(null)
  }

  const handleClose = () => {
    onClose()
    // Reset state but keep publicLink if note has publicFileId
    setShareSuccess(false)
    setShareError(null)
    setJoinError(null)
    setShareEmail('')
    setJoinRoomId('')
    if (!note?.publicFileId) {
      setPublicLink(null)
    }
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogHeader>{t('share.title')}</DialogHeader>
      
      <DialogContent>
        <div className="min-h-[140px]">
          {/* Offline Warning */}
          {!isOnline && (
            <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <WifiOff className="w-4 h-4" />
                <span className="text-sm font-medium">{t('offline.networkRequired')}</span>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                {t('offline.featureRequiresNetwork', { feature: t('share.title') })}
              </p>
            </div>
          )}
          
          {/* Tabs */}
          <div className="flex gap-1 mb-4 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-[10px]">
            <TabButton active={mode === 'public'} onClick={() => { setMode('public'); resetState(); }}>
              <Globe className="w-3.5 h-3.5" />
              {t('share.public')}
            </TabButton>
            <TabButton active={mode === 'realtime'} onClick={() => { setMode('realtime'); resetState(); }}>
              <Users className="w-3.5 h-3.5" />
              {t('share.realtime')}
            </TabButton>
            <TabButton active={mode === 'email'} onClick={() => { setMode('email'); resetState(); }}>
              <Mail className="w-3.5 h-3.5" />
              {t('share.email')}
            </TabButton>
            <TabButton active={mode === 'join'} onClick={() => { setMode('join'); resetState(); }}>
              <Link2 className="w-3.5 h-3.5" />
              {t('share.join')}
            </TabButton>
          </div>

          {mode === 'public' && (
            <div className="space-y-3">
              {!publicLink ? (
                <p className="text-sm">
                  {t('share.publicDescription')}
                </p>
              ) : (
                <>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    {t('share.publicSuccess')}
                  </p>
                  <div className="flex gap-2">
                    <Input 
                      value={publicLink} 
                      readOnly 
                      className="text-xs"
                    />
                    <Button variant="outline" size="icon" onClick={() => handleCopy(publicLink)}>
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </>
              )}
              {shareError && <p className="text-xs text-red-500">{shareError}</p>}
            </div>
          )}

          {mode === 'realtime' && (
            <div className="space-y-3">
              {isInRealtimeSession ? (
                <>
                  {/* Currently in a session - show room code */}
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {t('share.shareCodeToInvite')}
                  </p>
                  <div className="flex gap-2">
                    <Input 
                      value={existingRoomId || ''} 
                      readOnly 
                      className="font-mono text-center tracking-wider"
                    />
                    <Button variant="outline" size="icon" onClick={() => existingRoomId && handleCopy(existingRoomId)}>
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {/* Not in a session - show create option */}
                  <p className="text-sm">
                    {t('share.realtimeDescription')}
                  </p>
                </>
              )}
            </div>
          )}

          {mode === 'email' && (
            <div className="space-y-3">
              <p className="text-sm">
                {t('share.emailDescription')}
              </p>
              <Input 
                type="email"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                placeholder={t('share.emailPlaceholder')}
                disabled={isSharing}
              />
              {shareError && <p className="text-xs text-red-500">{shareError}</p>}
              {shareSuccess && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  {t('share.shareSuccess')}
                </p>
              )}
            </div>
          )}

          {mode === 'join' && (
            <div className="space-y-3">
              <p className="text-sm">
                {t('share.joinDescription')}
              </p>
              <Input 
                value={joinRoomId}
                onChange={(e) => {
                  setJoinRoomId(sanitizeRoomId(e.target.value))
                  setJoinError(null)
                }}
                placeholder={t('share.joinPlaceholder')}
                className="font-mono text-center tracking-wider text-lg"
                maxLength={6}
                inputMode="numeric"
                pattern="[0-9]*"
              />
              {joinError && (
                <div className="flex items-center gap-2 text-red-500 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{joinError}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>

      <DialogFooter>
        <Button variant="ghost" onClick={handleClose}>
          {t('share.close')}
        </Button>
        
        {mode === 'public' && !publicLink && (
          <Button onClick={handleSharePublic} disabled={isSharing || !isOnline}>
            {isSharing ? <Loader2 className="w-4 h-4 animate-spin" /> : t('share.createLink')}
          </Button>
        )}

        {mode === 'public' && publicLink && note?.publicFileId && (
          <Button onClick={handleSharePublic} disabled={isSharing || !isOnline} variant="outline">
            {isSharing ? <Loader2 className="w-4 h-4 animate-spin" /> : t('share.updateLink')}
          </Button>
        )}
        
        {mode === 'realtime' && !isInRealtimeSession && (
          <Button onClick={handleStartRealtime} disabled={!isOnline}>
            {t('share.start')}
          </Button>
        )}
        
        {mode === 'realtime' && isInRealtimeSession && onStopSharing && (
          <Button onClick={() => { onStopSharing(); handleClose(); }} variant="destructive">
            {t('share.stopSharing')}
          </Button>
        )}
        
        {mode === 'email' && (
          <Button onClick={handleShareViaEmail} disabled={!shareEmail.trim() || isSharing || !isOnline}>
            {isSharing ? <Loader2 className="w-4 h-4 animate-spin" /> : t('share.shareButton')}
          </Button>
        )}
        
        {mode === 'join' && (
          <Button 
            onClick={handleJoinRoom} 
            disabled={!isValidRoomId(sanitizeRoomId(joinRoomId)) || !isOnline || isCheckingRoom}
          >
            {isCheckingRoom ? <Loader2 className="w-4 h-4 animate-spin" /> : t('share.joinButton')}
          </Button>
        )}
      </DialogFooter>
    </Dialog>
  )
}

function TabButton({ children, active, onClick }: { 
  children: React.ReactNode
  active: boolean
  onClick: () => void 
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-1 rounded-[8px] text-xs font-medium transition-colors ${
        active 
          ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm' 
          : 'text-neutral-500 dark:text-neutral-400'
      }`}
    >
      {children}
    </button>
  )
}
