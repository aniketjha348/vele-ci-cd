'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/useAuthStore'
import { userAPI } from '@/lib/api'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import ProfileLayout from '@/components/ProfileLayout'

export default function ProfilePage() {
  const { user, setAuth, updateUser, _hasHydrated } = useAuthStore()
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [showOnlineStatus, setShowOnlineStatus] = useState(true)
  const [autoMatch, setAutoMatch] = useState(false)
  const [notifications, setNotifications] = useState(true)

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

    loadProfile()
  }, [_hasHydrated, user, router, setAuth])

  const loadProfile = async () => {
    try {
      const data = await userAPI.getProfile()
      setProfile(data)
      setNickname(data.nickname || data.username || '')
      setEmail(data.email || '')
    } catch (error) {
      console.error('Failed to load profile:', error)
      toast.error('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      const updated = await userAPI.updateProfile({ nickname })
      setProfile(updated)
      updateUser({ ...updated })
      toast.success('Profile updated!')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update profile')
    }
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

  if (loading || !user || !profile) {
    return (
      <ProfileLayout activeTab="profile">
        <div className="flex items-center justify-center py-12">
          <div className="w-16 h-16 border-4 border-cyberpunk-purple border-t-transparent rounded-full animate-spin"></div>
        </div>
      </ProfileLayout>
    )
  }

  return (
    <ProfileLayout activeTab="profile">
      {/* Profile Settings Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="cyberpunk-card p-6"
      >
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xl">⚙️</span>
          <h3 className="text-lg font-bold text-gradient">Profile Settings</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column - User Identity */}
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nickname (Anonymous Identity)
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="cyberpunk-input w-full"
                placeholder="Choose a nickname"
                maxLength={20}
              />
              <p className="text-xs text-gray-500 mt-1">
                This is what other users will see (not your real name)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email (Private)
              </label>
              <input
                type="email"
                value={email}
                disabled
                className="cyberpunk-input w-full bg-cyberpunk-gray/30 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">
                Only used for account management, never shared
              </p>
            </div>
          </div>

          {/* Right Column - Privacy Settings */}
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-4">Privacy Settings</h4>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-300 mb-1">Show Online Status</div>
                    <div className="text-xs text-gray-500">Let others see when you&apos;re active</div>
                  </div>
                  <button
                    onClick={() => setShowOnlineStatus(!showOnlineStatus)}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      showOnlineStatus ? 'bg-cyberpunk-purple' : 'bg-cyberpunk-gray/50'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full transition-transform ${
                        showOnlineStatus ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-300 mb-1">Auto-Match</div>
                    <div className="text-xs text-gray-500">Automatically find matches when online</div>
                  </div>
                  <button
                    onClick={() => setAutoMatch(!autoMatch)}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      autoMatch ? 'bg-cyberpunk-purple' : 'bg-cyberpunk-gray/50'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full transition-transform ${
                        autoMatch ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-300 mb-1">Notifications</div>
                    <div className="text-xs text-gray-500">Receive match and message notifications</div>
                  </div>
                  <button
                    onClick={() => setNotifications(!notifications)}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      notifications ? 'bg-cyberpunk-purple' : 'bg-cyberpunk-gray/50'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full transition-transform ${
                        notifications ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <motion.button
          onClick={handleSave}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="cyberpunk-button mt-6 px-6 py-2"
        >
          Save Changes
        </motion.button>
      </motion.div>
    </ProfileLayout>
  )
}
