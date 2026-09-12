'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { clearStoredToken, getStoredToken, isTokenExpired } from '@/lib/admin/adminSession'

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (pathname === '/admin/login') {
      setChecked(true)
      return
    }
    if (checked) return // already verified this session -- don't re-check on every nav

    const token = getStoredToken()
    if (!token || isTokenExpired(token)) {
      clearStoredToken()
      router.replace('/admin/login')
      return
    }
    setChecked(true)
  }, [pathname, router, checked])

  if (!checked) {
    return <div className="min-h-screen bg-slate-950" />
  }
  return <>{children}</>
}
