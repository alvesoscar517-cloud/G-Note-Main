import { useState, useEffect, useRef } from 'react'
import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import { generateUserColor } from '@/lib/collaboration'

export interface CollaboratorInfo {
    name: string
    color: string
    picture?: string
}

export interface UseCollaborationProps {
    roomId: string | null
    userInfo: {
        name?: string
        avatar?: string
    } | null
}

export function useCollaboration({ roomId, userInfo }: UseCollaborationProps) {
    const [provider, setProvider] = useState<WebrtcProvider | null>(null)
    const [ydoc, setYdoc] = useState<Y.Doc | null>(null)
    const [isProviderReady, setIsProviderReady] = useState(false)
    const [awarenessDoc, setAwarenessDoc] = useState<Y.Doc | null>(null)
    const [collaborators, setCollaborators] = useState<CollaboratorInfo[]>([])
    const [userColor] = useState(() => generateUserColor())

    // Use refs to track current provider/ydoc for cleanup
    const providerRef = useRef<WebrtcProvider | null>(null)
    const ydocRef = useRef<Y.Doc | null>(null)

    // Use refs for user info to avoid re-running effect when these change
    const userNameRef = useRef(userInfo?.name)
    const userAvatarRef = useRef(userInfo?.avatar)
    userNameRef.current = userInfo?.name
    userAvatarRef.current = userInfo?.avatar

    // Setup collaboration when roomId changes
    useEffect(() => {
        // Cleanup previous provider/ydoc if exists
        if (providerRef.current) {
            providerRef.current.disconnect()
            providerRef.current.destroy()
            providerRef.current = null
        }
        if (ydocRef.current) {
            ydocRef.current.destroy()
            ydocRef.current = null
        }

        if (!roomId) {
            setProvider(null)
            setYdoc(null)
            setIsProviderReady(false)
            setAwarenessDoc(null)
            return
        }

        let cancelled = false
        let readyTimeout: ReturnType<typeof setTimeout>
        let interval: ReturnType<typeof setInterval>
        let newProvider: WebrtcProvider | null = null
        let newYdoc: Y.Doc | null = null

        const setupCollaboration = async () => {
            console.log('[Collab] Starting collaboration for room:', roomId)

            newYdoc = new Y.Doc()

            // Get signaling servers from environment variable
            const signalingServers = import.meta.env.VITE_SIGNALING_SERVERS
                ? import.meta.env.VITE_SIGNALING_SERVERS.split(',').map((s: string) => s.trim())
                : []

            console.log('[Collab] Using signaling servers:', signalingServers)

            // Fetch ICE servers from Metered API (includes STUN + TURN)
            // This enables cross-network connections (WiFi to 4G, etc.)
            const meteredApiKey = import.meta.env.VITE_METERED_API_KEY
            let iceServers: RTCIceServer[] = [
                // Fallback STUN servers if API fails
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
            ]

            if (meteredApiKey) {
                try {
                    const response = await fetch(`https://gnote.metered.live/api/v1/turn/credentials?apiKey=${meteredApiKey}`)
                    if (response.ok) {
                        const meteredServers = await response.json()
                        iceServers = meteredServers
                        console.log('[Collab] Loaded ICE servers from Metered:', iceServers.length, 'servers')
                    }
                } catch (error) {
                    console.warn('[Collab] Failed to fetch Metered ICE servers, using fallback:', error)
                }
            }

            if (cancelled) return

            newProvider = new WebrtcProvider(`notes-app-${roomId}`, newYdoc, {
                signaling: signalingServers,
                peerOpts: {
                    config: {
                        iceServers: iceServers
                    }
                }
            })

            // Store in refs for cleanup
            providerRef.current = newProvider
            ydocRef.current = newYdoc

            newProvider.awareness.setLocalStateField('user', {
                name: userNameRef.current || 'Anonymous',
                color: userColor,
                colorLight: userColor + '40',
                picture: userAvatarRef.current || null
            })

            // Log connection status
            newProvider.on('synced', (event: { synced: boolean }) => {
                console.log('[Collab] Provider synced:', event.synced)
            })

            newProvider.on('peers', (event: { added: string[], removed: string[], webrtcPeers: string[], bcPeers: string[] }) => {
                console.log('[Collab] Peers changed:', event)
            })

            if (cancelled) return

            setYdoc(newYdoc)
            setProvider(newProvider)

            // Wait for awareness to be fully initialized with doc before marking ready
            // CollaborationCursor needs awareness.doc to be available
            const checkReady = () => {
                if (cancelled || !newProvider) return
                // Check if awareness has doc property (required by CollaborationCursor)
                // Also verify the doc is the same as our ydoc
                const aDoc = (newProvider.awareness as any).doc
                if (newProvider.awareness && aDoc && aDoc === newYdoc) {
                    console.log('[Collab] Provider ready, awareness doc available')
                    setAwarenessDoc(aDoc)
                    setIsProviderReady(true)
                } else {
                    // Retry after a short delay
                    readyTimeout = setTimeout(checkReady, 100)
                }
            }

            // Start checking after initial setup - give more time for initialization
            readyTimeout = setTimeout(checkReady, 300)

            // Update collaborators list
            const updateCollaborators = () => {
                if (!newProvider) return
                const collabs: CollaboratorInfo[] = []
                newProvider.awareness.getStates().forEach((state) => {
                    if (state.user) {
                        collabs.push({
                            name: state.user.name || 'Anonymous',
                            color: state.user.color || '#888',
                            picture: state.user.picture || undefined
                        })
                    }
                })
                console.log('[Collab] Collaborators updated:', collabs.length)
                setCollaborators(collabs)
            }

            newProvider.awareness.on('change', updateCollaborators)
            // Initial update
            updateCollaborators()
            interval = setInterval(updateCollaborators, 2000)
        }

        setupCollaboration()

        return () => {
            console.log('[Collab] Cleaning up room:', roomId)
            cancelled = true
            if (readyTimeout) clearTimeout(readyTimeout)
            if (interval) clearInterval(interval)
            if (newProvider) {
                newProvider.awareness.off('change', () => { })
            }
            setIsProviderReady(false)
            // Cleanup will be done at the start of next effect run
        }
    }, [roomId, userColor]) // Only re-run when roomId or userColor changes, not user info

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (providerRef.current) {
                providerRef.current.disconnect()
                providerRef.current.destroy()
            }
            if (ydocRef.current) {
                ydocRef.current.destroy()
            }
        }
    }, [])

    // Reconnect WebRTC when tab becomes visible again (after phone sleep/unlock)
    useEffect(() => {
        if (!roomId || !providerRef.current) return

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && providerRef.current) {
                console.log('[Collab] Tab visible, checking connection...')
                // WebrtcProvider will auto-reconnect, but we can force it
                if (!providerRef.current.connected) {
                    console.log('[Collab] Reconnecting...')
                    providerRef.current.connect()
                }
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [roomId])

    return {
        provider,
        ydoc,
        isProviderReady,
        collaborators,
        awarenessDoc,
        userColor
    }
}
