'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { User } from 'firebase/auth'
import PhoneInput, { formatPhoneNumberIntl, isValidPhoneNumber } from 'react-phone-number-input'
import { useLang } from '@/lib/i18n/useLang'
import { getUserDocument, updateUserPhone } from '@/lib/firebase/users'
import { customerTypeLabel } from '@/lib/customerTypes'
import { invalidateMemberProfile } from '@/lib/firebase/useMemberProfile'
import { ISRAEL_REGION_KEYS, isIsraelRegion, originLabel } from '@/lib/profile/countryOfOrigin'
import AvatarUploader from './AvatarUploader'

// The member's profile on /profile (desktop and mobile browsers). Name and
// email are read-only; the phone number is editable in place, like the Expo
// Profile tab. Customer type, country of origin and region in Israel show
// here with an Edit link to their settings pages, where they're chosen
// (members from before the origin card see "Not set"). A customer type of
// "Other" shows what the member typed for it.
export default function ProfileSection({ user }: { user: User }) {
  const { t, lang } = useLang()

  const [loadingDoc, setLoadingDoc] = useState(true)
  const [displayName, setDisplayName] = useState(user.displayName ?? '')
  const [phone, setPhone] = useState('')
  const [customerType, setCustomerType] = useState('')
  const [customerTypeOther, setCustomerTypeOther] = useState('')
  const [countryOfOrigin, setCountryOfOrigin] = useState('')
  const [israelRegion, setIsraelRegion] = useState('')

  const [editingPhone, setEditingPhone] = useState(false)
  const [phoneInput, setPhoneInput] = useState('')
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
      setCustomerTypeOther(doc?.customerTypeOther ?? '')
      setCountryOfOrigin(doc?.countryOfOrigin ?? '')
      setIsraelRegion(doc?.israelRegion ?? '')
      if (doc?.displayName) setDisplayName(doc.displayName)
      setLoadingDoc(false)
    })
    return () => { cancelled = true }
  }, [user.uid])

  const startEdit = () => {
    setPhoneInput(phone)
    setSaveMsg(null)
    setPhoneError(null)
    setEditingPhone(true)
  }

  const cancelEdit = () => {
    setEditingPhone(false)
    setPhoneError(null)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaveMsg(null)
    const trimmedPhone = phoneInput.trim()
    // Empty removes the number; anything else must be a valid number.
    if (trimmedPhone && !isValidPhoneNumber(trimmedPhone)) {
      setPhoneError(t('phone_invalid_error'))
      return
    }
    setPhoneError(null)
    setSaving(true)
    try {
      await updateUserPhone(user.uid, trimmedPhone)
      setPhone(trimmedPhone)
      invalidateMemberProfile(user.uid)
      setEditingPhone(false)
      setSaveMsg({ type: 'success', text: t('profile_save_success') })
    } catch {
      setSaveMsg({ type: 'error', text: t('profile_save_error') })
    } finally {
      setSaving(false)
    }
  }

  const dt = 'text-xs font-semibold text-slate-500 mb-0.5'
  const dd = 'text-sm font-bold text-slate-900'

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm">
      <AvatarUploader user={user} />
      {saveMsg && (
        <div role={saveMsg.type === 'error' ? 'alert' : 'status'} className={`mb-4 text-sm font-semibold rounded-xl px-4 py-3 border ${saveMsg.type === 'success' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200'}`}>
          {saveMsg.text}
        </div>
      )}

      <h3 className="text-base font-bold text-slate-900 pb-4 mb-5 border-b border-slate-100">{t('dash_tab_profile')}</h3>
      <dl className="space-y-4">
        <div>
          <dt className={dt}>{t('profile_name_label')}</dt>
          <dd className={dd}>{displayName || '—'}</dd>
        </div>
        <div>
          <dt className={dt}>{t('profile_email_label')}</dt>
          <dd className={dd} dir="ltr">{user.email}</dd>
        </div>
        <div>
          {editingPhone ? (
            <>
              <dt>
                <label htmlFor="profile-phone" className="block mb-1.5 text-sm font-bold text-slate-700">{t('profile_phone_label')}</label>
              </dt>
              <dd>
                <form onSubmit={handleSave}>
                  <PhoneInput
                    id="profile-phone"
                    international
                    countryCallingCodeEditable={false}
                    defaultCountry="IL"
                    autoComplete="tel"
                    autoFocus
                    value={phoneInput}
                    onChange={(value) => {
                      setPhoneInput(value ?? '')
                      setPhoneError(null)
                    }}
                  />
                  {phoneError && <p role="alert" className="text-xs text-red-600 font-semibold mt-1.5">{phoneError}</p>}
                  {/* Stacked full-width on phones, side by side from sm up */}
                  <div className="flex flex-col-reverse sm:flex-row gap-3 mt-3">
                    <button type="button" onClick={cancelEdit} disabled={saving} className="ds-btn ds-btn-secondary ds-btn-md w-full sm:w-auto">
                      {t('profile_cancel_btn')}
                    </button>
                    <button type="submit" disabled={saving} aria-busy={saving} className="ds-btn ds-btn-primary ds-btn-md w-full sm:w-auto">
                      {saving ? '…' : t('profile_save_btn')}
                    </button>
                  </div>
                </form>
              </dd>
            </>
          ) : (
            <>
              <dt className={dt}>{t('profile_phone_label')}</dt>
              <dd className={`${dd} flex items-center justify-between gap-3`}>
                <span className="min-w-0" dir={phone ? 'ltr' : undefined}>
                  {loadingDoc ? '…' : (phone ? formatPhoneNumberIntl(phone) || phone : t('profile_no_phone'))}
                </span>
                <button
                  type="button"
                  onClick={startEdit}
                  disabled={loadingDoc}
                  aria-label={`${t('profile_edit_btn')} ${t('profile_phone_label')}`}
                  className="tap-target flex-shrink-0 h-11 px-4 rounded-[14px] bg-brandLight text-brand text-sm font-semibold hover:bg-[#F0F7FF] transition-colors disabled:opacity-60"
                >
                  {t('profile_edit_btn')}
                </button>
              </dd>
            </>
          )}
        </div>
        <EditableRow
          label={t('signup_customerTypeLabel')}
          value={loadingDoc ? '…' : customerTypeLabel(customerType, customerTypeOther, t) ?? t('signup_customerType_placeholder')}
          href="/settings/member-type"
          disabled={loadingDoc}
        />
        <EditableRow
          label={t('profile_origin_label')}
          value={loadingDoc ? '…' : originLabel(countryOfOrigin, lang) ?? t('profile_origin_unset')}
          href="/settings/language-region/origin"
          disabled={loadingDoc}
        />
        <EditableRow
          label={t('profile_region_label')}
          value={loadingDoc ? '…' : isIsraelRegion(israelRegion) ? t(ISRAEL_REGION_KEYS[israelRegion]) : t('profile_origin_unset')}
          href="/settings/language-region"
          disabled={loadingDoc}
        />
      </dl>
    </div>
  )
}

// A read-only detail with an Edit link to the settings page that changes it.
function EditableRow({ label, value, href, disabled }: { label: string; value: string; href: string; disabled: boolean }) {
  const { t } = useLang()
  return (
    <div>
      <dt className="text-xs font-semibold text-slate-500 mb-0.5">{label}</dt>
      <dd className="text-sm font-bold text-slate-900 flex items-center justify-between gap-3">
        <span className="min-w-0 break-words">{value}</span>
        <Link
          href={href}
          aria-label={`${t('profile_edit_btn')} ${label}`}
          aria-disabled={disabled || undefined}
          className={`tap-target flex-shrink-0 inline-flex items-center h-11 px-4 rounded-[14px] bg-brandLight text-brand text-sm font-semibold hover:bg-[#F0F7FF] transition-colors ${disabled ? 'pointer-events-none opacity-60' : ''}`}
        >
          {t('profile_edit_btn')}
        </Link>
      </dd>
    </div>
  )
}
