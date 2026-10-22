'use client'

import { useEffect, useId, useState } from 'react'
import { EmailAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup, type User } from 'firebase/auth'
import { googleProvider } from '@/lib/firebase/config'
import { getAuthErrorMessage } from '@/lib/firebase/authErrors'
import { addPasskey, fetchPasskeys, passkeySupport, removePasskey, type PasskeySummary } from '@/lib/auth/passkeyClient'
import { useLang } from '@/lib/i18n/useLang'

type Message = { tone: 'success' | 'error'; text: string }

// Privacy & Security's Passkeys card (lib/auth/passkeyClient.ts): what
// passkeys are, the member's saved ones (name, when added, last used,
// Remove), and "Add a passkey". Hidden where the browser has no WebAuthn or
// this deployment has passkeys switched off. Adding one needs a sign-in from
// the last 10 minutes: an older session first confirms the password (or
// Google, for a Google-only account) right here, then the browser's passkey
// sheet opens. Remove confirms inline, like Sessions.
export default function PasskeysCard({ user }: { user: User }) {
  const { t, lang } = useLang()
  const headingId = useId()
  const [passkeys, setPasskeys] = useState<PasskeySummary[] | null>(null)
  const [hidden, setHidden] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [adding, setAdding] = useState(false)
  const [reauth, setReauth] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [message, setMessage] = useState<Message | null>(null)
  const hasPassword = !!user.providerData?.some((p) => p.providerId === 'password')

  useEffect(() => {
    let cancelled = false
    passkeySupport()
      .then(async ({ webauthn }) => {
        if (!webauthn) return
        const list = await fetchPasskeys(user)
        if (cancelled || list === null) return
        setPasskeys(list)
        setHidden(false)
      })
      .catch(() => {
        if (cancelled) return
        // Still offer the card: adding may work even if listing didn't.
        setLoadFailed(true)
        setHidden(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const formatDate = (iso: string | null) => {
    if (!iso) return ''
    try {
      return new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(new Date(iso))
    } catch {
      return iso.slice(0, 10)
    }
  }

  const add = async () => {
    setMessage(null)
    setConfirmingId(null)
    setAdding(true)
    try {
      const outcome = await addPasskey(user)
      if (outcome.kind === 'added') {
        setPasskeys((list) => [...(list ?? []), outcome.passkey])
        setReauth(false)
        setMessage({ tone: 'success', text: t('passkeys_added') })
      } else if (outcome.kind === 'reauth') {
        setReauth(true)
      } else if (outcome.kind === 'error') {
        setMessage({ tone: 'error', text: t(outcome.code === 'already_registered' ? 'passkeys_err_already' : 'passkeys_err_failed') })
      }
    } catch {
      setMessage({ tone: 'error', text: t('passkeys_err_failed') })
    } finally {
      setAdding(false)
    }
  }

  // Confirms the account, refreshes the ID token (a new auth_time), then goes straight on to the passkey sheet.
  const confirmAndAdd = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setMessage(null)
    setAdding(true)
    try {
      if (hasPassword) {
        if (!user.email) throw new Error('no-email')
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password))
      } else {
        await reauthenticateWithPopup(user, googleProvider)
      }
      await user.getIdToken(true)
      setPassword('')
    } catch (err) {
      setMessage({ tone: 'error', text: getAuthErrorMessage(err) })
      setAdding(false)
      return
    }
    await add()
  }

  const remove = async (id: string) => {
    setMessage(null)
    setRemovingId(id)
    try {
      if (!(await removePasskey(user, id))) throw new Error('remove failed')
      setPasskeys((list) => (list ?? []).filter((p) => p.id !== id))
      setConfirmingId(null)
      setMessage({ tone: 'success', text: t('passkeys_removed') })
    } catch {
      setMessage({ tone: 'error', text: t('passkeys_err_remove') })
    } finally {
      setRemovingId(null)
    }
  }

  if (hidden) return null

  return (
    <section aria-labelledby={headingId} className="mb-6">
      <h2 id={headingId} className="px-1 pb-2 text-[13px] font-semibold text-slate-500">{t('passkeys_title')}</h2>
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm divide-y divide-slate-100">
        <div className="flex items-start gap-3 px-4 py-4">
          <span className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-brandTint text-brand" aria-hidden="true">
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="7" r="4" />
              <path d="M2 21v-1a6 6 0 0 1 6-6h2.5" />
              <circle cx="17.5" cy="13.5" r="2.5" />
              <path d="M17.5 16v5M17.5 18.5h2M17.5 21h1.5" />
            </svg>
          </span>
          <p className="min-w-0 flex-1 text-sm leading-6 text-body">{t('passkeys_intro')}</p>
        </div>

        {loadFailed ? (
          <p className="px-4 py-3 text-sm text-slate-500">{t('passkeys_err_load')}</p>
        ) : passkeys && passkeys.length === 0 ? (
          <p className="px-4 py-3 text-sm text-slate-500">{t('passkeys_empty')}</p>
        ) : (
          <ul>
            {(passkeys ?? []).map((p) => (
              <li key={p.id} className="px-4 py-3 border-t border-slate-100 first:border-t-0">
                <div className="flex items-center gap-3 min-h-[44px]">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-semibold text-ink"><bdi>{p.name}</bdi></span>
                      {p.synced && (
                        <span className="flex-shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">{t('passkeys_synced')}</span>
                      )}
                    </span>
                    <span className="block truncate text-[13px] text-slate-500">
                      {t('passkeys_created').replace('{date}', formatDate(p.createdAt))}
                      {p.lastUsedAt && <> · {t('passkeys_lastUsed').replace('{date}', formatDate(p.lastUsedAt))}</>}
                    </span>
                  </span>
                  {confirmingId !== p.id && (
                    <button
                      type="button"
                      onClick={() => {
                        setMessage(null)
                        setConfirmingId(p.id)
                      }}
                      aria-label={t('passkeys_removeAria').replace('{name}', p.name)}
                      className="tap-target flex-shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 [@media(hover:hover)]:hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
                    >
                      {t('passkeys_remove')}
                    </button>
                  )}
                </div>
                {confirmingId === p.id && (
                  <div role="group" aria-label={t('passkeys_removeConfirm')} className="mt-2">
                    <p className="text-sm font-semibold text-ink">{t('passkeys_removeConfirm')}</p>
                    <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row">
                      <button type="button" onClick={() => setConfirmingId(null)} disabled={removingId === p.id} className="ds-btn ds-btn-secondary ds-btn-md w-full sm:flex-1">
                        {t('del_cancel')}
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(p.id)}
                        disabled={removingId === p.id}
                        aria-busy={removingId === p.id || undefined}
                        className="tap-target inline-flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-red-600 px-4 text-[15px] font-semibold text-white transition-colors [@media(hover:hover)]:hover:enabled:bg-red-700 active:enabled:bg-red-800 disabled:opacity-60 sm:flex-1"
                      >
                        {removingId === p.id && <span aria-hidden="true" className="h-4 w-4 rounded-full border-2 border-current border-r-transparent animate-spin" />}
                        {t('passkeys_removeYes')}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="px-4 py-4">
          {message && (
            <p
              role={message.tone === 'error' ? 'alert' : 'status'}
              className={`mb-3 rounded-xl border px-4 py-3 text-sm font-semibold ${message.tone === 'success' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200'}`}
            >
              {message.text}
            </p>
          )}

          {reauth ? (
            <form onSubmit={confirmAndAdd} aria-labelledby={`${headingId}-reauth`}>
              <p id={`${headingId}-reauth`} className="text-[15px] font-semibold text-ink">{t('passkeys_reauth_title')}</p>
              <p className="mt-1 text-sm text-body">{t(hasPassword ? 'passkeys_reauth_password' : 'passkeys_reauth_google')}</p>
              {hasPassword && (
                <input
                  type="password"
                  required
                  className="inp mt-3"
                  autoComplete="current-password"
                  aria-label={t('profile_current_password_label')}
                  placeholder={t('profile_current_password_label')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
              <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    setReauth(false)
                    setPassword('')
                  }}
                  disabled={adding}
                  className="ds-btn ds-btn-secondary ds-btn-md w-full sm:flex-1"
                >
                  {t('del_cancel')}
                </button>
                <button type="submit" disabled={adding || (hasPassword && !password)} aria-busy={adding || undefined} className="ds-btn ds-btn-primary ds-btn-md w-full sm:flex-1">
                  {adding ? t('passkeys_adding') : t(hasPassword ? 'passkeys_reauth_confirm' : 'passkeys_reauth_googleBtn')}
                </button>
              </div>
            </form>
          ) : (
            <button type="button" onClick={add} disabled={adding} aria-busy={adding || undefined} className="ds-btn ds-btn-primary ds-btn-md w-full inline-flex items-center justify-center gap-2">
              {adding && <span aria-hidden="true" className="h-4 w-4 rounded-full border-2 border-current border-r-transparent animate-spin" />}
              {adding ? t('passkeys_adding') : t('passkeys_add')}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
