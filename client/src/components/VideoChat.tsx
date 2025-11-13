'use client'

import { useEffect, useRef, useState, memo } from 'react'
import { Socket } from 'socket.io-client'
import SimplePeer from 'simple-peer'
import { motion } from 'framer-motion'

interface VideoChatProps {
  socket: Socket
  matchSocketId: string | null
  onStreamCreated?: (stream: MediaStream) => void
  onStreamDestroyed?: (stream: MediaStream) => void
}

function VideoChat({ socket, matchSocketId, onStreamCreated, onStreamDestroyed }: VideoChatProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [remoteAudioEnabled, setRemoteAudioEnabled] = useState(true)
  const [isConnecting, setIsConnecting] = useState(true)
  const peerRef = useRef<SimplePeer.Instance | null>(null)
  const [isInitiator, setIsInitiator] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const cleanupRunRef = useRef(false) // Prevent multiple cleanups
  const localStreamRef = useRef<MediaStream | null>(null) // Track stream for cleanup
  const remoteStreamRef = useRef<MediaStream | null>(null) // Track stream for cleanup
  const offerSentRef = useRef(false) // Track if offer was sent (persists across re-renders)
  const answerSentRef = useRef(false) // Track if answer was sent (persists across re-renders)
  const streamReceivedRef = useRef(false) // Track if stream was received (persists across re-renders)
  const isInitializingRef = useRef(false) // Prevent multiple simultaneous initializations
  const offerReceivedRef = useRef(false) // Track if offer was received (persists across re-renders)
  const answerReceivedRef = useRef(false) // Track if answer was received (persists across re-renders)

  useEffect(() => {
    // Reset cleanup flag when matchSocketId changes
    cleanupRunRef.current = false
    
    if (!matchSocketId) {
      // Reset flags when matchSocketId is cleared
      offerSentRef.current = false
      answerSentRef.current = false
      streamReceivedRef.current = false
      isInitializingRef.current = false
      offerReceivedRef.current = false
      answerReceivedRef.current = false
      
      // CRITICAL: Stop all existing streams when matchSocketId is null
      // This prevents streams from continuing after component unmount
      console.log('[VideoChat] matchSocketId is null - stopping all streams immediately')
      
      if (localStreamRef.current) {
        const stream = localStreamRef.current
        // Notify parent about stream destruction
        if (onStreamDestroyed) {
          onStreamDestroyed(stream)
        }
        
        stream.getTracks().forEach((track) => {
          try {
            if (track.readyState === 'live') {
              track.stop()
              console.log('[VideoChat] Stopped local track:', track.kind, track.id)
            }
          } catch (e) {
            // Ignore errors
          }
        })
        localStreamRef.current = null
        setLocalStream(null)
      }
      
      if (remoteStreamRef.current) {
        const stream = remoteStreamRef.current
        // Notify parent about stream destruction
        if (onStreamDestroyed) {
          onStreamDestroyed(stream)
        }
        
        stream.getTracks().forEach((track) => {
          try {
            if (track.readyState === 'live') {
              track.stop()
              console.log('[VideoChat] Stopped remote track:', track.kind, track.id)
            }
          } catch (e) {
            // Ignore errors
          }
        })
        remoteStreamRef.current = null
        setRemoteStream(null)
      }
      
      // Clear video elements
      // Copy refs to variables to avoid stale closures
      const currentLocalVideoForCleanup = localVideoRef.current
      const currentRemoteVideoForCleanup = remoteVideoRef.current
      
      if (currentLocalVideoForCleanup?.srcObject) {
        const stream = currentLocalVideoForCleanup.srcObject as MediaStream
        stream.getTracks().forEach((track) => {
          try {
            if (track.readyState === 'live') {
              track.stop()
            }
          } catch (e) {
            // Ignore errors
          }
        })
        currentLocalVideoForCleanup.srcObject = null
        currentLocalVideoForCleanup.load()
      }
      
      if (currentRemoteVideoForCleanup?.srcObject) {
        const stream = currentRemoteVideoForCleanup.srcObject as MediaStream
        stream.getTracks().forEach((track) => {
          try {
            if (track.readyState === 'live') {
              track.stop()
            }
          } catch (e) {
            // Ignore errors
          }
        })
        currentRemoteVideoForCleanup.srcObject = null
        currentRemoteVideoForCleanup.load()
      }
      
      // Destroy peer connection if it exists
      if (peerRef.current) {
        try {
          peerRef.current.destroy()
        } catch (e) {
          // Ignore errors
        }
        peerRef.current = null
      }
      
      return
    }

    // Copy refs to variables at the start of the effect to avoid stale closures in cleanup
    const currentLocalVideoRef = localVideoRef.current
    const currentRemoteVideoRef = remoteVideoRef.current

    // Prevent multiple simultaneous initializations
    if (isInitializingRef.current) {
      console.log('[VideoChat] ⚠️ Already initializing, skipping duplicate')
      return
    }
    isInitializingRef.current = true

    setIsConnecting(true)
    
    // Prevent multiple peer creations
    if (peerRef.current) {
      console.log('[VideoChat] ⚠️ Peer already exists, destroying before creating new one')
      try {
        peerRef.current.destroy()
      } catch (e) {
        // Ignore errors
      }
      peerRef.current = null
    }
    
    // Reset signal flags for new match
    offerSentRef.current = false
    answerSentRef.current = false
    streamReceivedRef.current = false
    offerReceivedRef.current = false
    answerReceivedRef.current = false

    // CRITICAL: Check if matchSocketId is still valid before requesting media
    // This prevents requesting new streams after component is unmounting
    if (!matchSocketId) {
      console.log('[VideoChat] matchSocketId is null, skipping getUserMedia')
      isInitializingRef.current = false
      return
    }
    
    // Store current matchSocketId in a variable to check after async operations
    const currentMatchSocketId = matchSocketId
    
    // Get user media
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        // CRITICAL: Double-check matchSocketId is still valid after async getUserMedia
        // This prevents continuing if component unmounted during getUserMedia call
        if (!matchSocketId || matchSocketId !== currentMatchSocketId) {
          console.log('[VideoChat] matchSocketId became null during getUserMedia, stopping stream')
          stream.getTracks().forEach((track) => {
            try {
              track.stop()
            } catch (e) {
              // Ignore errors
            }
          })
          isInitializingRef.current = false
          return
        }
        
        localStreamRef.current = stream // Store in ref for cleanup
        setLocalStream(stream)
        
        // Notify parent component about stream creation
        if (onStreamCreated) {
          onStreamCreated(stream)
        }
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }

        // Determine initiator (first socket ID becomes initiator)
        const initiator = socket.id ? socket.id < matchSocketId : false
        setIsInitiator(initiator)

        // Create peer connection
        // Use trickle: true for better connection reliability
        const peer = new SimplePeer({
          initiator,
          trickle: true, // Enable trickle ICE for faster connection
          stream,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
            ],
          },
        })
        
        console.log('[VideoChat] Peer created:', {
          initiator,
          matchSocketId,
          hasStream: !!stream,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length
        })

        // Track signal count for this peer instance
        let signalCount = 0
        let lastSentOffer: string | null = null
        let lastSentAnswer: string | null = null
        
        peer.on('signal', (data) => {
          signalCount++
          
          // SimplePeer signal data structure:
          // - For offer/answer: { type: 'offer'|'answer', sdp: '...' }
          // - For ICE candidates: { candidate: '...' } or just the candidate string
          // With trickle: true, we get one offer/answer signal, then multiple ICE candidate signals
          
          const dataStr = typeof data === 'string' ? data : JSON.stringify(data)
          const isSdp = (typeof data === 'object' && data.sdp) || dataStr.includes('"sdp"')
          const isCandidate = (typeof data === 'object' && data.candidate) || dataStr.includes('"candidate"') || dataStr.includes('candidate=')
          
          // Log the signal structure for debugging (only first few to avoid spam)
          if (signalCount <= 3) {
            console.log(`[VideoChat] Signal #${signalCount}:`, {
              type: typeof data === 'object' ? data.type : 'unknown',
              hasSdp: isSdp,
              hasCandidate: isCandidate,
              isString: typeof data === 'string',
              length: dataStr.length
            })
          }
          
          // Determine if this is offer/answer (SDP) or ICE candidate
          if (isSdp && !isCandidate) {
            // This is an offer/answer (has SDP, not a candidate)
            // Check if we've already sent this exact offer/answer (using refs for persistence)
            const currentDataStr = dataStr
            const isDuplicate = (initiator && lastSentOffer === currentDataStr) || (!initiator && lastSentAnswer === currentDataStr)
            
            if (isDuplicate) {
              if (signalCount <= 3) {
                console.log('[VideoChat] ⚠️ Duplicate offer/answer detected, ignoring')
              }
              return // Skip duplicate
            }
            
            if (initiator && !offerSentRef.current) {
              offerSentRef.current = true
              lastSentOffer = currentDataStr
              console.log('[VideoChat] 📤 Sending initial offer (SDP) to:', matchSocketId)
              socket.emit('offer', { offer: data, to: matchSocketId })
            } else if (!initiator && !answerSentRef.current) {
              answerSentRef.current = true
              lastSentAnswer = currentDataStr
              console.log('[VideoChat] 📤 Sending initial answer (SDP) to:', matchSocketId)
              socket.emit('answer', { answer: data, to: matchSocketId })
            } else {
              // Already sent, ignore duplicate
              if (signalCount <= 3) {
                console.log('[VideoChat] ⚠️ Offer/answer already sent, ignoring')
              }
            }
          } else if (isCandidate) {
            // This is an ICE candidate
            if (offerSentRef.current || answerSentRef.current) {
              // Only send ICE candidates after offer/answer is sent
              if (signalCount <= 5) {
                console.log('[VideoChat] 📤 Sending ICE candidate to:', matchSocketId)
              }
              socket.emit('ice-candidate', { candidate: data, to: matchSocketId })
            } else {
              // Wait for offer/answer to be sent first
              if (signalCount <= 3) {
                console.log('[VideoChat] ⚠️ ICE candidate received before offer/answer, queuing...')
              }
            }
          } else {
            // Unknown signal type - use heuristics
            // First signal is usually offer/answer, subsequent are candidates
            if (signalCount === 1) {
              // First signal - likely offer/answer
              // Check for duplicate
              const currentDataStr = dataStr
              const isDuplicate = (initiator && lastSentOffer === currentDataStr) || (!initiator && lastSentAnswer === currentDataStr)
              
              if (!isDuplicate && dataStr.length > 100) {
                if (initiator && !offerSentRef.current) {
                  offerSentRef.current = true
                  lastSentOffer = currentDataStr
                  console.log('[VideoChat] 📤 Sending offer (first signal, large payload) to:', matchSocketId)
                  socket.emit('offer', { offer: data, to: matchSocketId })
                } else if (!initiator && !answerSentRef.current) {
                  answerSentRef.current = true
                  lastSentAnswer = currentDataStr
                  console.log('[VideoChat] 📤 Sending answer (first signal, large payload) to:', matchSocketId)
                  socket.emit('answer', { answer: data, to: matchSocketId })
                }
              }
            } else if (signalCount > 1 && (offerSentRef.current || answerSentRef.current)) {
              // Subsequent signals after offer/answer - likely ICE candidates
              if (signalCount <= 5) {
                console.log('[VideoChat] 📤 Sending ICE candidate (subsequent signal) to:', matchSocketId)
              }
              socket.emit('ice-candidate', { candidate: data, to: matchSocketId })
            }
          }
        })

        peer.on('stream', (stream) => {
          // Prevent duplicate stream handling (using ref for persistence)
          if (streamReceivedRef.current) {
            console.log('[VideoChat] ⚠️ Duplicate stream event ignored')
            return
          }
          streamReceivedRef.current = true
          
          console.log('[VideoChat] ✅ Remote stream received!', {
            hasVideo: stream.getVideoTracks().length > 0,
            hasAudio: stream.getAudioTracks().length > 0,
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length,
            streamId: stream.id,
            active: stream.active
          })
          
            remoteStreamRef.current = stream // Store in ref for cleanup
            setRemoteStream(stream)
            
            // Notify parent component about stream creation
            if (onStreamCreated) {
              onStreamCreated(stream)
            }
            
            setIsConnecting(false)
          
          // Use requestAnimationFrame to ensure video element is mounted
          const setStreamToVideo = () => {
            if (remoteVideoRef.current) {
              console.log('[VideoChat] Setting remote stream to video element')
              remoteVideoRef.current.srcObject = stream
              
              // Ensure audio is enabled and playing
              remoteVideoRef.current.muted = false
              remoteVideoRef.current.volume = 1.0
              
              // Force play (required by some browsers)
              remoteVideoRef.current.play()
                .then(() => {
                  console.log('[VideoChat] ✅ Remote video playing successfully')
                })
                .catch((err) => {
                  console.error('[VideoChat] ❌ Error playing remote video/audio:', err)
                  // Try again after a short delay
                  setTimeout(() => {
                    if (remoteVideoRef.current && remoteVideoRef.current.srcObject === stream) {
                      remoteVideoRef.current.play().catch(() => {
                        // Ignore retry errors
                      })
                    }
                  }, 500)
                })
            } else {
              // Retry after a short delay if element not ready
              setTimeout(setStreamToVideo, 50)
            }
          }
          
          // Use requestAnimationFrame for better timing
          requestAnimationFrame(() => {
            setStreamToVideo()
          })
        })

        peer.on('connect', () => {
          console.log('[VideoChat] ✅ Peer connection established')
          setIsConnecting(false)
        })

        peer.on('error', (err) => {
          console.error('[VideoChat] ❌ Peer connection error:', err)
          setIsConnecting(false)
        })
        
        peerRef.current = peer

        // Handle incoming signals
        // Track processed signals to prevent duplicates (using refs for persistence)
        socket.on('offer', (data: { offer: any; from: string }) => {
          // Only process if this is for the current match and peer exists
          if (data.from === matchSocketId && !initiator && peerRef.current && !offerReceivedRef.current) {
            offerReceivedRef.current = true
            try {
              if (typeof peerRef.current.signal === 'function') {
                console.log('[VideoChat] ✅ Signaling offer to peer (non-initiator)')
                peerRef.current.signal(data.offer)
              }
            } catch (error) {
              console.error('[VideoChat] ❌ Error signaling offer:', error)
            }
          }
        })

        socket.on('answer', (data: { answer: any; from: string }) => {
          // Only process if this is for the current match and peer exists
          if (data.from === matchSocketId && initiator && peerRef.current && !answerReceivedRef.current) {
            answerReceivedRef.current = true
            try {
              if (typeof peerRef.current.signal === 'function') {
                console.log('[VideoChat] ✅ Signaling answer to peer (initiator)')
                peerRef.current.signal(data.answer)
              }
            } catch (error) {
              console.error('[VideoChat] ❌ Error signaling answer:', error)
            }
          }
        })

        socket.on('ice-candidate', (data: { candidate: any; from: string }) => {
          // Only process if this is for the current match and peer exists
          if (data.from === matchSocketId && peerRef.current) {
            try {
              // Check if peer is still valid (not destroyed)
              // SimplePeer doesn't expose destroyed flag, so we check if it has the signal method
              if (typeof peerRef.current.signal === 'function') {
                // Try to signal, but catch errors silently if peer is destroyed
                try {
                  peerRef.current.signal(data.candidate)
                } catch (signalError: any) {
                  // Only log if it's not a "destroyed" error
                  if (!signalError?.message?.includes('destroyed')) {
                    console.warn('[VideoChat] Error signaling ICE candidate:', signalError)
                  }
                }
              }
            } catch (error) {
              // Silently ignore - peer might be destroyed
            }
          }
        })

        // Handle peer audio/video toggle notifications
        socket.on('peer-audio-toggle', (data: { enabled: boolean }) => {
          setRemoteAudioEnabled(data.enabled)
          console.log('Peer audio:', data.enabled ? 'enabled' : 'disabled')
        })

        socket.on('peer-video-toggle', (data: { enabled: boolean }) => {
          console.log('Peer video:', data.enabled ? 'enabled' : 'disabled')
        })
      })
      .catch((error) => {
        console.error('Error accessing media devices:', error)
        setIsConnecting(false)
        
        // Provide user-friendly error messages
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setConnectionError('Microphone/Camera permission denied. Please allow access and try again.')
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          setConnectionError('No camera/microphone found. Please connect a device and try again.')
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          setConnectionError('Camera/Microphone is being used by another application.')
        } else {
          setConnectionError('Failed to access camera/microphone. Please check your device settings.')
        }
      })

    return () => {
      // Prevent multiple cleanups from running
      if (cleanupRunRef.current) {
        return // Silently skip if already cleaned up
      }
      cleanupRunRef.current = true
      
      // Only log in development, and reduce noise
      if (process.env.NODE_ENV === 'development') {
        console.log('[VideoChat] Cleanup: Stopping all media tracks')
      }
      
      // Clean up socket listeners FIRST to prevent new streams from being created
      socket.off('offer')
      socket.off('answer')
      socket.off('ice-candidate')
      socket.off('peer-audio-toggle')
      socket.off('peer-video-toggle')
      
      // CRITICAL: Stop ALL media tracks (both local and remote)
      // Use refs to access latest streams (avoid stale closures)
      const currentLocalStream = localStreamRef.current
      const currentRemoteStream = remoteStreamRef.current
      
      // Stop local stream tracks IMMEDIATELY
      if (currentLocalStream) {
        // Notify parent about stream destruction
        if (onStreamDestroyed) {
          onStreamDestroyed(currentLocalStream)
        }
        
        currentLocalStream.getTracks().forEach((track) => {
          try {
            if (track.readyState === 'live') {
              track.stop()
              console.log('[VideoChat] Cleanup: Stopped local track:', track.kind, track.id)
            }
          } catch (e) {
            // Ignore errors - track might already be stopped
          }
        })
        localStreamRef.current = null
        setLocalStream(null)
      }

      // Stop remote stream tracks if it exists
      if (currentRemoteStream) {
        // Notify parent about stream destruction
        if (onStreamDestroyed) {
          onStreamDestroyed(currentRemoteStream)
        }
        
        currentRemoteStream.getTracks().forEach((track) => {
          try {
            if (track.readyState === 'live') {
              track.stop()
              console.log('[VideoChat] Cleanup: Stopped remote track:', track.kind, track.id)
            }
          } catch (e) {
            // Ignore errors
          }
        })
        remoteStreamRef.current = null
        setRemoteStream(null)
      }
      
      // Also stop any tracks that might be on video elements
      // Do this SYNCHRONOUSLY to ensure tracks are stopped immediately
      // Use refs copied at the start of the effect to avoid stale closures
      if (currentLocalVideoRef) {
        try {
          if (currentLocalVideoRef.srcObject) {
            const mediaStream = currentLocalVideoRef.srcObject as MediaStream
            mediaStream.getTracks().forEach((track) => {
              try {
                if (track.readyState === 'live') {
                  track.stop()
                }
              } catch (e) {
                // Ignore errors - track might already be stopped
              }
            })
            currentLocalVideoRef.srcObject = null
            currentLocalVideoRef.load() // Reset video element
          }
        } catch (e) {
          // Ignore errors
        }
      }

      if (currentRemoteVideoRef) {
        try {
          if (currentRemoteVideoRef.srcObject) {
            const mediaStream = currentRemoteVideoRef.srcObject as MediaStream
            mediaStream.getTracks().forEach((track) => {
              try {
                if (track.readyState === 'live') {
                  track.stop()
                }
              } catch (e) {
                // Ignore errors
              }
            })
            currentRemoteVideoRef.srcObject = null
            currentRemoteVideoRef.load() // Reset video element
          }
        } catch (e) {
          // Ignore errors
        }
      }
      
      // Destroy peer connection
      if (peerRef.current) {
        try {
          peerRef.current.destroy()
        } catch (error) {
          // Silently handle errors
        }
        peerRef.current = null
      }
      
      // Reset state (but don't cause re-renders that trigger more cleanups)
      // Use setTimeout to avoid state updates during cleanup
      setTimeout(() => {
        setIsConnecting(false)
        setVideoEnabled(true)
        setAudioEnabled(true)
        setRemoteAudioEnabled(true)
        setConnectionError(null)
      }, 0)
    }
  }, [matchSocketId, socket, onStreamCreated, onStreamDestroyed])

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoEnabled
        setVideoEnabled(!videoEnabled)
        socket.emit('video-toggle', { enabled: !videoEnabled })
      }
    }
  }

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0]
      if (audioTrack) {
        const newState = !audioEnabled
        audioTrack.enabled = newState
        setAudioEnabled(newState)
        
        // Notify peer about audio state change
        socket.emit('audio-toggle', { 
          enabled: newState,
          to: matchSocketId 
        })
        
        // Update UI feedback
        if (!newState) {
          console.log('Microphone muted')
        } else {
          console.log('Microphone unmuted')
        }
      }
    }
  }

  return (
    <div className="relative w-full h-full bg-cyberpunk-dark overflow-hidden">
      {/* Two Video Boxes Stacked Vertically - Stranger on Top, You on Bottom */}
      <div className="flex flex-col gap-3 h-full p-3">
        {/* Top Box: Remote User Video (Stranger) */}
        <div className="relative bg-cyberpunk-gray/30 rounded-xl overflow-hidden border-2 border-cyberpunk-blue/40 flex-1 min-h-0">
          <div className="absolute top-2 left-2 z-10 px-2.5 py-1 bg-cyberpunk-blue/80 rounded-lg text-xs font-bold text-white backdrop-blur-sm border border-cyberpunk-blue/50">
            Stranger
          </div>
          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              muted={false}
              className="w-full h-full object-cover"
              onLoadedMetadata={() => {
                console.log('[VideoChat] Remote video metadata loaded')
                if (remoteVideoRef.current) {
                  remoteVideoRef.current.play()
                    .then(() => {
                      console.log('[VideoChat] ✅ Remote video playing (onLoadedMetadata)')
                    })
                    .catch((err) => {
                      console.error('[VideoChat] ❌ Error playing remote video (onLoadedMetadata):', err)
                    })
                }
              }}
              onCanPlay={() => {
                console.log('[VideoChat] Remote video can play')
                if (remoteVideoRef.current) {
                  remoteVideoRef.current.play().catch((err) => {
                    console.error('[VideoChat] Error playing (onCanPlay):', err)
                  })
                }
              }}
              onPlay={() => {
                console.log('[VideoChat] ✅ Remote video is playing!')
              }}
              onError={(e) => {
                console.error('[VideoChat] ❌ Video element error:', e)
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyberpunk-purple/20 to-cyberpunk-blue/20">
              {isConnecting ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="w-16 h-16 border-4 border-cyberpunk-blue border-t-transparent rounded-full mx-auto mb-3"
                  />
                  <p className="text-cyberpunk-blue font-medium text-sm">Connecting...</p>
                </motion.div>
              ) : connectionError ? (
                <div className="text-center p-2">
                  <div className="text-4xl mb-2">⚠️</div>
                  <p className="text-red-400 font-medium text-xs mb-1">Error</p>
                  <p className="text-gray-400 text-xs">{connectionError}</p>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-5xl mb-2">👤</div>
                  <p className="text-xs text-gray-400">Waiting for stranger...</p>
                </div>
              )}
            </div>
          )}
          {!remoteAudioEnabled && remoteStream && (
            <div className="absolute bottom-2 left-2 px-2 py-1 bg-yellow-500/80 border border-yellow-500/50 rounded text-xs text-yellow-200 backdrop-blur-sm z-10">
              🎤 Muted
            </div>
          )}
        </div>

        {/* Bottom Box: Local User Video (You) */}
        <div className="relative bg-cyberpunk-gray/30 rounded-xl overflow-hidden border-2 border-cyberpunk-purple/40 flex-1 min-h-0">
          <div className="absolute top-2 left-2 z-10 px-2.5 py-1 bg-cyberpunk-purple/80 rounded-lg text-xs font-bold text-white backdrop-blur-sm border border-cyberpunk-purple/50">
            You
          </div>
          {localStream ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyberpunk-purple/20 to-cyberpunk-blue/20">
              {isConnecting ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="w-16 h-16 border-4 border-cyberpunk-purple border-t-transparent rounded-full"
                />
              ) : (
                <div className="text-center">
                  <div className="text-5xl mb-2">📹</div>
                  <p className="text-xs text-gray-400">Your camera</p>
                </div>
              )}
            </div>
          )}
          {!videoEnabled && localStream && (
            <div className="absolute inset-0 bg-cyberpunk-dark/80 flex items-center justify-center z-10">
              <span className="text-4xl">📹</span>
            </div>
          )}
        </div>
      </div>

      {/* Video Controls - Bottom Center - Using Website Theme */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-3 z-20">
        <motion.button
          onClick={toggleVideo}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className={`p-3 rounded-full glass-effect border-2 ${
            videoEnabled
              ? 'border-cyberpunk-green bg-cyberpunk-green/20 hover:bg-cyberpunk-green/30'
              : 'border-red-500 bg-red-500/50 hover:bg-red-500/60'
          } transition-all`}
          title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          <span className="text-xl">{videoEnabled ? '📹' : '📹❌'}</span>
        </motion.button>
        <motion.button
          onClick={toggleAudio}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className={`p-3 rounded-full glass-effect border-2 ${
            audioEnabled
              ? 'border-cyberpunk-blue bg-cyberpunk-blue/20 hover:bg-cyberpunk-blue/30'
              : 'border-red-500 bg-red-500/50 hover:bg-red-500/60'
          } transition-all relative`}
          title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
        >
          <span className="text-xl">{audioEnabled ? '🎤' : '🎤❌'}</span>
          {!audioEnabled && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-cyberpunk-dark"></span>
          )}
        </motion.button>
      </div>
    </div>
  )
}

// Memoize component to prevent unnecessary re-renders
export default memo(VideoChat)
