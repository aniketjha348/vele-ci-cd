'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { motion } from 'framer-motion'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyberpunk-dark via-cyberpunk-purple/20 to-cyberpunk-dark p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="cyberpunk-card p-8 max-w-md w-full text-center"
          >
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-cyberpunk-purple mb-4">
              Something went wrong
            </h2>
            <p className="text-cyberpunk-text/70 mb-6">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.href = '/'
              }}
              className="cyberpunk-button-primary w-full"
            >
              Go to Home
            </button>
          </motion.div>
        </div>
      )
    }

    return this.props.children
  }
}

