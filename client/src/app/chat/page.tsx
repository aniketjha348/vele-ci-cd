'use client'

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/useAuthStore'
import { io, Socket } from 'socket.io-client'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import Link from 'next/link'
import VideoChat from '@/components/VideoChat'
import { chatAPI } from '@/lib/api'
import ReportBlockModal from '@/components/ReportBlockModal'

export default function ChatPage() {
  const { user, setAuth, _hasHydrated } = useAuthStore()
  const router = useRouter()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [status, setStatus] = useState<'idle' | 'searching' | 'matched' | 'chatting'>('idle')
  const statusRef = useRef<'idle' | 'searching' | 'matched' | 'chatting'>('idle')
  
  // Keep status ref in sync with state
  useEffect(() => {
    statusRef.current = status
  }, [status])
  const [messages, setMessages] = useState<Array<{ message: string; timestamp: number; senderId: string }>>([])
  const [messageInput, setMessageInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [matchSocketId, setMatchSocketId] = useState<string | null>(null)
  const [showVideo, setShowVideo] = useState(false)
  const [skipInfo, setSkipInfo] = useState<{ skipsUsed: number; remainingSkips: number | string; maxSkips: number | string } | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [searchTime, setSearchTime] = useState(0)
  const [showReportModal, setShowReportModal] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()
  const searchTimerRef = useRef<NodeJS.Timeout>()
  const activeStreamsRef = useRef<MediaStream[]>([]) // Track all active streams for immediate stopping

  // Define loadSkipInfo before useEffect that uses it
  const loadSkipInfo = useCallback(async (retryCount = 0) => {
    try {
      const info = await chatAPI.getSkipCount()
      setSkipInfo(info)
    } catch (error: any) {
      // Handle rate limiting with exponential backoff
      if (error.response?.status === 429 && retryCount < 2) {
        const delay = Math.pow(2, retryCount) * 1000 // 1s, 2s
        setTimeout(() => {
          loadSkipInfo(retryCount + 1)
        }, delay)
        return
      }
      // Only log non-rate-limit errors
      if (error.response?.status !== 429) {
        console.error('Failed to load skip info:', error)
      }
    }
  }, [])

  // Wait for hydration before checking auth
  useEffect(() => {
    if (!_hasHydrated) {
      return
    }

    const token = localStorage.getItem('token')
    if (!user && !token) {
      router.push('/')
      return
    }

    // If token exists but user is null, restore user from token
    if (token && !user) {
      const restoreUser = async () => {
        try {
          const { userAPI } = await import('@/lib/api')
          const profileData = await userAPI.getProfile()
          if (profileData) {
            setAuth({
              id: profileData._id || profileData.id,
              email: profileData.email,
              username: profileData.username,
              tier: profileData.tier,
              coins: profileData.coins || 0,
              xp: profileData.xp || 0,
              level: profileData.level || 1,
              streak: profileData.streak || 0,
            }, token)
          }
        } catch (error) {
          localStorage.removeItem('token')
          router.push('/')
        }
      }
      restoreUser()
      return
    }

    if (!user) {
      router.push('/')
      return
    }

    // Load skip info
    loadSkipInfo()

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000'
    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'], // Fallback to polling if websocket fails
      reconnection: true,
      reconnectionAttempts: Infinity, // Keep trying to reconnect
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
      // Suppress connection errors in development
      forceNew: false, // Reuse existing connection if available
    })

    let isMounted = true

    let isInitialConnection = true
    let connectionCount = 0
    
    newSocket.on('connect', () => {
      if (!isMounted) return
      connectionCount++
      setIsConnected(true)
      
      // Only log first connection, suppress subsequent reconnections in console
      if (isInitialConnection) {
        console.log('✅ Connected to server')
        toast.success('Connected to server', { duration: 2000 })
        isInitialConnection = false
      } else {
        // Silently reconnect (don't spam console)
        // Only log if connection count is reasonable (not spam)
        if (connectionCount <= 3) {
          console.log('🔄 Reconnected to server')
        }
      }
    })

    newSocket.on('disconnect', (reason) => {
      if (!isMounted) return
      setIsConnected(false)
      
      // Suppress disconnect notifications for expected reasons
      if (
        reason === 'io client disconnect' || // User manually disconnected
        reason === 'transport close' || // Transport closed (may reconnect)
        reason === 'transport error' // Transport error (may reconnect)
      ) {
        // These are expected - don't show error
        return
      }
      
      // Only show error for unexpected disconnects
      if (reason === 'io server disconnect') {
        // Server disconnected us (maybe banned, or server restart)
        toast.error('Disconnected by server', { duration: 3000 })
      } else {
        // Other reasons (network issues, etc.)
        // Don't spam - only show once
        console.log('Disconnected:', reason)
      }
    })

    let errorCount = 0
    
    newSocket.on('connect_error', (error: any) => {
      // Suppress expected errors during development/Fast Refresh
      const errorMessage = error.message || ''
      const errorType = error.type || ''
      
      // Suppress common expected errors
      if (
        errorMessage.includes('closed before the connection is established') ||
        errorMessage.includes('WebSocket is closed') ||
        errorMessage.includes('ERR_CONNECTION_REFUSED') ||
        errorMessage.includes('TransportError') ||
        errorType === 'TransportError' ||
        errorType === 'xhr poll error'
      ) {
        // These are expected during:
        // - Fast Refresh (Next.js dev mode)
        // - Component unmounting
        // - Server restart
        // - Network interruptions
        // Don't spam console or show toasts
        errorCount++
        // Only log first few errors to avoid console spam
        if (process.env.NODE_ENV === 'development' && errorCount <= 2) {
          console.log('⚠️ Connection error (expected during Fast Refresh):', errorType || errorMessage.substring(0, 50))
        }
        return
      }
      
      // Only show unexpected errors
      if (isMounted) {
        console.error('❌ Unexpected connection error:', error)
        // Only show toast for persistent errors (not first attempt)
        // Note: readyState is a protected property, so we'll show toast for all persistent errors
        toast.error('Failed to connect to server. Retrying...')
      }
    })

    newSocket.on('searching', (data) => {
      // Don't reset to searching if we're already matched or chatting
      // Use ref to get current status (avoid stale closure)
      if (statusRef.current === 'matched' || statusRef.current === 'chatting') {
        return // Ignore searching events if already matched
      }
      setStatus('searching')
      statusRef.current = 'searching'
      setSearchTime(0)
      // Start search timer
      if (searchTimerRef.current) {
        clearInterval(searchTimerRef.current)
      }
      searchTimerRef.current = setInterval(() => {
        setSearchTime((prev) => prev + 1)
      }, 1000)
    })

    newSocket.on('match-found', (data) => {
      if (!isMounted) return
      
      console.log('[Client] Match found event received:', data)
      console.log('[Client] Current status:', statusRef.current)
      
      // Stop any search timers
      if (searchTimerRef.current) {
        clearInterval(searchTimerRef.current)
        searchTimerRef.current = undefined
      }
      
      // Set match information
      setMatchSocketId(data.matchSocketId)
      setStatus('matched')
      statusRef.current = 'matched'
      
      console.log('[Client] Status set to matched, matchSocketId:', data.matchSocketId)
      
      // Transition to chatting after brief animation
      setTimeout(() => {
        // Double-check we still have a match before transitioning
        if (data.matchSocketId && statusRef.current === 'matched') {
          console.log('[Client] Transitioning to chatting state')
          setStatus('chatting')
          statusRef.current = 'chatting'
          setSearchTime(0)
          // Clear messages from previous match
          setMessages([])
        } else {
          console.warn('[Client] Cannot transition to chatting - status changed or no matchSocketId')
        }
      }, 1000)
    })
    
    // Handle matchmaking stopped event (from server)
    newSocket.on('matchmaking-stopped', () => {
      if (!isMounted) return
      console.log('[Client] Matchmaking stopped by server')
    })

    newSocket.on('match-cancelled', () => {
      // Stop all timers
      if (searchTimerRef.current) {
        clearInterval(searchTimerRef.current)
        searchTimerRef.current = undefined
      }
      
      // Clear all state
      setStatus('idle')
      statusRef.current = 'idle'
      setMatchSocketId(null)
      setMessages([])
      setShowVideo(false)
      setSearchTime(0)
      
      toast.success('Match search cancelled')
    })

    newSocket.on('receive-message', (data) => {
      if (!isMounted) return
      
      console.log('[Chat] Received message:', { message: data.message, senderId: data.senderId, isOwnMessage: data.senderId === newSocket.id })
      
      // Check if message already exists (prevent duplicates from optimistic update + server echo)
      setMessages((prev) => {
        // Check if this message already exists (same senderId and message within 2 seconds)
        // Using 2 seconds to account for network delay
        const exists = prev.some(
          (msg) => 
            msg.senderId === data.senderId && 
            msg.message === data.message &&
            Math.abs(msg.timestamp - data.timestamp) < 2000
        )
        
        if (exists) {
          console.log('[Chat] Duplicate message detected, skipping')
          return prev // Don't add duplicate
        }
        
        console.log('[Chat] Adding message to chat')
        return [...prev, data]
      })
    })

    newSocket.on('message-blocked', (data) => {
      if (!isMounted) return
      
      // Remove the message that was blocked (optimistic update failed)
      const currentSocketId = newSocket.id
      setMessages((prev) => {
        // Remove the most recent message from this sender (the one that was blocked)
        const filtered = prev.filter((msg, idx, arr) => {
          // Keep all messages except the last one from this sender if it matches
          if (idx === arr.length - 1 && msg.senderId === currentSocketId) {
            return false // Remove the blocked message
          }
          return true
        })
        return filtered
      })
      
      toast.error(data.reason || 'Message blocked')
    })

    newSocket.on('user-typing', () => {
      setIsTyping(true)
    })

    newSocket.on('user-stopped-typing', () => {
      setIsTyping(false)
    })

    newSocket.on('match-ended', (data) => {
      if (!isMounted) return
      
      console.log('[Chat] Match ended event received:', { 
        reason: data?.reason, 
        autoRequeue: data?.autoRequeue,
        fromSocketId: data?.fromSocketId 
      })
      
      // Stop any timers
      if (searchTimerRef.current) {
        clearInterval(searchTimerRef.current)
        searchTimerRef.current = undefined
      }
      
      // CRITICAL: Always clear match state when match ends
      // This ensures both users disconnect properly
      setMatchSocketId(null)
      setMessages([])
      setShowVideo(false)
      setSearchTime(0)
      
      // If autoRequeue is true, automatically start searching again
      // NOTE: The skipping user's auto-requeue is handled server-side,
      // this is only for the user who was skipped
      if (data?.autoRequeue && user) {
        console.log('[Chat] Match ended, auto-requeueing (client-side)...')
        
        // CRITICAL: Ensure VideoChat cleanup completes before starting new search
        // This prevents WebRTC errors from stale peer connections
        // Wait longer to ensure all cleanup (media tracks, peer connections) is done
        setTimeout(() => {
          // Clear match state (ensures VideoChat component unmounts and cleans up)
          setStatus('searching')
          statusRef.current = 'searching'
          
          // Start search timer
          setSearchTime(0)
          if (searchTimerRef.current) {
            clearInterval(searchTimerRef.current)
          }
          searchTimerRef.current = setInterval(() => {
            setSearchTime((prev) => prev + 1)
          }, 1000)
          
          // Automatically start matchmaking after ensuring cleanup completes
          // Additional delay allows VideoChat useEffect cleanup to finish
          setTimeout(() => {
            if (newSocket && newSocket.connected && user) {
              console.log('[Chat] Auto-requeue: Starting new match search (client-side)')
              newSocket.emit('find-match', {
                userId: user.id,
                preferences: {
                  tier: user.tier,
                },
              })
              toast('Match ended - searching for new match...', { icon: '🔄' })
            }
          }, 300) // Additional delay before emitting find-match
        }, 800) // Increased delay to ensure VideoChat cleanup completes (media tracks, peer connections)
        
        loadSkipInfo() // Refresh skip count
      } else {
        // No auto-requeue, go back to idle
        setStatus('idle')
        statusRef.current = 'idle'
        
        if (data?.reason === 'skipped') {
          loadSkipInfo() // Refresh skip count
          toast('Match ended')
        }
      }
    })

    newSocket.on('skip-success', (data) => {
      // Auto-requeue was successful (server-side handled it)
      console.log('[Chat] Skip success event received:', { autoRequeue: data?.autoRequeue })
      if (data?.autoRequeue) {
        // Server already added us to queue, just update UI
        // Clear any old match state
        setMatchSocketId(null)
        setMessages([])
        setShowVideo(false)
        
        // Ensure we're in searching state
        setStatus('searching')
        statusRef.current = 'searching'
        setSearchTime(0)
        
        // Start search timer if not already running
        if (searchTimerRef.current) {
          clearInterval(searchTimerRef.current)
        }
        searchTimerRef.current = setInterval(() => {
          setSearchTime((prev) => prev + 1)
        }, 1000)
      }
    })

    setSocket(newSocket)

    return () => {
      isMounted = false
      if (searchTimerRef.current) {
        clearInterval(searchTimerRef.current)
      }
      // Clean up socket connection
      // disconnect() is safe to call even if not connected
      if (newSocket) {
        newSocket.removeAllListeners()
        newSocket.disconnect()
      }
    }
  }, [_hasHydrated, user, router, setAuth, loadSkipInfo])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const startSearch = useCallback(() => {
    if (socket && user) {
      socket.emit('find-match', {
        userId: user.id,
        preferences: {
          tier: user.tier,
        },
      })
      setStatus('searching')
      statusRef.current = 'searching'
    }
  }, [socket, user])

  const sendMessage = () => {
    if (!socket || !matchSocketId) {
      console.warn('[Chat] Cannot send message - socket or matchSocketId missing')
      return
    }
    
    const message = messageInput.trim()
    if (!message) return
    
    // Add message to local state immediately (optimistic update)
    // This ensures the message appears instantly for the sender
    const currentSocketId = socket.id
    if (!currentSocketId) {
      console.warn('[Chat] Cannot send message - socket.id is undefined')
      return
    }
    
    const newMessage = {
      message,
      timestamp: Date.now(),
      senderId: currentSocketId, // This is your own message
    }
    
    console.log('[Chat] Sending message, adding to local state:', { message, senderId: currentSocketId })
    setMessages((prev) => [...prev, newMessage])
    
    // Clear input
    setMessageInput('')
    
    // Send to server
    socket.emit('send-message', { message })
  }

  const handleTyping = () => {
    if (socket) {
      socket.emit('typing')
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stop-typing')
      }, 1000)
    }
  }

  const cancelSearch = () => {
    if (socket) {
      // Use ref to check current status (avoid stale closure)
      if (statusRef.current === 'searching') {
        socket.emit('cancel-match')
        // Optimistically update UI
        setStatus('idle')
        statusRef.current = 'idle'
        setSearchTime(0)
        
        // Stop search timer
        if (searchTimerRef.current) {
          clearInterval(searchTimerRef.current)
          searchTimerRef.current = undefined
        }
      } else if (statusRef.current === 'matched' || statusRef.current === 'chatting') {
        // If somehow stuck in matched/chatting, force exit
        exitChat()
      }
    }
  }

  const skip = async () => {
    if (!socket || !user) return
    
    // Only allow skip if we're in a match/chatting
    if (statusRef.current !== 'matched' && statusRef.current !== 'chatting') {
      console.warn('Cannot skip - not in a match')
      return
    }

    try {
      // Check skip limit first
      const skipData = await chatAPI.useSkip()
      
      if (skipData.success) {
        // Clear current match state FIRST
        const currentMatchSocketId = matchSocketId
        setMessages([])
        setMatchSocketId(null)
        setShowVideo(false)
        
        // Emit skip with auto-requeue enabled
        socket.emit('skip', {
          userId: user.id,
          preferences: {
            tier: user.tier,
          },
          autoRequeue: true, // Automatically search for another match
        })
        
        // Wait a moment for server to process, then set status to searching
        setTimeout(() => {
          // Only set to searching if we're not already in a new match
          if (statusRef.current !== 'matched' && statusRef.current !== 'chatting') {
            setStatus('searching')
            statusRef.current = 'searching'
            setSearchTime(0)
            
            // Start search timer
            if (searchTimerRef.current) {
              clearInterval(searchTimerRef.current)
            }
            searchTimerRef.current = setInterval(() => {
              setSearchTime((prev) => prev + 1)
            }, 1000)
          }
        }, 200) // Small delay to ensure server processes skip
        
        loadSkipInfo() // Refresh skip count
        toast.success(`Skipped! Finding new match... (${skipData.remainingSkips === 'unlimited' ? '∞' : skipData.remainingSkips} skips left)`)
      }
    } catch (error: any) {
      if (error.response?.status === 400) {
        toast.error(error.response.data.message || 'Daily skip limit reached!')
        if (user.tier === 'free') {
          toast('Upgrade to Premium for unlimited skips!', { icon: '💎' })
        }
      } else {
        toast.error('Failed to skip')
      }
    }
  }

  const exitChat = () => {
    // CRITICAL: Stop all camera/microphone access immediately
    // This must happen BEFORE clearing state to ensure tracks are stopped
    
    console.log('[Chat] Exit chat called - stopping all media tracks')
    
    // CRITICAL: Stop all active streams from our ref FIRST
    let tracksStopped = 0
    activeStreamsRef.current.forEach((stream) => {
      stream.getTracks().forEach((track) => {
        try {
          if (track.readyState === 'live') {
            track.stop()
            tracksStopped++
            console.log(`[Chat] Stopped ${track.kind} track from activeStreamsRef`)
          }
        } catch (e) {
          // Ignore errors
        }
      })
    })
    activeStreamsRef.current = [] // Clear the ref
    
    // CRITICAL: Clear matchSocketId FIRST to prevent VideoChat from requesting new streams
    setMatchSocketId(null)
    setShowVideo(false)
    
    // Method 1: Stop tracks from all video elements on the page
    const videoElements = document.querySelectorAll('video')
    videoElements.forEach((video) => {
      if (video.srcObject) {
        const stream = video.srcObject as MediaStream
        stream.getTracks().forEach((track) => {
          try {
            if (track.readyState === 'live') {
              track.stop()
              tracksStopped++
              console.log(`[Chat] Stopped ${track.kind} track from video element`)
            }
          } catch (e) {
            // Ignore errors
          }
        })
        video.srcObject = null
        video.load() // Reset video element
      }
    })
    
    // Method 2: Enumerate all media tracks from all video/audio elements
    // This is a comprehensive approach to catch any remaining tracks
    const allMediaElements = document.querySelectorAll('video, audio')
    allMediaElements.forEach((element) => {
      const mediaElement = element as HTMLVideoElement | HTMLAudioElement
      if (mediaElement.srcObject) {
        const stream = mediaElement.srcObject as MediaStream
        stream.getTracks().forEach((track) => {
          try {
            if (track.readyState === 'live') {
              track.stop()
              tracksStopped++
              console.log(`[Chat] Stopped ${track.kind} track from media element`)
            }
          } catch (e) {
            // Ignore errors
          }
        })
        mediaElement.srcObject = null
        mediaElement.load()
      }
    })
    
    console.log(`[Chat] Stopped ${tracksStopped} media tracks total`)
    
    if (socket) {
      // Use ref to check current status (avoid stale closure)
      const currentStatus = statusRef.current
      
      // Cancel any ongoing search
      if (currentStatus === 'searching') {
        socket.emit('cancel-match')
      }
      
      // If in a match, end it (without auto-requeue)
      if (currentStatus === 'chatting' || currentStatus === 'matched') {
        socket.emit('skip', { 
          userId: user?.id,
          preferences: { tier: user?.tier },
          autoRequeue: false 
        })
      }
      
      // Immediately set status to idle to prevent any re-initialization
      setStatus('idle')
      statusRef.current = 'idle'
      setMessages([])
      setSearchTime(0)
      
      // Stop all timers
      if (searchTimerRef.current) {
        clearInterval(searchTimerRef.current)
        searchTimerRef.current = undefined
      }
      
      toast.success('Exited chat')
    }
    
    console.log('[Chat] Exit chat complete')
  }

  // Memoize stream callbacks to prevent unnecessary re-renders
  const handleStreamCreated = useCallback((stream: MediaStream) => {
    if (!activeStreamsRef.current.includes(stream)) {
      activeStreamsRef.current.push(stream)
      console.log('[Chat] Tracked new stream:', stream.id, 'Total streams:', activeStreamsRef.current.length)
    }
  }, [])

  const handleStreamDestroyed = useCallback((stream: MediaStream) => {
    activeStreamsRef.current = activeStreamsRef.current.filter(s => s !== stream)
    console.log('[Chat] Removed stream from tracking:', stream.id, 'Remaining streams:', activeStreamsRef.current.length)
  }, [])

  // Wait for hydration before rendering
  if (!_hasHydrated) {
    return (
      <div className="min-h-screen bg-cyberpunk-darker flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyberpunk-purple border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-cyberpunk-darker flex flex-col relative">
      {/* Compact Header - Minimal for Omegle Style */}
      <div className="glass-effect border-b border-cyberpunk-purple/30 sticky top-0 z-50 backdrop-blur-md">
        <div className="container mx-auto px-3 py-2 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {/* Only show Dashboard link when not searching/matching */}
            {status !== 'searching' && status !== 'matched' && (
              <>
                <Link href="/dashboard" className="text-gradient font-bold text-lg hover:scale-105 transition-transform">
                  ← Dashboard
                </Link>
                <div className="h-4 w-px bg-cyberpunk-purple/30"></div>
              </>
            )}
            {/* Minimal status during searching */}
            {status === 'searching' && (
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full animate-pulse ${isConnected ? 'bg-cyberpunk-green' : 'bg-red-500'}`} />
                <span className="text-xs text-gray-400">Searching...</span>
              </div>
            )}
            {/* Full status when idle or chatting */}
            {(status === 'idle' || status === 'chatting') && (
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-cyberpunk-green' : 'bg-red-500'}`} />
                <span className="text-xs text-gray-400">{user.username}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  isConnected ? 'bg-cyberpunk-green/20 text-cyberpunk-green' : 'bg-red-500/20 text-red-400'
                }`}>
                  {isConnected ? 'Online' : 'Offline'}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Minimal header - only show essential info */}
            {status === 'searching' && (
              <motion.button
                onClick={() => {
                  cancelSearch()
                  exitChat()
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="text-xs px-3 py-1.5 bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg hover:bg-red-500/30"
                title="Stop searching"
              >
                Stop
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content - Full Screen for Omegle Style */}
      <div className={`flex-1 ${status === 'chatting' ? 'px-0' : 'container mx-auto px-4 py-4'} flex flex-col ${status === 'chatting' ? 'max-w-full' : 'max-w-6xl'}`}>
        {status === 'idle' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex items-center justify-center"
          >
            <div className="text-center max-w-md">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-7xl mb-6"
              >
                🎭
              </motion.div>
              <h3 className="text-3xl font-bold text-gradient mb-3">Talk to Strangers</h3>
              <p className="text-gray-400 text-sm mb-8">
                Click &quot;START&quot; to begin chatting with random people
              </p>
              {/* Large START Button (Omegle Style) */}
              <motion.button
                onClick={startSearch}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                className="bg-cyberpunk-green hover:bg-cyberpunk-green/80 text-white px-12 py-4 text-xl font-bold rounded-lg shadow-lg shadow-cyberpunk-green/50 transition-all flex items-center gap-3 mx-auto"
              >
                <span className="text-2xl">▶️</span>
                <span>START</span>
              </motion.button>
              {skipInfo && (
                <p className="text-xs text-gray-500 mt-4">
                  Skips: {skipInfo.remainingSkips === 'unlimited' ? '∞ Unlimited' : `${skipInfo.remainingSkips} left`}
                </p>
              )}
            </div>
          </motion.div>
        )}

        {status === 'searching' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex items-center justify-center"
          >
            <div className="text-center">
              {/* Omegle-style searching animation - Cyberpunk themed */}
              <motion.div
                className="relative mb-8"
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              >
                <div className="w-32 h-32 border-4 border-cyberpunk-purple border-t-transparent rounded-full mx-auto relative">
                  <div className="absolute inset-0 border-4 border-cyberpunk-blue border-r-transparent rounded-full animate-pulse" />
                </div>
              </motion.div>
              <motion.h3
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-3xl font-bold bg-gradient-to-r from-cyberpunk-purple via-cyberpunk-blue to-cyberpunk-purple bg-clip-text text-transparent mb-3"
              >
                Connecting to stranger...
              </motion.h3>
              <p className="text-sm text-gray-400">
                Please wait while we find someone interesting
              </p>
            </div>
          </motion.div>
        )}

        {status === 'matched' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex items-center justify-center"
          >
            <div className="text-center">
              <motion.div
                animate={{ 
                  scale: [1, 1.2, 1],
                }}
                transition={{ 
                  duration: 0.8,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
                className="text-7xl mb-4"
              >
                ✨
              </motion.div>
              <motion.h3
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl font-bold text-cyberpunk-green mb-2"
              >
                Connected!
              </motion.h3>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-gray-400 text-sm"
              >
                Starting conversation...
              </motion.p>
            </div>
          </motion.div>
        )}

        {status === 'chatting' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-row gap-4 h-full"
          >
            {/* Left Side: Video Screens - Exactly 50% Width */}
            <div className="w-1/2 flex flex-col gap-3 min-w-0">
              {/* Video Chat Boxes - Takes full available height */}
              <div className="flex-1 relative cyberpunk-card p-0 overflow-hidden min-h-0">
                {matchSocketId && (
                  <VideoChat 
                    socket={socket!} 
                    matchSocketId={matchSocketId}
                    onStreamCreated={handleStreamCreated}
                    onStreamDestroyed={handleStreamDestroyed}
                  />
                )}
              </div>

              {/* Action Buttons - Below Video - Compact */}
              <div className="flex gap-2 justify-center items-center pb-1">
                {/* NEXT Button - Using Website Theme */}
                <motion.button
                  onClick={skip}
                  disabled={skipInfo?.remainingSkips === 0 && user?.tier === 'free'}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className={`text-sm font-bold rounded-xl flex items-center gap-2 px-5 py-2 ${
                    skipInfo?.remainingSkips === 0 && user?.tier === 'free'
                      ? 'bg-cyberpunk-gray/50 text-gray-400 cursor-not-allowed border-2 border-cyberpunk-gray/50'
                      : 'cyberpunk-button text-sm py-2 px-5'
                  } transition-all`}
                  title="Skip to next stranger"
                >
                  <span className="text-base">⏭️</span>
                  <span>NEXT</span>
                  {skipInfo && (
                    <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-full border border-white/30">
                      {skipInfo.remainingSkips === 'unlimited' ? '∞' : skipInfo.remainingSkips}
                    </span>
                  )}
                </motion.button>

                {/* STOP Button - Using Website Theme */}
                <motion.button
                  onClick={exitChat}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="cyberpunk-button-secondary text-sm py-2 px-4 flex items-center gap-1.5"
                  title="Stop and exit"
                >
                  <span className="text-sm">⏹️</span>
                  <span>STOP</span>
                </motion.button>

                {/* Report Button - Using Website Theme */}
                <motion.button
                  onClick={() => setShowReportModal(true)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-2 bg-cyberpunk-gray/50 hover:bg-cyberpunk-gray border-2 border-cyberpunk-purple/50 hover:border-cyberpunk-purple rounded-xl text-red-400 transition-all backdrop-blur-sm"
                  title="Report or block"
                >
                  <span className="text-xs">⚠️</span>
                </motion.button>
              </div>
            </div>

            {/* Right Side: Chat Screen - Exactly 50% Width */}
            <div className="w-1/2 flex flex-col cyberpunk-card p-0 overflow-hidden min-w-0">
              {/* Chat Header - Using Website Theme */}
              <div className="px-4 py-3 border-b border-cyberpunk-purple/30 glass-effect flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-cyberpunk-purple animate-pulse"></div>
                  <h3 className="text-sm font-bold text-gradient">
                    Text Chat
                  </h3>
                </div>
              </div>

              {/* Messages Container - Takes remaining space */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 modal-scroll min-h-0">
                {messages.length === 0 && (
                  <div className="text-center py-12">
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="text-5xl mb-3"
                    >
                      💬
                    </motion.div>
                    <p className="text-sm text-gray-400 font-medium">Start the conversation!</p>
                    <p className="text-xs text-gray-500 mt-1">Type a message below</p>
                  </div>
                )}
                {messages.map((msg, idx) => {
                  const isOwnMessage = msg.senderId === socket?.id
                  return (
                    <motion.div
                      key={`${msg.timestamp}-${idx}-${msg.senderId}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                          isOwnMessage
                            ? 'bg-cyberpunk-purple/80 text-white border border-cyberpunk-purple/50 shadow-lg shadow-cyberpunk-purple/30'
                            : 'bg-cyberpunk-gray/80 text-gray-200 border border-cyberpunk-gray/50 shadow-lg'
                        } backdrop-blur-sm`}
                      >
                        {msg.message}
                      </div>
                    </motion.div>
                  )
                })}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="glass-effect px-4 py-2.5 rounded-lg">
                      <div className="flex items-center gap-1.5 text-xs text-cyberpunk-purple italic">
                        <span>Stranger is typing</span>
                        <motion.span
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        >
                          ...
                        </motion.span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Area - Fixed at bottom - Using Website Theme */}
              <div className="border-t border-cyberpunk-purple/30 p-3 bg-cyberpunk-gray/20 flex-shrink-0">
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => {
                      setMessageInput(e.target.value)
                      handleTyping()
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        sendMessage()
                      }
                    }}
                    className="cyberpunk-input flex-1 text-sm py-2.5 px-4"
                    placeholder="Type a message..."
                    maxLength={500}
                    autoFocus
                  />
                  <motion.button
                    onClick={sendMessage}
                    disabled={!messageInput.trim()}
                    whileHover={{ scale: messageInput.trim() ? 1.05 : 1 }}
                    whileTap={{ scale: 0.95 }}
                    className="cyberpunk-button text-sm py-2.5 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send
                  </motion.button>
                </div>
                <div className="flex items-center justify-between mt-1.5 text-xs text-gray-500">
                  <span className="text-gray-400">Press Enter to send</span>
                  <span className={messageInput.length > 450 ? 'text-red-400 font-medium' : 'text-gray-400'}>
                    {messageInput.length}/500
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Report/Block Modal */}
      {status === 'chatting' && matchSocketId && (
        <ReportBlockModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          socketId={matchSocketId}
        />
      )}
    </div>
  )
}

