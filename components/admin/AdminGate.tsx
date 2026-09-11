'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

export const ADMIN_SESSION_KEY = 'landly_admin_pw'

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (pathname === '/admin/login') {
      setChecked(true)
      return
    }
    if (!sessionStorage.getItem(ADMIN_SESSION_KEY)) {
      router.replace('/admin/login')
      return
    }
    setChecked(true)
  }, [pathname, router])

  if (!checked) {
    return <div className="min-h-screen bg-slate-950" />
  }
  return <>{children}</>
}
