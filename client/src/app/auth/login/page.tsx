'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to landing page with login modal
    router.push('/?modal=login')
  }, [router])

  return null
}
