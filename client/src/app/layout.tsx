import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Vele - Anonymous Random Chat & Video',
  description: 'Meet, Match, and Talk – The Future of Random Connections',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
        <Toaster 
          position="top-right"
          toastOptions={{
            style: {
              background: '#1A1A2E',
              color: '#fff',
              border: '1px solid #8B5CF6',
            },
          }}
        />
      </body>
    </html>
  )
}

