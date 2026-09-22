'use client'

import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { updateProfile } from 'firebase/auth'
import PhoneInput, { formatPhoneNumberIntl, isValidPhoneNumber } from 'react-phone-number-input'
import { useLang } from '@/lib/i18n/useLang'
import { getUserDocument, updateUserDocument } from '@/lib/firebase/users'
import { CUSTOMER_TYPES } from '@/lib/customerTypes'

export default function ProfileSection({ user }: { user: User }) {
  const { t } = useLang()

  const [loadingDoc, setLoadingDoc] = useState(true)
  const [displayName, setDisplayName] = useState(user.displayName ?? '')
  const [phone, setPhone] = useState('')
  const [customerType, setCustomerType] = useState('')

  const [editing, setEditing] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [phoneInput, setPhoneInput] = useState('')
  const [customerTypeInput, setCustomerTypeInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoadingDoc(true)
    getUserDocument(user.uid).then((doc) => {
      if (cancelled) return
      setPhone(doc?.phone ?? '')
      setCustomerType(doc?.customerType ?? '')
      if (doc?.displayName) setDisplayName(doc.displayName)
      setLoadingDoc(false)
    })
    return () => { cancelled = true }
  }, [user.uid])

  const startEdit = () => {
    setNameInput(displayName)
    setPhoneInput(phone)
    setCustomerTypeInput(customerType)
    setSaveMsg(null)
    setPhoneError(null)
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setSaveMsg(null)
    setPhoneError(null)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaveMsg(null)
    const trimmedPhone = phoneInput.trim()
    if (trimmedPhone && !isValidPhoneNumber(trimmedPhone)) {
      setPhoneError(t('phone_invalid_error'))
      return
    }
    setPhoneError(null)
    setSaving(true)
    try {
      const trimmedName = nameInput.trim()
      await Promise.all([
        updateProfile(user, { displayName: trimmedName }),
        updateUserDocument(user.uid, { displayName: trimmedName, phone: trimmedPhone, customerType: customerTypeInput }),
      ])
      setDisplayName(trimmedName)
      setPhone(trimmedPhone)
      setCustomerType(customerTypeInput)
      setEditing(false)
      setSaveMsg({ type: 'success', text: t('profile_save_success') })
    } catch {
      setSaveMsg({ type: 'error', text: t('profile_save_error') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm">
      {saveMsg && (
        <div className={`mb-4 text-sm font-semibold rounded-xl px-4 py-3 border ${saveMsg.type === 'success' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200'}`}>
          {saveMsg.text}
        </div>
      )}

      {editing ? (
        <form className="space-y-4" onSubmit={handleSave}>
          <div>
            <label className="block mb-1.5 text-sm font-bold text-slate-700">{t('profile_name_label')}</label>
            <input type="text" className="inp" autoComplete="name" value={nameInput} onChange={(e) => setNameInput(e.target.value)} />
          </div>
          <div>
            <label className="block mb-1.5 text-sm font-bold text-slate-700">{t('profile_phone_label')}</label>
            <PhoneInput
              international
              countryCallingCodeEditable={false}
              defaultCountry="IL"
              value={phoneInput}
              onChange={(value) => setPhoneInput(value ?? '')}
            />
            {phoneError && <p className="text-xs text-red-600 font-semibold mt-1.5">{phoneError}</p>}
          </div>
          <div>
            <label className="block mb-1.5 text-sm font-bold text-slate-700">{t('signup_customerTypeLabel')}</label>
            <select className="inp" value={customerTypeInput} onChange={(e) => setCustomerTypeInput(e.target.value)}>
              <option value="">{t('signup_customerType_placeholder')}</option>
              {CUSTOMER_TYPES.map((option) => (
                <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="tap-target btn-primary flex-1 disabled:opacity-70">
              {saving ? '…' : t('profile_save_btn')}
            </button>
            <button type="button" onClick={cancelEdit} disabled={saving} className="tap-target flex-1 text-center justify-center border-2 border-slate-200 text-slate-600 font-bold py-2.5 rounded-full hover:bg-slate-50 transition text-sm">
              {t('profile_cancel_btn')}
            </button>
          </div>
        </form>
      ) : (
        <div>
          <div className="flex items-center justify-between gap-3 pb-4 mb-5 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">{t('dash_tab_profile')}</h3>
            <button onClick={startEdit} className="tap-target text-xs font-bold text-brand border-2 border-brand px-4 py-1.5 rounded-full hover:bg-brandLight transition">
              {t('profile_edit_btn')}
            </button>
          </div>
          <dl className="space-y-4">
            <div>
              <dt className="text-xs font-semibold text-slate-500 mb-0.5">{t('profile_name_label')}</dt>
              <dd className="text-sm font-bold text-slate-900">{displayName || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500 mb-0.5">{t('profile_email_label')}</dt>
              <dd className="text-sm font-bold text-slate-900" dir="ltr">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500 mb-0.5">{t('profile_phone_label')}</dt>
              <dd className="text-sm font-bold text-slate-900" dir="ltr">{loadingDoc ? '…' : (phone ? formatPhoneNumberIntl(phone) || phone : t('profile_no_phone'))}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500 mb-0.5">{t('signup_customerTypeLabel')}</dt>
              <dd className="text-sm font-bold text-slate-900">
                {loadingDoc
                  ? '…'
                  : CUSTOMER_TYPES.find((option) => option.value === customerType)
                    ? t(CUSTOMER_TYPES.find((option) => option.value === customerType)!.labelKey)
                    : t('signup_customerType_placeholder')}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  )
}
