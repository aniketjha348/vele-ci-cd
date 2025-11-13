'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to landing page with register modal
    router.push('/?modal=register')
  }, [router])

  return null
}
