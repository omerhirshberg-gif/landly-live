'use client'

import { useState } from 'react'
import type { User } from 'firebase/auth'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth'
import { useLang } from '@/lib/i18n/useLang'
import { getAuthErrorMessage } from '@/lib/firebase/authErrors'

export default function SecuritySection({ user }: { user: User }) {
  const { t } = useLang()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwSaving(true)
    setPwMsg(null)
    try {
      if (!user.email) throw new Error('no-email')
      const credential = EmailAuthProvider.credential(user.email, currentPassword)
      await reauthenticateWithCredential(user, credential)
      await updatePassword(user, newPassword)
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
    <div className="bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm">
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
          <input type="password" required minLength={6} className="inp" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        <button type="submit" disabled={pwSaving} className="tap-target btn-primary w-full disabled:opacity-70">
          {pwSaving ? t('profile_change_password_busy') : t('profile_change_password_btn')}
        </button>
      </form>
    </div>
  )
}
