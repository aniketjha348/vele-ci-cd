'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import AuthModal from '@/components/AuthModal'

function HomeContent() {
  const searchParams = useSearchParams()
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register')

  // Open modal from URL params (e.g., /?modal=login or /?modal=register)
  useEffect(() => {
    const modalParam = searchParams?.get('modal')
    if (modalParam === 'login' || modalParam === 'register') {
      setAuthMode(modalParam)
      setAuthModalOpen(true)
    }
  }, [searchParams])

  return (
    <main className="min-h-screen bg-cyberpunk-darker relative overflow-hidden">
      {/* Enhanced Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-cyberpunk-purple/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-10 w-[500px] h-[500px] bg-cyberpunk-blue/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-cyberpunk-green/15 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-cyberpunk-pink/15 rounded-full blur-3xl animate-float" style={{ animationDelay: '1.5s' }} />
      </div>

      {/* Animated Grid Pattern */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'linear-gradient(rgba(139, 92, 246, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(139, 92, 246, 0.1) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }} />

      {/* Header/Navbar */}
      <nav className="container mx-auto px-4 py-6 relative z-10">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3"
          >
            <div className="relative">
              <div className="absolute -inset-1 bg-cyberpunk-gradient rounded-lg blur opacity-50"></div>
              <div className="relative bg-cyberpunk-dark border-2 border-cyberpunk-purple rounded-lg px-4 py-2">
                <span className="text-2xl font-black text-gradient">V</span>
              </div>
            </div>
            <span className="text-2xl font-black text-gradient">VELE</span>
          </motion.div>

          {/* Join Now Button */}
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            onClick={() => {
              setAuthMode('register')
              setAuthModalOpen(true)
            }}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            className="cyberpunk-button-secondary px-6 py-3 text-sm md:text-base group"
          >
            <span className="flex items-center gap-2">
              Join Now
              <motion.span
                animate={{ x: [0, 3, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                →
              </motion.span>
            </span>
          </motion.button>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-8 md:py-16 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center max-w-5xl mx-auto"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 mb-8 glass-effect rounded-full border border-cyberpunk-purple/30"
          >
            <span className="w-2 h-2 bg-cyberpunk-green rounded-full animate-pulse"></span>
            <span className="text-sm text-gray-300">Join thousands of users worldwide</span>
          </motion.div>

          {/* Main Title */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            className="mb-8"
          >
            <h1 className="text-6xl md:text-8xl font-black mb-4 tracking-tight leading-none">
              <span className="text-gradient block">VELE</span>
            </h1>
            <div className="relative inline-block mt-4">
              <motion.div 
                className="absolute -inset-2 bg-cyberpunk-gradient rounded-2xl blur-2xl opacity-40"
                animate={{ 
                  scale: [1, 1.1, 1],
                  opacity: [0.3, 0.5, 0.3]
                }}
                transition={{ duration: 3, repeat: Infinity }}
              />
              <p className="relative text-2xl md:text-4xl font-bold text-cyberpunk-purple mb-3">
                Meet, Match, and Talk
              </p>
            </div>
            <p className="text-lg md:text-xl text-gray-300 mt-6 font-light max-w-2xl mx-auto leading-relaxed">
              The Future of <span className="text-gradient font-semibold">Random Connections</span>
            </p>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16"
          >
            <motion.button
              onClick={() => {
                setAuthMode('register')
                setAuthModalOpen(true)
              }}
              whileHover={{ scale: 1.05, y: -3 }}
              whileTap={{ scale: 0.95 }}
              className="cyberpunk-button text-base md:text-lg px-8 py-4 relative group overflow-hidden"
            >
              <span className="relative z-10 flex items-center gap-2">
                Create Free Account
                <motion.span
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  →
                </motion.span>
              </span>
              <motion.div
                className="absolute inset-0 bg-white/10"
                initial={{ x: '-100%' }}
                whileHover={{ x: '100%' }}
                transition={{ duration: 0.5 }}
              />
            </motion.button>
            <motion.button
              onClick={() => {
                setAuthMode('login')
                setAuthModalOpen(true)
              }}
              whileHover={{ scale: 1.05, y: -3 }}
              whileTap={{ scale: 0.95 }}
              className="cyberpunk-button-secondary text-base md:text-lg px-8 py-4 group"
            >
              <span className="flex items-center gap-2">
                Sign In
                <motion.span
                  animate={{ rotate: [0, 15, -15, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  ✨
                </motion.span>
              </span>
            </motion.button>
          </motion.div>

          {/* Trust Indicators */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="flex flex-wrap justify-center gap-6 md:gap-10 mb-12"
          >
            {[
              { value: '10K+', label: 'Active Users' },
              { value: '50K+', label: 'Matches Made' },
              { value: '99.9%', label: 'Uptime' },
            ].map((stat, idx) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + idx * 0.1 }}
                className="text-center"
              >
                <div className="text-2xl md:text-3xl font-bold text-gradient mb-1">
                  {stat.value}
                </div>
                <div className="text-xs text-gray-400">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>

          {/* Feature Cards */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-16"
          >
            {[
              { 
                icon: '🔒', 
                title: 'Anonymous & Secure', 
                desc: 'Chat without revealing your identity. End-to-end encrypted for maximum privacy.',
                color: 'purple',
                gradient: 'from-cyberpunk-purple/20 to-cyberpunk-purple/5'
              },
              { 
                icon: '🎮', 
                title: 'Gamified Experience', 
                desc: 'Earn XP, level up, and unlock rewards. Spin the wheel for exciting prizes!',
                color: 'green',
                gradient: 'from-cyberpunk-green/20 to-cyberpunk-green/5'
              },
              { 
                icon: '🤖', 
                title: 'AI-Powered Moderation', 
                desc: 'Advanced AI keeps conversations safe and appropriate for everyone.',
                color: 'blue',
                gradient: 'from-cyberpunk-blue/20 to-cyberpunk-blue/5'
              },
            ].map((feature, idx) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 + idx * 0.15 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className={`cyberpunk-card group cursor-pointer relative overflow-hidden bg-gradient-to-br ${feature.gradient}`}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyberpunk-purple/10 rounded-full blur-2xl -mr-16 -mt-16"></div>
                <div className="relative z-10">
                  <motion.div 
                    className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300"
                    whileHover={{ rotate: [0, -10, 10, 0] }}
                    transition={{ duration: 0.5 }}
                  >
                    {feature.icon}
                  </motion.div>
                  <h3 className={`text-xl font-bold text-cyberpunk-${feature.color} mb-2`}>
                    {feature.title}
                  </h3>
                  <p className="text-gray-300 text-sm leading-relaxed">{feature.desc}</p>
                  <motion.div 
                    className="mt-3 text-cyberpunk-purple font-semibold text-xs flex items-center gap-2"
                    whileHover={{ x: 5 }}
                  >
                    Learn more →
                  </motion.div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Additional Features Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.3 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto"
          >
            {[
              { icon: '🎯', label: 'Video Chat' },
              { icon: '💬', label: 'Text Chat' },
              { icon: '🎨', label: 'Customizable' },
              { icon: '⚡', label: 'Fast & Smooth' },
            ].map((item, idx) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.4 + idx * 0.1 }}
                whileHover={{ scale: 1.1, y: -5 }}
                className="glass-effect p-4 rounded-xl text-center cursor-pointer group"
              >
                <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">
                  {item.icon}
                </div>
                <div className="text-xs text-gray-400 font-medium">{item.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* Enhanced Floating Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1.5 h-1.5 bg-cyberpunk-purple rounded-full"
            initial={{
              x: typeof window !== 'undefined' ? Math.random() * window.innerWidth : Math.random() * 1000,
              y: typeof window !== 'undefined' ? Math.random() * window.innerHeight : Math.random() * 1000,
              opacity: Math.random() * 0.5 + 0.2,
            }}
            animate={{
              y: typeof window !== 'undefined' 
                ? [null, Math.random() * window.innerHeight]
                : [null, Math.random() * 1000],
              x: typeof window !== 'undefined'
                ? [null, Math.random() * window.innerWidth * 0.1]
                : [null, Math.random() * 100],
              opacity: [0.2, 0.8, 0.2],
            }}
            transition={{
              duration: Math.random() * 4 + 3,
              repeat: Infinity,
              delay: Math.random() * 2,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        mode={authMode}
        onSwitchMode={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
      />
    </main>
  )
}

export default function Home() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-cyberpunk-darker flex items-center justify-center">
        <div className="text-cyberpunk-purple animate-pulse">Loading...</div>
      </main>
    }>
      <HomeContent />
    </Suspense>
  )
}
