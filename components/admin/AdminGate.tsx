'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { checkAdminSession, isSignedIn } from '@/lib/admin/adminSession'
import { announceNeedsReply } from '@/lib/admin/needsReply'

// The admin pages open only with a valid session cookie (asked of
// /api/admin/session, since page scripts can't read it); without one, the
// login page. A returning admin whose session is still good never sees the
// login page: it forwards them to the dashboard.
export default function AdminGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [checked, setChecked] = useState(false)
  const onLogin = pathname === '/admin/login'

  useEffect(() => {
    let cancelled = false
    if (onLogin) {
      // The form shows at once; a session still good skips it.
      setChecked(true)
      checkAdminSession().then((ok) => {
        if (ok && !cancelled) router.replace('/admin')
      })
      return () => {
        cancelled = true
      }
    }
    if (checked && isSignedIn()) return // already verified this session -- don't re-check on every nav

    setChecked(false)
    checkAdminSession().then((ok) => {
      if (cancelled) return
      if (!ok) {
        router.replace('/admin/login')
        return
      }
      setChecked(true)
      // The badges' first poll may have run before the session was confirmed.
      announceNeedsReply()
    })
    return () => {
      cancelled = true
    }
    // `checked` is read, not followed: it changes only from here.
  }, [onLogin, router])

  if (!checked) {
    return <div className="min-h-[var(--app-dvh)] bg-[#F8FAFC]" />
  }
  return <>{children}</>
}
