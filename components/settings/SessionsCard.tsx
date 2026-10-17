'use client'

import { useState } from 'react'
import { signOut, type User } from 'firebase/auth'
import { auth } from '@/lib/firebase/config'
import { useLang } from '@/lib/i18n/useLang'
import { revokeAllSessions, type RevokeSessionsResult } from '@/lib/account/revokeSessions'

// Privacy & Security's Sessions card: this device (the one signed in now),
// then "Sign out of all devices". Firebase can't list a member's other
// sessions from the client, so instead of a list it offers the one control
// that matters: revoking them all (app/api/account/revoke-sessions). The
// confirmation opens inline under the button, not in a dialog; a success
// signs this device out too, and the settings page sends it to /login.
export default function SessionsCard({ user }: { user: User }) {
  const { t } = useLang()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<RevokeSessionsResult | null>(null)

  const revoke = async () => {
    setBusy(true)
    setResult(null)
    let outcome: RevokeSessionsResult
    try {
      outcome = await revokeAllSessions(await user.getIdToken())
    } catch {
      outcome = 'unauthorized'
    }
    // An already-revoked session has nothing left to end here either.
    if (outcome === 'done' || outcome === 'unauthorized') {
      await signOut(auth).catch(() => {})
      return
    }
    setResult(outcome)
    setBusy(false)
  }

  const error = result === 'rateLimited' ? t('del_rate_limited') : result ? t('security_signout_all_error') : null

  return (
    <section aria-labelledby="settings-sessions" className="mb-6">
      <h2 id="settings-sessions" className="px-1 pb-2 text-[13px] font-semibold text-slate-500">{t('security_sessions_title')}</h2>
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm divide-y divide-slate-100">
        <div className="flex items-center gap-3 min-h-[56px] px-4 py-3">
          <span className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600" aria-hidden="true">
            <i className="fa-solid fa-mobile-screen text-sm"></i>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold text-ink">{t('security_this_device')}</span>
            <span className="block truncate text-[13px] text-slate-500">{t('security_this_device_sub')}</span>
          </span>
          <span className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-emerald-500" aria-hidden="true"></span>
        </div>

        <div className="px-4 py-3">
          {confirming ? (
            <div role="group" aria-labelledby="sessions-confirm">
              <p id="sessions-confirm" className="text-[15px] font-semibold text-ink">{t('security_signout_all_confirm')}</p>
              <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row">
                <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="ds-btn ds-btn-secondary ds-btn-md w-full sm:flex-1">
                  {t('del_cancel')}
                </button>
                <button
                  type="button"
                  onClick={revoke}
                  disabled={busy}
                  aria-busy={busy || undefined}
                  className="tap-target inline-flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-red-600 px-4 text-[15px] font-semibold text-white transition-colors [@media(hover:hover)]:hover:enabled:bg-red-700 active:enabled:bg-red-800 disabled:opacity-60 sm:flex-1"
                >
                  {busy && <span aria-hidden="true" className="h-4 w-4 rounded-full border-2 border-current border-r-transparent animate-spin" />}
                  {busy ? t('security_signout_all_busy') : t('security_signout_all_yes')}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setResult(null)
                setConfirming(true)
              }}
              className="tap-target flex w-full items-center gap-3 min-h-[44px] text-start text-red-600 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
            >
              <i className="fa-solid fa-arrow-right-from-bracket w-9 text-center text-sm rtl:-scale-x-100" aria-hidden="true"></i>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">{t('security_signout_all')}</span>
                <span className="block text-[13px] text-red-500/80">{t('security_signout_all_sub')}</span>
              </span>
            </button>
          )}
          {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
        </div>
      </div>
    </section>
  )
}
