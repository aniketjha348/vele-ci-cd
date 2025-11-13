'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { reportAPI } from '@/lib/api'
import toast from 'react-hot-toast'

interface ReportBlockModalProps {
  isOpen: boolean
  onClose: () => void
  socketId: string
  userId?: string
}

export default function ReportBlockModal({ isOpen, onClose, socketId, userId }: ReportBlockModalProps) {
  const [activeTab, setActiveTab] = useState<'report' | 'block'>('report')
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const handleReport = async () => {
    if (!reason) {
      toast.error('Please select a reason')
      return
    }

    setLoading(true)
    try {
      await reportAPI.reportUser({
        socketId,
        reason,
        description,
      })
      toast.success('User reported successfully')
      onClose()
      setReason('')
      setDescription('')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to report user')
    } finally {
      setLoading(false)
    }
  }

  const handleBlock = async () => {
    setLoading(true)
    try {
      await reportAPI.blockUser({ socketId, userId })
      toast.success('User blocked successfully')
      onClose()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to block user')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="cyberpunk-border p-6 rounded-lg bg-cyberpunk-gray w-full max-w-md"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gradient">Report & Block</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab('report')}
              className={`flex-1 py-2 rounded-lg ${
                activeTab === 'report'
                  ? 'bg-cyberpunk-purple/30 border border-cyberpunk-purple'
                  : 'cyberpunk-input'
              }`}
            >
              Report
            </button>
            <button
              onClick={() => setActiveTab('block')}
              className={`flex-1 py-2 rounded-lg ${
                activeTab === 'block'
                  ? 'bg-red-500/30 border border-red-500'
                  : 'cyberpunk-input'
              }`}
            >
              Block
            </button>
          </div>

          {/* Report Tab */}
          {activeTab === 'report' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Reason
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="cyberpunk-input w-full"
                >
                  <option value="">Select a reason</option>
                  <option value="harassment">Harassment</option>
                  <option value="spam">Spam</option>
                  <option value="inappropriate_content">Inappropriate Content</option>
                  <option value="scam">Scam</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="cyberpunk-input w-full min-h-24"
                  placeholder="Provide more details..."
                  maxLength={500}
                />
              </div>

              <button
                onClick={handleReport}
                disabled={loading || !reason}
                className="cyberpunk-button w-full disabled:opacity-50"
              >
                {loading ? 'Reporting...' : 'Submit Report'}
              </button>
            </div>
          )}

          {/* Block Tab */}
          {activeTab === 'block' && (
            <div className="space-y-4">
              <p className="text-gray-300">
                Are you sure you want to block this user? You won&apos;t be matched with them again.
              </p>

              <button
                onClick={handleBlock}
                disabled={loading}
                className="w-full bg-red-500/20 border border-red-500 text-red-400 py-2 rounded-lg hover:bg-red-500/30 disabled:opacity-50"
              >
                {loading ? 'Blocking...' : 'Block User'}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

