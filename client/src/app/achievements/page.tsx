'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/useAuthStore'
import { userAPI } from '@/lib/api'
import { motion } from 'framer-motion'
import ProfileLayout from '@/components/ProfileLayout'

export default function AchievementsPage() {
  const { user, setAuth, _hasHydrated } = useAuthStore()
  const router = useRouter()

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

  const achievements = [
    {
      id: 'first-steps',
      icon: '⚡',
      title: 'First Steps',
      description: 'Created your account',
      status: 'completed',
      progress: null,
    },
    {
      id: 'streak-master',
      icon: '🔥',
      title: 'Streak Master',
      description: `Login for ${user?.streak || 0} consecutive days`,
      status: 'in-progress',
      progress: { current: user?.streak || 0, target: 7 },
    },
    {
      id: 'chat-champion',
      icon: '💬',
      title: 'Chat Champion',
      description: 'Complete 10 chat sessions',
      status: 'in-progress',
      progress: { current: 0, target: 10 },
    },
    {
      id: 'premium-explorer',
      icon: '💎',
      title: 'Premium Explorer',
      description: 'Upgrade to Premium or Pro',
      status: user?.tier !== 'free' ? 'completed' : 'locked',
      progress: null,
    },
    {
      id: 'level-up',
      icon: '⭐',
      title: 'Level Up',
      description: 'Reach Level 10',
      status: 'in-progress',
      progress: { current: user?.level || 1, target: 10 },
    },
  ]

  const getStatusBadge = (status: string, progress: { current: number; target: number } | null) => {
    if (status === 'completed') {
      return (
        <span className="px-3 py-1 bg-cyberpunk-green/20 border border-cyberpunk-green rounded-full text-xs font-bold text-cyberpunk-green">
          Completed
        </span>
      )
    }
    if (status === 'locked') {
      return (
        <span className="px-3 py-1 bg-cyberpunk-gray/50 border border-cyberpunk-gray rounded-full text-xs font-bold text-gray-500">
          Locked
        </span>
      )
    }
    if (progress) {
      return (
        <span className="text-xs text-gray-400 font-medium">
          {progress.current}/{progress.target}
        </span>
      )
    }
    return null
  }

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
    <ProfileLayout activeTab="achievements">
      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 mb-6"
      >
        <span className="text-2xl">🏆</span>
        <h2 className="text-xl font-bold text-gradient">Achievements & Progress</h2>
      </motion.div>

      {/* Achievement Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {achievements.map((achievement, idx) => (
          <motion.div
            key={achievement.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            whileHover={{ y: -2, scale: 1.01 }}
            className={`cyberpunk-card p-4 ${
              achievement.status === 'locked' ? 'opacity-60' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                <div className="text-3xl">{achievement.icon}</div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-white mb-1">{achievement.title}</h3>
                  <p className="text-xs text-gray-400">{achievement.description}</p>
                </div>
              </div>
              <div className="flex-shrink-0">
                {getStatusBadge(achievement.status, achievement.progress)}
              </div>
            </div>
          </motion.div>
        ))}

        {/* Achievement Progress Card (Large) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="md:col-span-2 cyberpunk-card p-6 text-center"
        >
          <div className="text-5xl mb-4">🏆</div>
          <h3 className="text-lg font-bold text-gradient mb-2">Achievement Progress</h3>
          <p className="text-sm text-gray-400">
            Complete more activities to unlock achievements and earn rewards!
          </p>
        </motion.div>
      </div>
    </ProfileLayout>
  )
}

