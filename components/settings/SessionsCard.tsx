'use client'

import { useEffect, useState } from 'react'
import { signOut, type User } from 'firebase/auth'
import { LogOut, Monitor, Smartphone } from 'lucide-react'
import IconFrame from '@/components/ui/IconFrame'
import { auth } from '@/lib/firebase/config'
import { useLang } from '@/lib/i18n/useLang'
import { formatLastEntry } from '@/lib/auth/greeting'
import { revokeAllSessions, type RevokeSessionsResult } from '@/lib/account/revokeSessions'
import { orderSessions, type UserSession } from '@/lib/account/sessionList'
import { watchSessions } from '@/lib/account/sessions'
import { forgetWebSessionBeat, webSessionId, webSessionName } from '@/lib/account/webSession'

// Privacy & Security's Sessions card: every device signed in to the account
// (users/{uid}/sessions, each device writing its own: SessionHeartbeat here,
// landly-mobile/src/lib/deviceSession.ts in the app), this browser first,
// the others by name and when they were last active; then "Sign out of all
// devices" (app/api/account/revoke-sessions), which also clears the list.
// The confirmation opens inline under the button, not in a dialog; a
// success signs this device out too, and the settings page sends it to /login.
export default function SessionsCard({ user }: { user: User }) {
  const { t } = useLang()
  const sessions = useSessionList(user.uid)
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
      forgetWebSessionBeat()
      await signOut(auth).catch(() => {})
      return
    }
    setResult(outcome)
    setBusy(false)
  }

  const error = result === 'rateLimited' ? t('del_rate_limited') : result ? t('security_signout_all_error') : null

  return (
    <section aria-labelledby="settings-sessions" className="mb-6">
      <h2 id="settings-sessions" className="px-1 pb-2 text-meta font-semibold text-slate-500">{t('security_sessions_title')}</h2>
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card divide-y divide-slate-100">
        <ul className="divide-y divide-slate-100">
          {sessions.map((session) => (
            <li key={session.id} className="flex items-center gap-3 min-h-[56px] px-4 py-3">
              <IconFrame icon={session.platform === 'web' ? Monitor : Smartphone} size="sm" tone={session.current ? 'success' : 'ink'} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-copy font-semibold text-ink">
                  {session.current && !session.deviceName ? (
                    t('security_this_device')
                  ) : session.current ? (
                    <Fill text={t('security_this_device_named')} slot="{device}" value={<bdi>{session.deviceName}</bdi>} />
                  ) : (
                    <bdi>{session.deviceName}</bdi>
                  )}
                </span>
                <span className="block truncate text-meta text-slate-500">
                  {session.current || !session.lastActiveAt ? (
                    t('security_this_device_sub')
                  ) : (
                    <Fill text={t('security_last_active')} slot="{time}" value={<bdi dir="ltr">{formatLastEntry(session.lastActiveAt)}</bdi>} />
                  )}
                </span>
              </span>
              {session.current && <span className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-emerald-500" aria-hidden="true"></span>}
            </li>
          ))}
        </ul>

        <div className="px-4 py-3">
          {confirming ? (
            <div role="group" aria-labelledby="sessions-confirm">
              <p id="sessions-confirm" className="text-copy font-semibold text-ink">{t('security_signout_all_confirm')}</p>
              <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row">
                <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="ds-btn ds-btn-secondary ds-btn-md w-full sm:flex-1">
                  {t('del_cancel')}
                </button>
                <button
                  type="button"
                  onClick={revoke}
                  disabled={busy}
                  aria-busy={busy || undefined}
                  className="tap-target inline-flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-red-600 px-4 text-copy font-semibold text-white transition-colors [@media(hover:hover)]:hover:enabled:bg-red-700 active:enabled:bg-red-800 disabled:opacity-60 sm:flex-1"
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
              <span className="flex w-10 flex-shrink-0 justify-center" aria-hidden="true"><LogOut aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100" strokeWidth={1.75} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-copy font-semibold">{t('security_signout_all')}</span>
                <span className="block text-meta text-red-500/80">{t('security_signout_all_sub')}</span>
                <span className="block text-meta text-slate-500">{t('security_signout_all_passkeys')}</span>
              </span>
            </button>
          )}
          {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
        </div>
      </div>
    </section>
  )
}

/** A translated sentence with an element (an isolated name or date) in its {slot}. */
function Fill({ text, slot, value }: { text: string; slot: string; value: React.ReactNode }) {
  const [before, after = ''] = text.split(slot)
  return (
    <>
      {before}
      {value}
      {after}
    </>
  )
}

/**
 * The listed devices, live. This browser is always first, named from its
 * user agent even before its own row has landed (or when the list can't be read).
 */
function useSessionList(uid: string): UserSession[] {
  const [here, setHere] = useState<{ id: string; name: string } | null>(null)
  const [stored, setStored] = useState<UserSession[]>([])
  // Read once on opening, so the list doesn't reorder while it's open.
  const [now] = useState(() => Date.now())
  useEffect(() => setHere({ id: webSessionId(), name: webSessionName() }), [])
  useEffect(() => (here ? watchSessions(uid, here.id, setStored) : undefined), [uid, here])

  // Before the browser is known (the server render, the first paint) the row reads plain "This device".
  const current: UserSession = stored.find((s) => s.current) ?? {
    id: here?.id ?? 'this-device',
    deviceName: here?.name ?? '',
    platform: 'web',
    lastActiveAt: null,
    createdAt: null,
    current: true,
  }
  return orderSessions([current, ...stored.filter((s) => !s.current)], now)
}
