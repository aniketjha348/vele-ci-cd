'use client'

import { motion } from 'framer-motion'

export default function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-cyberpunk-darker relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyberpunk-purple/10 rounded-full blur-3xl"></div>
      </div>
      
      <div className="container mx-auto px-4 py-6 relative z-10">
        {/* Navbar Skeleton */}
        <div className="glass-effect border-b border-cyberpunk-purple/30 mb-8">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="h-8 w-24 bg-cyberpunk-purple/20 rounded animate-pulse"></div>
            <div className="flex gap-4">
              <div className="h-8 w-20 bg-cyberpunk-purple/20 rounded animate-pulse"></div>
              <div className="h-8 w-20 bg-cyberpunk-purple/20 rounded animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Welcome Skeleton */}
        <div className="mb-8">
          <div className="h-12 w-64 bg-cyberpunk-purple/20 rounded mb-4 animate-pulse"></div>
          <div className="h-4 w-96 bg-cyberpunk-purple/10 rounded animate-pulse"></div>
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 cyberpunk-card p-6">
            <div className="h-6 w-32 bg-cyberpunk-purple/20 rounded mb-6 animate-pulse"></div>
            <div className="h-3 w-full bg-cyberpunk-purple/10 rounded mb-4 animate-pulse"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="glass-effect p-4 rounded-xl">
                  <div className="h-8 w-8 bg-cyberpunk-purple/20 rounded mb-3 animate-pulse"></div>
                  <div className="h-6 w-16 bg-cyberpunk-purple/20 rounded mb-2 animate-pulse"></div>
                  <div className="h-4 w-12 bg-cyberpunk-purple/10 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
          <div className="cyberpunk-card p-6">
            <div className="h-6 w-24 bg-cyberpunk-purple/20 rounded mb-4 animate-pulse"></div>
            <div className="h-8 w-20 bg-cyberpunk-purple/20 rounded mb-4 animate-pulse"></div>
            <div className="h-10 w-full bg-cyberpunk-purple/10 rounded animate-pulse"></div>
          </div>
        </div>

        {/* Quick Actions Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="cyberpunk-card p-6">
              <div className="h-12 w-12 bg-cyberpunk-purple/20 rounded mb-4 animate-pulse"></div>
              <div className="h-6 w-24 bg-cyberpunk-purple/20 rounded mb-2 animate-pulse"></div>
              <div className="h-4 w-32 bg-cyberpunk-purple/10 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function CardSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="cyberpunk-card p-6"
    >
      <div className="h-6 w-1/2 bg-cyberpunk-purple/20 rounded mb-4 animate-pulse"></div>
      <div className="h-4 w-full bg-cyberpunk-purple/10 rounded mb-2 animate-pulse"></div>
      <div className="h-4 w-3/4 bg-cyberpunk-purple/10 rounded animate-pulse"></div>
    </motion.div>
  )
}

export function ChatMessageSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex gap-4"
    >
      <div className="h-10 w-10 bg-cyberpunk-purple/20 rounded-full animate-pulse"></div>
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/4 bg-cyberpunk-purple/10 rounded animate-pulse"></div>
        <div className="h-16 w-3/4 bg-cyberpunk-purple/10 rounded-lg animate-pulse"></div>
      </div>
    </motion.div>
  )
}

export function DashboardStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="glass-effect p-4 rounded-xl">
          <div className="h-8 w-8 bg-cyberpunk-purple/20 rounded mb-3 animate-pulse"></div>
          <div className="h-6 w-16 bg-cyberpunk-purple/20 rounded mb-2 animate-pulse"></div>
          <div className="h-4 w-12 bg-cyberpunk-purple/10 rounded animate-pulse"></div>
        </div>
      ))}
    </div>
  )
}
