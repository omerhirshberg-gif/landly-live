'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/firebase/useAuth'
import { beatWebSession } from '@/lib/account/webSession'

// Keeps this browser's row in Privacy & Security › Sessions fresh while a
// verified member is signed in: on load and whenever the tab comes back into
// view (throttled in lib/account/webSession.ts). Business and admin logins
// aren't members, so their portals never write one. Renders nothing.
export default function SessionHeartbeat() {
  const { user } = useAuth()
  const pathname = usePathname() ?? ''
  const portal = pathname.startsWith('/business') || pathname.startsWith('/admin')
  const uid = user && user.emailVerified && !portal ? user.uid : null

  useEffect(() => {
    if (!uid) return
    void beatWebSession(uid)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void beatWebSession(uid)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [uid])

  return null
}
