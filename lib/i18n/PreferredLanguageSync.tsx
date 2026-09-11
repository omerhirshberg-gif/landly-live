'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/lib/firebase/useAuth'
import { useLang } from './useLang'
import { resolvePreferredLanguage } from './preferredLanguage'

/**
 * Best-effort background correction for a session that resumes already
 * logged in (page refresh, new tab, persisted auth) rather than going
 * through /login — that explicit-login path already resolves the language
 * before navigating (see app/login/page.tsx), so this only matters when the
 * account's preference changed on a different device since this browser
 * last synced. Runs once per signed-in uid per session (not on every doc
 * change), guarded by the ref below.
 */
export default function PreferredLanguageSync() {
  const { user } = useAuth()
  const { lang, setLang } = useLang()
  const syncedUid = useRef<string | null>(null)

  useEffect(() => {
    if (!user) {
      syncedUid.current = null
      return
    }
    if (syncedUid.current === user.uid) return
    syncedUid.current = user.uid
    resolvePreferredLanguage(user.uid, lang).then((preferred) => {
      if (preferred) setLang(preferred)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  return null
}
