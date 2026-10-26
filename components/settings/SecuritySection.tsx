'use client'

import { useState } from 'react'
import type { User } from 'firebase/auth'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth'
import { useLang } from '@/lib/i18n/useLang'
import { getAuthErrorMessage } from '@/lib/firebase/authErrors'
import { isStrongPassword } from '@/lib/auth/passwordValidation'
import { syncSessionsAfterPasswordChange } from '@/lib/account/sessionSync'
import PasswordRequirements from '@/components/auth/onboarding/PasswordRequirements'

// The new password follows the sign-up rule (lib/auth/passwordValidation.ts):
// the checklist ticks while the field is focused, and a weak password is
// refused before Firebase is asked (Expo: components/ChangePassword.tsx).
export default function SecuritySection({ user }: { user: User }) {
  const { t } = useLang()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newFocused, setNewFocused] = useState(false)
  const [weak, setWeak] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isStrongPassword(newPassword)) {
      setWeak(true)
      return
    }
    setPwSaving(true)
    setPwMsg(null)
    try {
      if (!user.email) throw new Error('no-email')
      const credential = EmailAuthProvider.credential(user.email, currentPassword)
      await reauthenticateWithCredential(user, credential)
      await updatePassword(user, newPassword)
      // Firebase just ended every other session; Firestore hears of it too.
      void user.getIdToken().then((idToken) => syncSessionsAfterPasswordChange(idToken)).catch(() => {})
      setCurrentPassword('')
      setNewPassword('')
      setPwMsg({ type: 'success', text: t('profile_password_success') })
    } catch (err) {
      setPwMsg({ type: 'error', text: getAuthErrorMessage(err) })
    } finally {
      setPwSaving(false)
    }
  }

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-card">
      <h3 className="text-base font-bold text-slate-900 mb-4">{t('profile_change_password_title')}</h3>

      {pwMsg && (
        <div className={`mb-4 text-sm font-semibold rounded-xl px-4 py-3 border ${pwMsg.type === 'success' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200'}`}>
          {pwMsg.text}
        </div>
      )}

      <form className="space-y-4" onSubmit={handleChangePassword}>
        <div>
          <label className="block mb-1.5 text-sm font-bold text-slate-700">{t('profile_current_password_label')}</label>
          <input type="password" required className="inp" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </div>
        <div>
          <label className="block mb-1.5 text-sm font-bold text-slate-700">{t('profile_new_password_label')}</label>
          <input
            type="password"
            required
            className="inp"
            autoComplete="new-password"
            aria-invalid={weak || undefined}
            aria-describedby={weak ? 'new-password-weak' : undefined}
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value)
              setWeak(false)
            }}
            // Checklist while focused; the one-line error on blur if still weak.
            onFocus={() => {
              setNewFocused(true)
              setWeak(false)
            }}
            onBlur={() => {
              setNewFocused(false)
              if (newPassword && !isStrongPassword(newPassword)) setWeak(true)
            }}
          />
          {weak && !newFocused && (
            <p id="new-password-weak" role="alert" className="text-xs text-red-600 font-semibold mt-1.5">{t('onb_passwordWeak')}</p>
          )}
          {/* Inside the field block, so the form spacing adds no gap while it's closed. The
              checklist tucks 6px under a field with a bottom margin; this input has none, so
              the wrapper adds it while open. */}
          <div className={`transition-[padding] duration-[220ms] motion-reduce:transition-none ${newFocused ? 'pt-4 -mb-1' : ''}`}>
            <PasswordRequirements password={newPassword} visible={newFocused} />
          </div>
        </div>
        <button type="submit" disabled={pwSaving} className="ds-btn ds-btn-primary w-full">
          {pwSaving ? t('profile_change_password_busy') : t('profile_change_password_btn')}
        </button>
      </form>
    </div>
  )
}
