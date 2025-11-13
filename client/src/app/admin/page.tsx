'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/useAuthStore'
import axios from 'axios'
import { motion } from 'framer-motion'
import Link from 'next/link'

export default function AdminPage() {
  const { user, setAuth, _hasHydrated } = useAuthStore()
  const router = useRouter()
  const [analytics, setAnalytics] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

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

    // Check if user is admin (simplified - should check server-side)
    if (user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
      router.push('/')
      return
    }

    loadData()
  }, [_hasHydrated, user, router, setAuth])

  const loadData = async () => {
    try {
      const token = localStorage.getItem('token')
      const [analyticsRes, usersRes] = await Promise.all([
        axios.get(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/admin/analytics`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/admin/users`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])
      setAnalytics(analyticsRes.data)
      setUsers(usersRes.data)
    } catch (error) {
      console.error('Failed to load admin data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = users.filter((u: any) =>
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading || !analytics) {
    return (
      <div className="min-h-screen bg-cyberpunk-darker flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyberpunk-purple/10 rounded-full blur-3xl"></div>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 text-center"
        >
          <div className="w-16 h-16 border-4 border-cyberpunk-purple border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-cyberpunk-purple text-lg">Loading admin data...</p>
        </motion.div>
      </div>
    )
  }

  const stats = [
    { label: 'Total Users', value: analytics.totalUsers, icon: '👥', color: 'purple', gradient: 'from-cyberpunk-purple/20 to-cyberpunk-purple/5' },
    { label: 'Free Users', value: analytics.freeUsers, icon: '🆓', color: 'blue', gradient: 'from-cyberpunk-blue/20 to-cyberpunk-blue/5' },
    { label: 'Premium Users', value: analytics.premiumUsers, icon: '💎', color: 'green', gradient: 'from-cyberpunk-green/20 to-cyberpunk-green/5' },
    { label: 'Pro Users', value: analytics.proUsers, icon: '⭐', color: 'pink', gradient: 'from-cyberpunk-pink/20 to-cyberpunk-pink/5' },
  ]

  return (
    <div className="min-h-screen bg-cyberpunk-darker py-8 px-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyberpunk-purple/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyberpunk-blue/10 rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto px-4 py-4 relative z-10 max-w-7xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gradient mb-1">Admin Dashboard</h1>
            <p className="text-gray-400 text-sm">Manage users and view analytics</p>
          </div>
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
        </div>

        {/* Analytics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {stats.map((stat, idx) => {
            const colorMap: { [key: string]: string } = {
              purple: 'text-cyberpunk-purple',
              blue: 'text-cyberpunk-blue',
              green: 'text-cyberpunk-green',
              pink: 'text-cyberpunk-pink',
            }
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ y: -2, scale: 1.02 }}
                className={`cyberpunk-card p-4 relative overflow-hidden bg-gradient-to-br ${stat.gradient}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{stat.icon}</span>
                </div>
                <h3 className="text-xs text-gray-400 mb-1">{stat.label}</h3>
                <p className={`text-xl font-bold ${colorMap[stat.color]}`}>
                  {stat.value.toLocaleString()}
                </p>
              </motion.div>
            )
          })}
        </div>

        {/* Users Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="cyberpunk-card p-4"
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3">
            <h2 className="text-lg font-bold text-gradient">Users Management</h2>
            <div className="w-full md:w-auto">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="cyberpunk-input w-full md:w-64 text-sm"
                placeholder="Search users..."
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-cyberpunk-purple/30">
                  <th className="text-left p-2 text-xs font-bold text-gray-300">Email</th>
                  <th className="text-left p-2 text-xs font-bold text-gray-300">Username</th>
                  <th className="text-left p-2 text-xs font-bold text-gray-300">Tier</th>
                  <th className="text-left p-2 text-xs font-bold text-gray-300">Coins</th>
                  <th className="text-left p-2 text-xs font-bold text-gray-300">Level</th>
                  <th className="text-left p-2 text-xs font-bold text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-gray-400 text-sm">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u: any, idx: number) => (
                    <motion.tr
                      key={u._id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + idx * 0.05 }}
                      whileHover={{ backgroundColor: 'rgba(139, 92, 246, 0.1)' }}
                      className="border-b border-cyberpunk-purple/10 hover:bg-cyberpunk-purple/5 transition-colors"
                    >
                      <td className="p-2 text-gray-300 text-xs">{u.email}</td>
                      <td className="p-2 text-gray-300 text-xs">{u.username}</td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          u.tier === 'pro' ? 'bg-cyberpunk-pink/30 text-cyberpunk-pink' :
                          u.tier === 'premium' ? 'bg-cyberpunk-blue/30 text-cyberpunk-blue' :
                          'bg-cyberpunk-gray/50 text-gray-300'
                        }`}>
                          {u.tier?.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-2 text-gray-300 text-xs">{u.coins?.toLocaleString() || 0} 🪙</td>
                      <td className="p-2 text-gray-300 text-xs">Lv.{u.level || 1}</td>
                      <td className="p-2">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors"
                        >
                          Ban
                        </motion.button>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredUsers.length > 0 && (
            <div className="mt-3 text-xs text-gray-400 text-center">
              Showing {filteredUsers.length} of {users.length} users
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
