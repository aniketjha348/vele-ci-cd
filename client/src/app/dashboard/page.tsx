'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/useAuthStore'
import { userAPI, gamificationAPI } from '@/lib/api'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import LoadingSkeleton from '@/components/LoadingSkeleton'

export default function DashboardPage() {
  const { user, setAuth, logout, updateUser, _hasHydrated } = useAuthStore()
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()

  // Memoized calculations
  const currentLevel = useMemo(() => stats?.level || user?.level || 1, [stats, user])
  const currentXP = useMemo(() => stats?.xp || user?.xp || 0, [stats, user])
  const xpForNextLevel = useMemo(() => currentLevel * 1000, [currentLevel])
  const xpProgress = useMemo(() => Math.min((currentXP / xpForNextLevel) * 100, 100), [currentXP, xpForNextLevel])

  // Track if streak has been updated today to avoid multiple calls
  const streakUpdatedRef = useRef(false)
  const lastStreakUpdateRef = useRef<string | null>(null)
  const loadingRef = useRef(false) // Prevent concurrent loads
  const mountedRef = useRef(true)
  const loadDataRef = useRef<((showLoading?: boolean, retryCount?: number, updateStreak?: boolean) => Promise<void>) | null>(null)
  const initialLoadDoneRef = useRef(false) // Track if initial load has been done

  // Load data function with retry logic
  const loadData = useCallback(async (showLoading = true, retryCount = 0, updateStreak = false) => {
    // Prevent concurrent loads
    if (loadingRef.current && !showLoading) {
      return
    }
    
    if (!mountedRef.current) return
    
    loadingRef.current = true
    if (showLoading) setLoading(true)
    else setRefreshing(true)
    
    setError(null)
    try {
      const today = new Date().toDateString()
      const shouldUpdateStreak = updateStreak && (!streakUpdatedRef.current || lastStreakUpdateRef.current !== today)
      
      const promises = [gamificationAPI.getStats()]
      if (shouldUpdateStreak) {
        promises.push(gamificationAPI.updateStreak().catch(() => {}))
        streakUpdatedRef.current = true
        lastStreakUpdateRef.current = today
      }
      
      const [statsData] = await Promise.all(promises)
      
      if (!mountedRef.current) return
      
      setStats(statsData)
      if (statsData) {
        updateUser({
          xp: statsData.xp,
          level: statsData.level,
          coins: statsData.coins,
          streak: statsData.streak,
        })
      }
    } catch (err: any) {
      if (!mountedRef.current) return
      
      if (err.response?.status === 429 && retryCount < 2) {
        const delay = Math.pow(2, retryCount) * 1000
        console.warn(`Rate limited, retrying in ${delay}ms...`)
        loadingRef.current = false
        setTimeout(() => {
          if (mountedRef.current) {
            loadData(showLoading, retryCount + 1, false)
          }
        }, delay)
        return
      }
      
      console.error('Failed to load dashboard data:', err)
      const errorMsg = err.response?.status === 429 
        ? 'Too many requests. Please wait a moment.'
        : err.response?.data?.error || 'Failed to load dashboard'
      setError(errorMsg)
      
      if (err.response?.status !== 429) {
        toast.error(errorMsg)
      }
    } finally {
      loadingRef.current = false
      if (mountedRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [updateUser])

  // Store loadData in ref for stable reference
  useEffect(() => {
    loadDataRef.current = loadData
  }, [loadData])

  // Handle user authentication - separate from data loading
  useEffect(() => {
    if (!_hasHydrated) {
      return
    }

    const token = localStorage.getItem('token')
    if (!user && !token) {
      router.push('/')
      return
    }

    if (token && !user) {
      const restoreUser = async () => {
        try {
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
    }
  }, [_hasHydrated, user, router, setAuth])

  // Load data only once when user becomes available
  // Use a separate effect that only runs when user.id changes (not the whole user object)
  useEffect(() => {
    if (!_hasHydrated || !user?.id || initialLoadDoneRef.current) {
      return
    }

    // Set flag immediately to prevent multiple calls
    initialLoadDoneRef.current = true
    
    // Load data - use setTimeout to ensure loadData is available
    setTimeout(() => {
      if (loadDataRef.current && mountedRef.current) {
        loadDataRef.current(true, 0, true)
      }
    }, 0)
  }, [_hasHydrated, user?.id]) // Only depend on user.id to avoid re-runs when user object changes

  // Set up refresh interval separately to avoid re-creating on every render
  useEffect(() => {
    if (!user || !_hasHydrated) {
      return
    }

    // Refresh every 5 minutes (300000ms)
    const refreshInterval = setInterval(() => {
      if (mountedRef.current && !loadingRef.current && loadDataRef.current) {
        loadDataRef.current(false, 0, false)
      }
    }, 300000) // 5 minutes

    return () => {
      clearInterval(refreshInterval)
    }
  }, [user, _hasHydrated]) // Removed loadData from dependencies

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const handleRefresh = () => {
    loadData(false, 0, false)
    toast.success('Refreshed!', { duration: 2000 })
  }

  if (!_hasHydrated) {
    return <LoadingSkeleton />
  }

  if (!user) {
    return null
  }

  if (loading) {
    return <LoadingSkeleton />
  }

  return (
    <div className="min-h-screen bg-cyberpunk-darker relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyberpunk-purple/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyberpunk-blue/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Header Bar */}
      <nav className="glass-effect border-b border-cyberpunk-purple/30 sticky top-0 z-50 backdrop-blur-md">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyberpunk-purple rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 3L4 14h7v7l9-11h-7V3z" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-white">Vele</span>
              <span className="text-xs text-gray-400">Dashboard</span>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <Link href="/profile">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
              >
                <span className="text-lg">👤</span>
                <span className="text-sm font-medium">Profile</span>
              </motion.button>
            </Link>
            <motion.button
              onClick={() => {
                logout()
                router.push('/')
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
            >
              <span className="text-lg">🚪</span>
              <span className="text-sm font-medium">Logout</span>
            </motion.button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-6 max-w-7xl relative z-10">
        {/* Error State */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-4 cyberpunk-card bg-red-500/20 border-red-500/50"
            >
              <div className="flex justify-between items-center p-3">
                <p className="text-red-400 text-sm">{error}</p>
                <button
                  onClick={() => loadData(true, 0, false)}
                  className="text-red-400 hover:text-red-300 underline text-xs"
                >
                  Retry
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-4">
            {/* User Profile Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="cyberpunk-card p-4"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-cyberpunk-purple/20 rounded-lg flex flex-col items-center justify-center relative">
                  <svg className="w-6 h-6 text-cyberpunk-purple mb-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M13 3L4 14h7v7l9-11h-7V3z" />
                  </svg>
                  <div className="flex gap-1 mt-1">
                    <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                    <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                    <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                    <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-1">{user.username}</h3>
                  <div className="flex items-center gap-3 text-sm text-gray-400">
                    <span>Level {currentLevel}</span>
                    <span>🪙 {stats?.coins || user.coins || 0}</span>
                    <span>🔥 {stats?.streak || user.streak || 0} day streak</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400 mb-1">XP Progress</div>
                  <div className="w-32 h-2 bg-cyberpunk-gray/50 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-cyberpunk-blue rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${xpProgress}%` }}
                      transition={{ duration: 1 }}
                    />
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{currentXP}/{xpForNextLevel} XP</div>
                </div>
              </div>
            </motion.div>

            {/* Start Anonymous Chat Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="cyberpunk-card p-8 text-center"
            >
              <div className="flex justify-center mb-4">
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 bg-cyberpunk-purple/30 rounded-full flex items-center justify-center relative">
                      <div className="absolute left-2 top-1/2 -translate-y-1/2 w-5 h-7 bg-cyberpunk-purple rounded-t-full opacity-80"></div>
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-8 bg-cyberpunk-purple rounded-t-full z-10"></div>
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-7 bg-cyberpunk-purple rounded-t-full opacity-80"></div>
                    </div>
                  </div>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gradient mb-2">Start Anonymous Chat</h2>
              <p className="text-gray-400 text-sm mb-6">Connect with random strangers from around the world</p>
              <Link href="/chat">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="cyberpunk-button px-8 py-3 text-base font-bold flex items-center gap-2 mx-auto"
                >
                  🔍 Find Match
                </motion.button>
              </Link>
              <p className="text-xs text-gray-500 mt-4">Skips remaining today: 5</p>
            </motion.div>

            {/* Feature Cards */}
            <div className="grid grid-cols-3 gap-3">
              <Link href="/spin-wheel">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -2, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="cyberpunk-card p-4 text-center cursor-pointer bg-gradient-to-br from-cyberpunk-purple/20 to-cyberpunk-purple/5"
                >
                  <div className="text-3xl mb-2">🎮</div>
                  <h3 className="text-sm font-bold text-cyberpunk-purple mb-1">Mini Games</h3>
                  <p className="text-gray-300 text-xs">Play & Earn Coins</p>
                </motion.div>
              </Link>

              <Link href="/dashboard">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -2, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="cyberpunk-card p-4 text-center cursor-pointer bg-gradient-to-br from-yellow-500/20 to-yellow-600/20"
                >
                  <div className="text-3xl mb-2">🏆</div>
                  <h3 className="text-sm font-bold text-yellow-400 mb-1">Leaderboard</h3>
                  <p className="text-gray-300 text-xs">Top Players</p>
                </motion.div>
              </Link>

              <Link href="/subscription">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -2, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="cyberpunk-card p-4 text-center cursor-pointer bg-gradient-to-br from-cyberpunk-purple/20 to-cyberpunk-blue/20"
                >
                  <div className="text-3xl mb-2">👑</div>
                  <h3 className="text-sm font-bold text-cyberpunk-purple mb-1">Upgrade</h3>
                  <p className="text-gray-300 text-xs">Premium Features</p>
                </motion.div>
              </Link>
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-4">
            {/* XP Progress Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="cyberpunk-card p-4"
            >
              <h3 className="text-sm font-bold text-gradient mb-3">XP Progress</h3>
              <div className="w-full h-3 bg-cyberpunk-gray/50 rounded-full overflow-hidden mb-2">
                <motion.div
                  className="h-full bg-cyberpunk-blue rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${xpProgress}%` }}
                  transition={{ duration: 1 }}
                />
              </div>
              <div className="text-xs text-gray-400">{currentXP}/{xpForNextLevel} XP</div>
            </motion.div>

            {/* Your Stats Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="cyberpunk-card p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">⭐</span>
                <h3 className="text-sm font-bold text-gradient">Your Stats</h3>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Matches</span>
                  <span className="text-cyberpunk-blue font-bold">0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Games Played</span>
                  <span className="text-cyberpunk-blue font-bold">0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Win Rate</span>
                  <span className="text-cyberpunk-green font-bold">0%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Current Level</span>
                  <span className="text-cyberpunk-purple font-bold">Level {currentLevel}</span>
                </div>
              </div>
            </motion.div>

            {/* Free Plan Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="cyberpunk-card p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">👑</span>
                <h3 className="text-sm font-bold text-gradient">Free Plan</h3>
              </div>
              <p className="text-xs text-gray-400 mb-3">
                Upgrade for unlimited skips, HD video, and more features
              </p>
              {user.tier === 'free' ? (
                <Link href="/subscription">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="cyberpunk-button w-full text-xs py-2"
                  >
                    Upgrade Now
                  </motion.button>
                </Link>
              ) : (
                <div className="text-xs text-cyberpunk-green font-semibold text-center">
                  🎉 Premium Member
                </div>
              )}
            </motion.div>

            {/* Recent Activity Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="cyberpunk-card p-4"
            >
              <h3 className="text-sm font-bold text-gradient mb-3">Recent Activity</h3>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-cyberpunk-green rounded-full"></div>
                  <span className="text-gray-400">Logged in today</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-cyberpunk-blue rounded-full"></div>
                  <span className="text-gray-400">Earned 50 XP from daily login</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-cyberpunk-purple rounded-full"></div>
                  <span className="text-gray-400">Streak: {stats?.streak || user.streak || 0} days</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
