'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { authAPI } from '@/lib/api'
import { useAuthStore } from '@/store/useAuthStore'
import toast from 'react-hot-toast'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'login' | 'register'
  onSwitchMode: () => void
}

export default function AuthModal({ isOpen, onClose, mode, onSwitchMode }: AuthModalProps) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
  })
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { setAuth } = useAuthStore()

  // Reset form when mode changes
  useEffect(() => {
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      username: '',
    })
    setLoading(false)
  }, [mode])

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (mode === 'register') {
        if (formData.password !== formData.confirmPassword) {
          toast.error('Passwords do not match')
          setLoading(false)
          return
        }
        const response = await authAPI.register({
          email: formData.email,
          password: formData.password,
          username: formData.username,
        })
        setAuth(response.user, response.token)
        toast.success('Account created successfully!')
        // Reset form
        setFormData({
          email: '',
          password: '',
          confirmPassword: '',
          username: '',
        })
        onClose()
        router.push('/dashboard')
      } else {
        const response = await authAPI.login({
          email: formData.email,
          password: formData.password,
        })
        setAuth(response.user, response.token)
        toast.success('Welcome back!')
        // Reset form
        setFormData({
          email: '',
          password: '',
          confirmPassword: '',
          username: '',
        })
        onClose()
        router.push('/dashboard')
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || `${mode === 'register' ? 'Registration' : 'Login'} failed`)
      setLoading(false)
    }
  }

  const handleSwitchMode = () => {
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      username: '',
    })
    onSwitchMode()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="relative w-full max-w-md z-10 max-h-[90vh] flex"
        >
          <div className="cyberpunk-card p-4 md:p-5 relative overflow-hidden flex flex-col w-full max-h-[90vh]">
            {/* Close Button - Fixed */}
            <motion.button
              onClick={onClose}
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center text-gray-400 hover:text-white hover:bg-red-500/20 border border-red-500/30 rounded-lg transition-all z-30 flex-shrink-0"
              title="Close (Esc)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </motion.button>

            {/* Background Gradient */}
            <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl -mr-16 -mt-16 ${
              mode === 'login' ? 'bg-cyberpunk-purple/20' : 'bg-cyberpunk-green/20'
            }`}></div>

            <div className="relative z-10 flex flex-col flex-1 min-h-0">
              {/* Header - Fixed */}
              <div className="flex-shrink-0 mb-3 pb-2">
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <h1 className="text-xl md:text-2xl font-bold text-gradient mb-1 text-center">
                    {mode === 'login' ? 'Sign In' : 'Create Account'}
                  </h1>
                  <p className="text-xs md:text-sm text-gray-400 text-center">
                    {mode === 'login' ? 'Welcome back to Vele' : 'Join the future of connections'}
                  </p>
                </motion.div>
              </div>

              {/* Scrollable Form */}
              <div className="flex-1 overflow-y-auto pr-1 -mr-1 modal-scroll min-h-0">
                <motion.form
                  key={`form-${mode}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  onSubmit={handleSubmit}
                  className="space-y-3 pb-2"
                >
                  {mode === 'register' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <label className="block text-xs md:text-sm font-medium text-gray-300 mb-1.5">
                        Username
                      </label>
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        className="cyberpunk-input w-full py-2 text-sm"
                        placeholder="Choose a username"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-0.5">Only visible to you and admin</p>
                    </motion.div>
                  )}

                  <div>
                    <label className="block text-xs md:text-sm font-medium text-gray-300 mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="cyberpunk-input w-full py-2 text-sm"
                      placeholder="you@example.com"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs md:text-sm font-medium text-gray-300 mb-1.5">
                      Password
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="cyberpunk-input w-full py-2 text-sm"
                      placeholder="••••••••"
                      required
                    />
                  </div>

                  {mode === 'register' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <label className="block text-xs md:text-sm font-medium text-gray-300 mb-1.5">
                        Confirm Password
                      </label>
                      <input
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        className="cyberpunk-input w-full py-2 text-sm"
                        placeholder="••••••••"
                        required
                      />
                    </motion.div>
                  )}

                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: loading ? 1 : 1.02 }}
                    whileTap={{ scale: loading ? 1 : 0.98 }}
                    className="cyberpunk-button w-full py-2.5 disabled:opacity-50 mt-1 text-sm md:text-base"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        {mode === 'register' ? 'Creating account...' : 'Signing in...'}
                      </span>
                    ) : (
                      mode === 'register' ? 'Create Free Account' : 'Sign In'
                    )}
                  </motion.button>
                </motion.form>
              </div>

              {/* Footer - Fixed */}
              <div className="flex-shrink-0 mt-3 pt-3 border-t border-cyberpunk-purple/30 space-y-3">
                <div className="text-center">
                  <p className="text-xs md:text-sm text-gray-400">
                    {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                    <button
                      onClick={handleSwitchMode}
                      className="text-cyberpunk-purple hover:underline font-medium transition-all"
                    >
                      {mode === 'login' ? 'Create one' : 'Sign in'}
                    </button>
                  </p>
                </div>

                <div className="border-t border-cyberpunk-purple/30 pt-3">
                  <p className="text-center text-xs text-gray-400 mb-2">Or continue with</p>
                  <div className="flex gap-2">
                    <button className="flex-1 cyberpunk-button-secondary hover:bg-cyberpunk-lightGray transition-colors py-2 text-xs md:text-sm">
                      Google
                    </button>
                    <button className="flex-1 cyberpunk-button-secondary hover:bg-cyberpunk-lightGray transition-colors py-2 text-xs md:text-sm">
                      GitHub
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

