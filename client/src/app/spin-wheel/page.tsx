'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/useAuthStore'
import { gamificationAPI } from '@/lib/api'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function SpinWheelPage() {
  const { user, setAuth, updateUser, _hasHydrated } = useAuthStore()
  const router = useRouter()
  const [spinning, setSpinning] = useState(false)
  const [reward, setReward] = useState<any>(null)
  const [rotation, setRotation] = useState(0)

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
  }, [_hasHydrated, user, router, setAuth])

  const handleSpin = async () => {
    if (!user || user.coins < 50) {
      toast.error('Not enough coins! Need 50 coins to spin.')
      return
    }

    setSpinning(true)
    setReward(null)
    
    // Animate rotation
    const spins = 5 + Math.random() * 3 // 5-8 full rotations
    const finalRotation = rotation + (spins * 360) + (Math.random() * 360)
    setRotation(finalRotation)

    try {
      const result = await gamificationAPI.spinWheel()
      setReward(result.reward)
      updateUser({ coins: result.coins, xp: result.xp })
      
      // Show reward after animation
      setTimeout(() => {
        toast.success(`🎉 You won: ${result.reward.amount} ${result.reward.type}!`, {
          duration: 5000,
          icon: '🎁',
        })
      }, 3000)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to spin wheel')
      setSpinning(false)
    } finally {
      setTimeout(() => {
        setSpinning(false)
      }, 3000)
    }
  }

  const rewards = [
    { name: '50-200 Coins', emoji: '🪙', color: 'from-yellow-500/20 to-yellow-600/20' },
    { name: '50 XP', emoji: '⭐', color: 'from-cyberpunk-purple/20 to-cyberpunk-blue/20' },
    { name: '5 Free Skips', emoji: '⏭️', color: 'from-cyberpunk-green/20 to-cyberpunk-blue/20' },
    { name: '24h Premium', emoji: '💎', color: 'from-cyberpunk-pink/20 to-cyberpunk-purple/20' },
  ]

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
    <div className="min-h-screen bg-cyberpunk-darker relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyberpunk-purple/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyberpunk-blue/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="container mx-auto px-4 py-4 relative z-10 max-w-6xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <Link href="/dashboard">
            <motion.button
              whileHover={{ scale: 1.05, x: -5 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
            >
              <span>←</span>
              <span>Back to Dashboard</span>
            </motion.button>
          </Link>
          <div className="text-sm text-gray-400">Welcome, {user.username}</div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Wheel Section */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="lg:col-span-2"
          >
            <div className="cyberpunk-card p-6 text-center">
              {/* Wheel Visual */}
              <div className="relative mb-6">
                <motion.div
                  className="w-48 h-48 mx-auto relative"
                  animate={{ rotate: spinning ? rotation : 0 }}
                  transition={{ duration: spinning ? 3 : 0, ease: 'easeOut' }}
                >
                  <div className="absolute inset-0 rounded-full border-4 border-cyberpunk-purple bg-gradient-to-br from-cyberpunk-purple/20 to-cyberpunk-blue/20 flex items-center justify-center">
                    <div className="text-5xl">🎡</div>
                  </div>
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-8 border-transparent border-t-cyberpunk-purple"></div>
                </motion.div>
              </div>

              {/* Cost and Balance */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="glass-effect p-3 rounded-lg">
                  <p className="text-xs text-gray-400 mb-1">Cost</p>
                  <p className="text-lg font-bold text-gradient">50 🪙</p>
                </div>
                <div className="glass-effect p-3 rounded-lg">
                  <p className="text-xs text-gray-400 mb-1">Your Balance</p>
                  <p className={`text-lg font-bold ${user.coins >= 50 ? 'text-cyberpunk-green' : 'text-red-400'}`}>
                    {user.coins} 🪙
                  </p>
                </div>
              </div>

              {/* Spin Button */}
              <motion.button
                onClick={handleSpin}
                disabled={spinning || user.coins < 50}
                whileHover={{ scale: user.coins >= 50 && !spinning ? 1.05 : 1 }}
                whileTap={{ scale: 0.95 }}
                className="cyberpunk-button px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {spinning ? (
                  <span className="flex items-center gap-2">
                    <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                      🎡
                    </motion.span>
                    Spinning...
                  </span>
                ) : (
                  'Spin Now!'
                )}
              </motion.button>

              {/* Reward Display */}
              <AnimatePresence>
                {reward && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="mt-4 p-4 bg-cyberpunk-green/20 border border-cyberpunk-green rounded-lg"
                  >
                    <p className="text-lg font-bold text-cyberpunk-green mb-1">
                      🎉 You won: {reward.amount} {reward.type}!
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Right: Rewards Info */}
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="cyberpunk-card p-4"
            >
              <h3 className="text-sm font-bold text-gradient mb-3">Possible Rewards</h3>
              <div className="space-y-2">
                {rewards.map((reward, idx) => (
                  <div
                    key={reward.name}
                    className={`glass-effect p-3 rounded-lg bg-gradient-to-br ${reward.color} text-sm`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{reward.emoji}</span>
                      <span className="text-gray-300">{reward.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <div className="cyberpunk-card p-4">
              <p className="text-xs text-gray-400 text-center">
                💡 Spin once per day for the best rewards!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
