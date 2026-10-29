'use client'

import { useMemo, useState, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { Lock, MailCheck, Pencil, Plus } from 'lucide-react'
import PhoneInput, { formatPhoneNumberIntl, isValidPhoneNumber } from 'react-phone-number-input'
import { useLang } from '@/lib/i18n/useLang'
import { updateUserName, updateUserProfileDetails, type UserDocument } from '@/lib/firebase/users'
import { fullName, MAX_NAME_LENGTH, profileNameErrors, splitDisplayName, type NameFieldErrors } from '@/lib/auth/names'
import { useLiveUserDocument } from '@/lib/firebase/useLiveUserDocument'
import { CONTACT_CHANGE_FAILED, cancelPendingChange, contactChangeErrorKey, requestPhoneChange } from '@/lib/account/contactChange'
import type { OtpTarget } from '@/lib/auth/otp'
import { CUSTOMER_TYPES, MAX_PERSONA_NOTE_LENGTH, OTHER_CUSTOMER_TYPE, customerTypeLabel, isCustomerType } from '@/lib/customerTypes'
import { invalidateMemberProfile } from '@/lib/firebase/useMemberProfile'
import { ISRAEL_REGIONS, ISRAEL_REGION_KEYS, isIsraelRegion, listOriginCountries, originLabel } from '@/lib/profile/countryOfOrigin'
import SegmentBadge from '@/components/member/SegmentBadge'
import { WhatsAppIcon } from '@/components/ui/SocialIcon'
import AvatarUploader from './AvatarUploader'
import ChangeEmailForm from './ChangeEmailForm'
import OtpDialog from './OtpDialog'
import PendingChangeNotice from './PendingChangeNotice'

interface Details {
  phone: string
  customerType: string
  customerTypeOther: string
  countryOfOrigin: string
  israelRegion: string
}

const detailsOf = (profile: UserDocument | null): Details => ({
  phone: profile?.phone ?? '',
  customerType: profile?.customerType ?? '',
  customerTypeOther: profile?.customerTypeOther ?? '',
  countryOfOrigin: profile?.countryOfOrigin ?? '',
  israelRegion: profile?.israelRegion ?? '',
})

type Status = { tone: 'info' | 'error'; text: string } | null

// The member's profile on /profile (desktop and mobile browsers). One "Edit
// profile" button at the header's end (top right, top left in Hebrew) turns
// the name (first and last, both required once there is one; written to
// users/{uid} and the Auth record, updateUserName), the phone number, customer type,
// country of origin and region in Israel into fields at once; "Save changes"
// writes them to users/{uid} in one update, "Cancel" drops them (app: the
// Profile tab). A customer type of "Other" shows, and edits, what the member
// typed for it; members from before the origin card see "Not set". A member
// with no name yet (Apple sends it on the first authorization only, and
// never when it's hidden) sees "Add your name", which opens the editor on
// the first name.
//
// Email and phone changes are verified before they apply, both with a
// 6-digit code in OtpDialog. In Edit profile the email shows in a field box:
// its "Change" (email+password members) opens ChangeEmailForm, which emails
// the code to the new address; a Google account's address is its Google
// identity, so its box is locked with a note (also when it has a password). The name and email sit above
// the edit form, so ChangeEmailForm's own form never nests in it. A new phone
// number gets a WhatsApp code when verification is on
// (/api/account/change-phone decides, otherwise it saves as before).
// Meanwhile the amber PendingChangeNotice sits under the row, and users/{uid}
// is read live, so it disappears the moment the change is verified, on any device.
export default function ProfileSection({ user }: { user: User }) {
  const { t, lang } = useLang()

  const { profile, loaded } = useLiveUserDocument(user.uid)
  const loadingDoc = !loaded
  const displayName = profile?.displayName || user.displayName || ''
  const email = profile?.email || user.email || ''
  const stored = detailsOf(profile)
  const pendingEmail = profile?.pendingEmail ?? ''
  const pendingPhone = profile?.pendingPhone ?? ''
  const googleAccount = user.providerData.some((p) => p.providerId === 'google.com')
  const appleAccount = user.providerData.some((p) => p.providerId === 'apple.com')
  // Google or Apple linked locks the address, even beside a password (the server refuses it too).
  const canChangeEmail = !googleAccount && !appleAccount && user.providerData.some((p) => p.providerId === 'password')

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Details>(stored)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  // The stored parts, else a best split of the display name (Google, older profiles).
  const storedNames = profile?.firstName || profile?.lastName ? { firstName: profile.firstName, lastName: profile.lastName } : splitDisplayName(displayName)
  const [names, setNames] = useState(storedNames)
  const [nameErrors, setNameErrors] = useState<NameFieldErrors>({})
  const [focusName, setFocusName] = useState(false)

  const [emailFormOpen, setEmailFormOpen] = useState(false)
  const [otp, setOtp] = useState<{ target: OtpTarget; resendIn: number } | null>(null)
  const [pendingBusy, setPendingBusy] = useState<'cancelEmail' | 'cancelPhone' | null>(null)
  const [emailStatus, setEmailStatus] = useState<Status>(null)
  const [phoneStatus, setPhoneStatus] = useState<Status>(null)

  const countries = useMemo(() => listOriginCountries(lang), [lang])

  const change = (patch: Partial<Details>) => setDraft((d) => ({ ...d, ...patch }))

  const changeName = (patch: Partial<typeof names>) => {
    setNames((n) => ({ ...n, ...patch }))
    setNameErrors((e) => ({ ...e, ...Object.fromEntries(Object.keys(patch).map((k) => [k, undefined])) }))
  }

  const startEdit = (onName = false) => {
    setNames(storedNames)
    setNameErrors({})
    setFocusName(onName)
    setDraft(stored)
    setSaveMsg(null)
    setPhoneError(null)
    setEmailFormOpen(false)
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setEmailFormOpen(false)
    setPhoneError(null)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaveMsg(null)
    const errors = profileNameErrors(names, { hadName: !!displayName })
    setNameErrors(errors)
    if (errors.firstName || errors.lastName) return
    const nameChanged = fullName(names.firstName, names.lastName) !== fullName(storedNames.firstName, storedNames.lastName)
    const phone = draft.phone.trim()
    // Empty removes the number; anything else must be a valid number.
    if (phone && !isValidPhoneNumber(phone)) {
      setPhoneError(t('phone_invalid_error'))
      return
    }
    setPhoneError(null)
    setSaving(true)
    try {
      // A new number is verified first when verification is on: the other
      // fields save now and the number waits in pendingPhone for its code.
      let savedPhone = phone
      let verify: { target: OtpTarget; resendIn: number } | null = null
      if (phone && phone !== stored.phone) {
        const start = await requestPhoneChange(await user.getIdToken(), { phone, lang, channel: 'whatsapp' })
        if (start.ok && start.mode === 'otp') {
          verify = { target: { kind: 'phone', phone }, resendIn: start.resendIn }
        } else if (!start.ok && start.reason === 'rateLimited' && start.retryAfter && phone === pendingPhone) {
          // A code for this very number went out moments ago: enter that one.
          verify = { target: { kind: 'phone', phone }, resendIn: start.retryAfter }
        } else if (!start.ok) {
          setPhoneError(t(contactChangeErrorKey(start.reason)))
          return
        }
        if (verify) savedPhone = stored.phone
      }
      const next = { ...draft, phone: savedPhone, customerType: isCustomerType(draft.customerType) ? draft.customerType : '' as const }
      if (nameChanged) await updateUserName(user, names)
      await updateUserProfileDetails(user.uid, next)
      invalidateMemberProfile(user.uid)
      setEditing(false)
      setEmailFormOpen(false)
      if (verify) {
        setPhoneStatus(null)
        setOtp(verify)
      } else {
        setSaveMsg({ type: 'success', text: t('profile_save_success') })
      }
    } catch {
      setSaveMsg({ type: 'error', text: t('profile_save_error') })
    } finally {
      setSaving(false)
    }
  }

  const pendingAction = async (
    kind: NonNullable<typeof pendingBusy>,
    run: (idToken: string) => ReturnType<typeof cancelPendingChange>,
    setStatus: (status: Status) => void,
    success: Status
  ) => {
    setPendingBusy(kind)
    setStatus(null)
    const result = await user.getIdToken().then(run).catch(() => CONTACT_CHANGE_FAILED)
    setPendingBusy(null)
    setStatus(result.ok ? success : { tone: 'error', text: t(contactChangeErrorKey(result.reason)) })
  }

  const dt = 'text-xs font-semibold text-slate-500 mb-0.5'
  const dd = 'text-sm font-bold text-slate-900 break-words'
  const label = 'block mb-1.5 text-sm font-bold text-slate-700'
  // 16px text so iOS Safari doesn't zoom the page on focus; 48px tall touch target.
  const field = 'w-full h-12 px-4 rounded-[12px] border-[1.5px] border-slate-200 bg-white text-base text-slate-900 focus:outline-none focus:border-brand'
  const loading = (value: string) => (loadingDoc ? '…' : value)

  const plainRow = (rowLabel: string, value: ReactNode, ltr?: boolean) => (
    <div>
      <dt className={dt}>{rowLabel}</dt>
      <dd className={`${dd} ${editing ? 'text-slate-500' : ''}`}>{ltr ? <bdi dir="ltr">{value}</bdi> : value}</dd>
    </div>
  )

  // Edit profile shows the address in a field box: "Change" at its end for a
  // password account, a lock and a note for a Google one.
  const emailBox = (
    <div
      className={`flex items-center gap-3 min-h-12 ps-4 ${canChangeEmail ? 'pe-1' : 'pe-4'} rounded-[12px] border-[1.5px] border-slate-200 bg-slate-50`}
    >
      <span className="min-w-0 flex-1 py-2 text-base text-slate-700 break-words"><bdi dir="ltr">{email}</bdi></span>
      {canChangeEmail ? (
        !emailFormOpen && (
          <button
            type="button"
            onClick={() => {
              setEmailStatus(null)
              setEmailFormOpen(true)
            }}
            aria-label={`${t('profile_change_email_btn')}: ${t('profile_email_label')}`}
            className="tap-target flex-shrink-0 inline-flex items-center justify-center px-3 rounded-[10px] text-sm font-semibold text-brand hover:bg-brandLight transition-colors"
          >
            {t('profile_change_email_btn')}
          </button>
        )
      ) : (
        <Lock aria-hidden="true" className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" strokeWidth={1.75} />
      )}
    </div>
  )

  const emailRow = (
    <div>
      <dt className={editing ? label : dt}>{t('profile_email_label')}</dt>
      <dd>
        {editing ? emailBox : <div className={dd}><bdi dir="ltr">{email}</bdi></div>}
        {editing && !canChangeEmail && (googleAccount || appleAccount) && (
          <p className="mt-1.5 text-xs text-slate-500">{t(googleAccount ? 'profile_email_google_locked' : 'profile_email_apple_locked')}</p>
        )}
        {canChangeEmail && emailFormOpen && editing && (
          <ChangeEmailForm
            user={user}
            pendingEmail={pendingEmail}
            onSent={(sentTo, resendIn) => {
              setEmailFormOpen(false)
              setEmailStatus(null)
              setOtp({ target: { kind: 'email', email: sentTo }, resendIn })
            }}
            onCancel={() => setEmailFormOpen(false)}
          />
        )}
        <PendingChangeNotice
          show={!!pendingEmail && !emailFormOpen}
          message={t('pending_email_body')}
          placeholder="{email}"
          value={pendingEmail}
          icon={MailCheck}
          actionLabel={t('pending_email_enter')}
          onAction={() => {
            setEmailStatus(null)
            setOtp({ target: { kind: 'email', email: pendingEmail }, resendIn: 0 })
          }}
          onCancel={() => pendingAction('cancelEmail', (idToken) => cancelPendingChange(idToken, 'email'), setEmailStatus, null)}
          cancelBusy={pendingBusy === 'cancelEmail'}
          status={emailStatus}
        />
      </dd>
    </div>
  )

  const phoneNotice = (
    <PendingChangeNotice
      show={!!pendingPhone}
      message={t('pending_phone_body')}
      placeholder="{phone}"
      value={pendingPhone ? formatPhoneNumberIntl(pendingPhone) || pendingPhone : ''}
      icon={WhatsAppIcon}
      actionLabel={t('pending_phone_enter')}
      onAction={() => {
        setPhoneStatus(null)
        setOtp({ target: { kind: 'phone', phone: pendingPhone }, resendIn: 0 })
      }}
      onCancel={() => pendingAction('cancelPhone', (idToken) => cancelPendingChange(idToken, 'phone'), setPhoneStatus, null)}
      cancelBusy={pendingBusy === 'cancelPhone'}
      status={phoneStatus}
    />
  )

  // No name yet: an "Add your name" button in its place, opening the editor on it.
  const nameRow =
    displayName || loadingDoc ? (
      plainRow(t('profile_name_label'), displayName || '…')
    ) : (
      <div>
        <dt className={dt}>{t('profile_name_label')}</dt>
        <dd>
          <button
            type="button"
            onClick={() => startEdit(true)}
            className="tap-target -ms-2 inline-flex items-center gap-1.5 min-h-11 px-2 rounded-[10px] text-sm font-bold text-brand hover:bg-brandLight transition-colors"
          >
            <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
            {t('profile_add_name')}
          </button>
        </dd>
      </div>
    )

  // Name and email stay outside the edit form (see the header comment); while
  // editing, the name moves into the form as its two fields.
  const identity = (
    <dl className="space-y-4">
      {!editing && nameRow}
      {emailRow}
    </dl>
  )

  // A dt/dd pair, so the two sit directly in one <dl> group.
  const nameField = (part: 'firstName' | 'lastName', autoComplete: string, labelKey: 'onb_firstNameLabel' | 'onb_lastNameLabel') => {
    const id = `profile-${part === 'firstName' ? 'first' : 'last'}-name`
    const error = nameErrors[part]
    return (
      <>
        <dt><label htmlFor={id} className={label}>{t(labelKey)}</label></dt>
        <dd className="min-w-0 mb-4 sm:mb-0">
          <input
            id={id}
            type="text"
            value={names[part]}
            onChange={(e) => changeName({ [part]: e.target.value })}
            maxLength={MAX_NAME_LENGTH}
            autoComplete={autoComplete}
            autoCapitalize="words"
            autoFocus={part === 'firstName' && focusName}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            className={`${field} ${error ? 'border-red-500 focus:border-red-500' : ''}`}
          />
          {error && <p id={`${id}-error`} role="alert" className="text-xs text-red-600 font-semibold mt-1.5">{t(error)}</p>}
        </dd>
      </>
    )
  }

  const details = (
    <dl className="space-y-4 mt-4">
      {editing ? (
        <>
          {/* Side by side from sm up, in the reading direction (columns: label over field); stacked on phones. */}
          <div className="sm:grid sm:grid-flow-col sm:grid-rows-[auto_auto] sm:grid-cols-2 sm:gap-x-4">
            {nameField('firstName', 'given-name', 'onb_firstNameLabel')}
            {nameField('lastName', 'family-name', 'onb_lastNameLabel')}
          </div>
          <div>
            <dt><label htmlFor="profile-phone" className={label}>{t('profile_phone_label')}</label></dt>
            <dd>
              <PhoneInput
                id="profile-phone"
                international
                countryCallingCodeEditable={false}
                defaultCountry="IL"
                autoComplete="tel"
                autoFocus={!focusName}
                value={draft.phone}
                onChange={(value) => {
                  change({ phone: value ?? '' })
                  setPhoneError(null)
                }}
              />
              {phoneError && <p role="alert" className="text-xs text-red-600 font-semibold mt-1.5">{phoneError}</p>}
              {phoneNotice}
            </dd>
          </div>
          <div>
            <dt><label htmlFor="profile-customer-type" className={label}>{t('signup_customerTypeLabel')}</label></dt>
            <dd>
              <select id="profile-customer-type" value={draft.customerType} onChange={(e) => change({ customerType: e.target.value })} className={field}>
                {!isCustomerType(draft.customerType) && <option value="">{t('signup_customerType_placeholder')}</option>}
                {CUSTOMER_TYPES.map((o) => <option key={o.value} value={o.value}>{t(o.labelKey)}</option>)}
              </select>
              {draft.customerType === OTHER_CUSTOMER_TYPE && (
                <>
                  <label htmlFor="profile-customer-type-other" className={`${label} mt-3`}>{t('onb_persona_otherLabel')}</label>
                  <input
                    id="profile-customer-type-other"
                    type="text"
                    value={draft.customerTypeOther}
                    onChange={(e) => change({ customerTypeOther: e.target.value })}
                    placeholder={t('onb_persona_otherPlaceholder')}
                    maxLength={MAX_PERSONA_NOTE_LENGTH}
                    autoComplete="off"
                    className={field}
                  />
                </>
              )}
            </dd>
          </div>
          <div>
            <dt><label htmlFor="profile-origin" className={label}>{t('profile_origin_label')}</label></dt>
            <dd>
              <select id="profile-origin" value={draft.countryOfOrigin} onChange={(e) => change({ countryOfOrigin: e.target.value })} className={field}>
                <option value="">{t('profile_origin_unset')}</option>
                <optgroup label={t('origin_common')}>
                  {countries.pinned.map((c) => <option key={c.code} value={c.code}>{`${c.flag} ${c.name}`}</option>)}
                </optgroup>
                <optgroup label={t('origin_all')}>
                  {countries.rest.map((c) => <option key={c.code} value={c.code}>{`${c.flag} ${c.name}`}</option>)}
                </optgroup>
              </select>
            </dd>
          </div>
          <div>
            <dt><label htmlFor="profile-region" className={label}>{t('profile_region_label')}</label></dt>
            <dd>
              <select id="profile-region" value={draft.israelRegion} onChange={(e) => change({ israelRegion: e.target.value })} className={field}>
                <option value="">{t('profile_origin_unset')}</option>
                {ISRAEL_REGIONS.map((r) => <option key={r} value={r}>{t(ISRAEL_REGION_KEYS[r])}</option>)}
              </select>
            </dd>
          </div>
        </>
      ) : (
        <>
          <div>
            <dt className={dt}>{t('profile_phone_label')}</dt>
            <dd>
              <div className={dd}>
                {stored.phone && !loadingDoc ? <bdi dir="ltr">{formatPhoneNumberIntl(stored.phone) || stored.phone}</bdi> : loading(t('profile_no_phone'))}
              </div>
              {phoneNotice}
            </dd>
          </div>
          <div>
            <dt className={dt}>{t('signup_customerTypeLabel')}</dt>
            <dd className={dd}>{loading(customerTypeLabel(stored.customerType, stored.customerTypeOther, t) ?? t('signup_customerType_placeholder'))}</dd>
          </div>
          <div>
            <dt className={dt}>{t('profile_origin_label')}</dt>
            <dd className={dd}>{loading(originLabel(stored.countryOfOrigin, lang) ?? t('profile_origin_unset'))}</dd>
          </div>
          <div>
            <dt className={dt}>{t('profile_region_label')}</dt>
            <dd className={dd}>{loading(isIsraelRegion(stored.israelRegion) ? t(ISRAEL_REGION_KEYS[stored.israelRegion]) : t('profile_origin_unset'))}</dd>
          </div>
        </>
      )}
    </dl>
  )

  // One card. On phones, top to bottom: the avatar (and member type), the
  // Profile header with Edit, name and email, then the details. From 600px
  // (an unfolded foldable, a tablet, desktop; lib/layout/foldable.ts) two
  // panes in the reading direction, 24px apart either side of a hairline:
  // who the member is (avatar, member type, name, email) leading, about 40%,
  // and the details with the one Edit button trailing. The panes are
  // display:contents on phones, so their blocks keep the phone order above.
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-card flex flex-col fold:grid fold:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] fold:items-start fold:gap-x-6">
      <div className="contents fold:block fold:min-w-0 fold:pe-6 fold:border-e fold:border-slate-100">
        <div className="order-1">
          <AvatarUploader user={user} />
        </div>
        {/* Waits for the live read, so the "Member" fallback never flashes first. */}
        {loaded && (
          <div className="order-1 mb-5">
            <SegmentBadge customerType={profile?.customerType} customerTypeOther={profile?.customerTypeOther} />
          </div>
        )}
        <div className="order-4">{identity}</div>
      </div>

      <div className="contents fold:block fold:min-w-0">
        {saveMsg && (
          <div role={saveMsg.type === 'error' ? 'alert' : 'status'} className={`order-2 mb-4 text-sm font-semibold rounded-xl px-4 py-3 border ${saveMsg.type === 'success' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200'}`}>
            {saveMsg.text}
          </div>
        )}

        {/* The Edit button sits at the header's end: right in LTR, left in Hebrew. */}
        <div className="order-3 flex items-center justify-between gap-3 pb-4 mb-5 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">{t('dash_tab_profile')}</h3>
          {!editing && (
            <button
              type="button"
              onClick={() => startEdit()}
              disabled={loadingDoc}
              className="tap-target flex-shrink-0 inline-flex items-center gap-2 h-11 px-4 rounded-[14px] bg-brandLight text-brand text-sm font-semibold hover:bg-brandTint transition-colors disabled:opacity-60"
            >
              <Pencil aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
              {t('profile_edit_profile_btn')}
            </button>
          )}
        </div>
        <div className="order-5">
          {editing ? (
            <form onSubmit={handleSave} noValidate>
              {details}
              {/* Stacked full-width on phones (Save on top), side by side at the end from sm up */}
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-6 pb-[env(safe-area-inset-bottom,0px)]">
                <button type="button" onClick={cancelEdit} disabled={saving} className="ds-btn ds-btn-secondary ds-btn-md w-full sm:w-auto">
                  {t('profile_cancel_btn')}
                </button>
                <button type="submit" disabled={saving} aria-busy={saving} className="ds-btn ds-btn-primary ds-btn-md w-full sm:w-auto">
                  {saving ? '…' : t('profile_save_changes_btn')}
                </button>
              </div>
            </form>
          ) : (
            details
          )}
        </div>
      </div>
      {otp && (
        <OtpDialog
          user={user}
          target={otp.target}
          resendIn={otp.resendIn}
          onClose={() => setOtp(null)}
          onEnded={(message) => {
            setOtp(null)
            setSaveMsg({ type: 'error', text: message })
          }}
          onVerified={() => {
            const kind = otp.target.kind
            setOtp(null)
            // The Auth record already shows the new address: the dialog
            // signed back in (finishEmailChange) after the server changed it.
            invalidateMemberProfile(user.uid)
            setSaveMsg({ type: 'success', text: t(kind === 'email' ? 'otp_email_success' : 'otp_success') })
          }}
        />
      )}
    </div>
  )
}
