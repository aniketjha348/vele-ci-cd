'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/store/useAuthStore'
import { useMemo } from 'react'

interface ProfileLayoutProps {
  children: React.ReactNode
  activeTab: 'profile' | 'subscription' | 'achievements'
}

export default function ProfileLayout({ children, activeTab }: ProfileLayoutProps) {
  const { user } = useAuthStore()
  const pathname = usePathname()

  const currentLevel = useMemo(() => user?.level || 1, [user])
  const currentXP = useMemo(() => user?.xp || 0, [user])
  const xpForNextLevel = useMemo(() => currentLevel * 1000, [currentLevel])
  const xpProgress = useMemo(() => Math.min((currentXP / xpForNextLevel) * 100, 100), [currentXP, xpForNextLevel])

  const tabs = [
    { id: 'profile', label: 'Profile', icon: '👤', href: '/profile' },
    { id: 'subscription', label: 'Subscription', icon: '💎', href: '/subscription' },
    { id: 'achievements', label: 'Achievements', icon: '🏆', href: '/achievements' },
  ]

  if (!user) return null

  return (
    <div className="min-h-screen bg-cyberpunk-darker relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyberpunk-purple/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyberpunk-blue/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="container mx-auto px-4 py-6 relative z-10 max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center mb-6"
        >
          <Link href="/dashboard">
            <motion.button
              whileHover={{ scale: 1.05, x: -5 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <span>←</span>
              <span>Back to Dashboard</span>
            </motion.button>
          </Link>
          <div className="text-sm text-gray-400">Welcome, {user.username}</div>
        </motion.div>

        {/* User Profile Summary Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="cyberpunk-card p-4 mb-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-cyberpunk-purple/20 rounded-lg flex items-center justify-center text-3xl">
              👤
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white mb-1">{user.username}</h2>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span>⭐ Level {currentLevel}</span>
                <span>🪙 {user.coins || 0} coins</span>
                <span>🔥 {user.streak || 0} day streak</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400 mb-1">XP Progress</div>
              <div className="w-32 h-2 bg-cyberpunk-gray/50 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-cyberpunk-gradient rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${xpProgress}%` }}
                  transition={{ duration: 1 }}
                />
              </div>
              <div className="text-xs text-gray-400 mt-1">{currentXP}/{xpForNextLevel} XP</div>
            </div>
          </div>
        </motion.div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-6">
          {tabs.map((tab) => (
            <Link key={tab.id} href={tab.href}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all ${
                  activeTab === tab.id
                    ? 'bg-cyberpunk-purple text-white'
                    : 'bg-cyberpunk-gray/30 text-gray-400 hover:text-white'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </motion.button>
            </Link>
          ))}
        </div>

        {/* Page Content */}
        {children}
      </div>
    </div>
  )
}

