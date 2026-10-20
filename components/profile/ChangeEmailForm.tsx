'use client'

import { useState } from 'react'
import { EmailAuthProvider, reauthenticateWithCredential, type User } from 'firebase/auth'
import { CONTACT_CHANGE_FAILED, contactChangeErrorKey, requestEmailChange } from '@/lib/account/contactChange'
import { getAuthErrorMessage } from '@/lib/firebase/authErrors'
import { useLang } from '@/lib/i18n/useLang'

// The email row's "Change" panel on /profile (email+password members only;
// app: components/ChangeEmailForm.tsx). The current password is checked
// first (re-authentication, as the password change does), then
// /api/account/change-email emails a 6-digit code to the new address and
// onSent opens the code dialog (OtpDialog); the account keeps its current
// email until the code is entered, and the amber notice takes over meanwhile.
export default function ChangeEmailForm({
  user,
  pendingEmail,
  onSent,
  onCancel,
}: {
  user: User
  /** The address already waiting for its code, if any. */
  pendingEmail: string
  onSent: (email: string, resendIn: number) => void
  onCancel: () => void
}) {
  const { t, lang } = useLang()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const newEmail = email.trim()
    if (!newEmail || !password || busy) return
    setBusy(true)
    setError(null)
    try {
      if (!user.email) throw new Error('no-email')
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password))
    } catch (err) {
      setError(getAuthErrorMessage(err))
      setBusy(false)
      return
    }
    const result = await requestEmailChange(await user.getIdToken(), { newEmail, lang }).catch(() => CONTACT_CHANGE_FAILED)
    setBusy(false)
    if (result.ok) {
      setPassword('')
      onSent(result.pendingEmail, result.resendIn)
    } else if (result.reason === 'rateLimited' && result.retryAfter && newEmail.toLowerCase() === pendingEmail) {
      // A code for this very address went out moments ago: enter that one.
      setPassword('')
      onSent(pendingEmail, result.retryAfter)
    } else {
      setError(t(contactChangeErrorKey(result.reason)))
    }
  }

  const label = 'block mb-1.5 text-sm font-bold text-slate-700'
  // 16px text so iOS Safari doesn't zoom the page on focus; 48px tall touch target.
  const field = 'w-full h-12 px-4 rounded-[12px] border-[1.5px] border-slate-200 bg-white text-base text-slate-900 focus:outline-none focus:border-brand'

  return (
    <form onSubmit={submit} noValidate className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
      <div>
        <h4 className="text-sm font-bold text-slate-900">{t('profile_change_email_title')}</h4>
        <p className="mt-1 text-xs leading-5 text-slate-500">{t('profile_change_email_hint')}</p>
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold rounded-xl px-4 py-3 border text-red-600 bg-red-50 border-red-200">
          {error}
        </p>
      )}
      <div>
        <label htmlFor="profile-new-email" className={label}>{t('profile_new_email_label')}</label>
        <input
          id="profile-new-email"
          type="email"
          dir="ltr"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setError(null)
          }}
          className={field}
        />
      </div>
      <div>
        <label htmlFor="profile-email-password" className={label}>{t('profile_current_password_label')}</label>
        <input
          id="profile-email-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setError(null)
          }}
          className={field}
        />
      </div>
      {/* Stacked full-width on phones (Send on top), side by side at the end from sm up */}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
        <button type="button" onClick={onCancel} disabled={busy} className="ds-btn ds-btn-secondary ds-btn-md w-full sm:w-auto">
          {t('profile_cancel_btn')}
        </button>
        <button type="submit" disabled={busy || !email.trim() || !password} aria-busy={busy} className="ds-btn ds-btn-primary ds-btn-md w-full sm:w-auto">
          {busy ? '…' : t('profile_change_email_submit')}
        </button>
      </div>
    </form>
  )
}
