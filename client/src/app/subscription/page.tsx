'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/useAuthStore'
import { subscriptionAPI } from '@/lib/api'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import ProfileLayout from '@/components/ProfileLayout'
import { loadRazorpayScript, openRazorpayCheckout, RazorpayResponse } from '@/utils/razorpay'

export default function SubscriptionPage() {
  const { user, setAuth, updateUser, _hasHydrated } = useAuthStore()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [razorpayLoaded, setRazorpayLoaded] = useState(false)

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

  useEffect(() => {
    loadRazorpayScript()
      .then(() => {
        setRazorpayLoaded(true)
      })
      .catch((error) => {
        console.error('Failed to load Razorpay:', error)
        toast.error('Payment gateway unavailable. Please refresh the page.')
      })
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

  const handleSubscribe = async (tier: 'premium' | 'pro') => {
    if (!user) {
      router.push('/')
      return
    }

    if (!razorpayLoaded) {
      toast.error('Payment gateway is loading. Please wait...')
      return
    }

    setLoading(true)

    try {
      const orderData = await subscriptionAPI.create(tier)

      if (orderData.message && orderData.message.includes('development mode')) {
        updateUser({ tier })
        toast.success(`Successfully upgraded to ${tier}!`)
        router.push('/dashboard')
        setLoading(false)
        return
      }

      if (!orderData.orderId || !orderData.keyId) {
        toast.error('Payment gateway not properly configured. Please contact support.')
        setLoading(false)
        return
      }

      try {
        openRazorpayCheckout({
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency,
          name: 'Vele',
          description: `${tier.toUpperCase()} Subscription`,
          order_id: orderData.orderId,
          prefill: {
            name: user.username,
            email: user.email,
          },
          handler: async (response: RazorpayResponse) => {
            try {
              await subscriptionAPI.verify({
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                tier,
              })
              updateUser({ tier })
              toast.success(`Successfully upgraded to ${tier}! 🎉`)
              router.push('/dashboard')
            } catch (error: any) {
              toast.error(error.response?.data?.error || 'Payment verification failed')
            } finally {
              setLoading(false)
            }
          },
          modal: {
            ondismiss: () => {
              setLoading(false)
              toast.error('Payment cancelled')
            },
          },
        })
      } catch (razorpayError: any) {
        toast.error(razorpayError.message || 'Failed to open payment gateway')
        setLoading(false)
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to initiate payment')
      setLoading(false)
    }
  }

  if (!user) {
    router.push('/')
    return null
  }

  // Current Plan Overview
  const currentPlanData = {
    skips: user.tier === 'free' ? 5 : 'Unlimited',
    coins: user.coins || 0,
    status: 'Active',
  }

  const tiers = [
    {
      name: 'Free',
      price: '$0',
      priceDetail: '/forever',
      icon: '🆓',
      features: [
        '5 skips per day',
        'Anonymous chat & video',
        'Basic mini-games',
        'Daily coin rewards',
        'XP & leveling system',
      ],
      current: user.tier === 'free',
    },
    {
      name: 'Premium',
      price: '₹499',
      priceDetail: '/month',
      icon: '💎',
      features: [
        'Unlimited skips',
        'Region & gender filters',
        'HD video quality',
        'Private invite rooms',
        'Verified badge',
        'Priority support',
      ],
      current: user.tier === 'premium',
      popular: true,
    },
    {
      name: 'Pro',
      price: '₹999',
      priceDetail: '/month',
      icon: '⭐',
      features: [
        'Everything in Premium',
        'AI Mood Matching',
        'Real-time subtitles',
        'Priority matching',
        'Custom avatars',
        'Advanced analytics',
      ],
      current: user.tier === 'pro',
    },
  ]

  return (
    <ProfileLayout activeTab="subscription">
      {/* Current Plan Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="cyberpunk-card p-4 mb-6"
      >
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-xs text-gray-400 mb-1 flex items-center justify-center gap-1">
              <span>💎</span>
              <span>Current Plan: {user.tier.charAt(0).toUpperCase() + user.tier.slice(1)}</span>
            </div>
            <div className="text-2xl font-bold text-gradient">{currentPlanData.skips}</div>
            <div className="text-xs text-gray-400">Daily Skips Remaining</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gradient">{currentPlanData.coins}</div>
            <div className="text-xs text-gray-400">Coins Balance</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-cyberpunk-green">{currentPlanData.status}</div>
            <div className="text-xs text-gray-400">Account Status</div>
          </div>
        </div>
      </motion.div>

      {/* Subscription Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tiers.map((tier, idx) => (
          <motion.div
            key={tier.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            whileHover={{ y: -4, scale: 1.02 }}
            className={`cyberpunk-card p-5 relative overflow-hidden ${
              tier.current ? 'ring-2 ring-cyberpunk-green' : ''
            }`}
          >
            {/* Badges */}
            {tier.current && (
              <div className="absolute top-0 left-0 bg-cyberpunk-green/20 border-r border-b border-cyberpunk-green px-3 py-1 rounded-br-lg text-xs font-bold text-cyberpunk-green">
                ✓ Current
              </div>
            )}
            {tier.popular && !tier.current && (
              <div className="absolute top-0 right-0 bg-cyberpunk-purple/20 border-l border-b border-cyberpunk-purple px-3 py-1 rounded-bl-lg text-xs font-bold text-cyberpunk-purple">
                ⭐ Most Popular
              </div>
            )}

            <div className="text-center mb-4">
              <h3 className="text-2xl font-bold text-white mb-2">{tier.name}</h3>
              <div className="mb-2">
                <span className="text-3xl font-bold text-gradient">{tier.price}</span>
                <span className="text-sm text-gray-400 ml-1">{tier.priceDetail}</span>
              </div>
            </div>

            <ul className="space-y-2 mb-6 min-h-[200px]">
              {tier.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="text-cyberpunk-green mt-0.5">✓</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {tier.current ? (
              <motion.button
                disabled
                className="cyberpunk-button-secondary w-full opacity-50 cursor-not-allowed"
              >
                Current Plan
              </motion.button>
            ) : tier.name === 'Free' ? (
              <motion.button
                disabled
                className="cyberpunk-button-secondary w-full opacity-50 cursor-not-allowed"
              >
                Current Plan
              </motion.button>
            ) : (
              <motion.button
                onClick={() => handleSubscribe(tier.name.toLowerCase() as 'premium' | 'pro')}
                disabled={loading || !razorpayLoaded}
                whileHover={!loading && razorpayLoaded ? { scale: 1.05 } : {}}
                whileTap={!loading && razorpayLoaded ? { scale: 0.95 } : {}}
                className={`cyberpunk-button w-full ${
                  loading || !razorpayLoaded ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Processing...
                  </span>
                ) : !razorpayLoaded ? (
                  'Loading Payment...'
                ) : (
                  'Upgrade Now'
                )}
              </motion.button>
            )}
          </motion.div>
        ))}
      </div>
    </ProfileLayout>
  )
}
