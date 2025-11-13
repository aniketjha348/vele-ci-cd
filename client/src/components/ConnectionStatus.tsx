'use client'

import { motion } from 'framer-motion'

interface ConnectionStatusProps {
  isConnected: boolean
  isSearching?: boolean
  searchTime?: number
}

export default function ConnectionStatus({ isConnected, isSearching, searchTime }: ConnectionStatusProps) {
  if (!isConnected) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-4 right-4 bg-red-500/20 border border-red-500/50 rounded-lg p-3 z-50"
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm text-red-400">Disconnected</span>
        </div>
      </motion.div>
    )
  }

  if (isSearching) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-4 right-4 bg-cyberpunk-purple/20 border border-cyberpunk-purple/50 rounded-lg p-3 z-50"
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyberpunk-purple animate-pulse" />
          <span className="text-sm text-cyberpunk-purple">
            Searching... {searchTime ? `${searchTime}s` : ''}
          </span>
        </div>
      </motion.div>
    )
  }

  return null
}

