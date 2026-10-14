'use client'

import { useState } from 'react'
import { createUserWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth'
import { parsePhoneNumber } from 'react-phone-number-input'
import { auth } from '@/lib/firebase/config'
import { getAuthErrorMessage } from '@/lib/firebase/authErrors'
import { createUserDocument } from '@/lib/firebase/users'
import { requestVerificationEmail, type VerificationSendResult } from '@/lib/auth/requestVerificationEmail'
import { CUSTOMER_TYPES } from '@/lib/customerTypes'
import { useLang } from '@/lib/i18n/useLang'
import Button from './Button'
import Notice from './Notice'
import TextField from './TextField'

export interface PendingVerification {
  variant: 'signup' | 'login'
  email: string
  idToken: string
  /** Result of the send that already happened (signup sends one up front). */
  initialResult?: VerificationSendResult
}

// Numbers without a "+country" prefix are read as Israeli; the stored value
// is E.164 either way — the same rule as the mobile SignUpForm.
function toE164(input: string): string | null {
  const parsed = parsePhoneNumber(input, 'IL')
  return parsed?.isValid() ? parsed.number : null
}

type FieldErrors = Partial<Record<'fullName' | 'customerType' | 'phone', string>>

// Web counterpart of landly-mobile/src/auth/SignUpForm.tsx: same fields, same
// user document, same verify-then-sign-in rule. On success the account is
// signed straight back out and `onPendingVerification` swaps in the "check
// your inbox" card.
export default function SignUpForm({ onPendingVerification }: { onPendingVerification: (p: PendingVerification) => void }) {
  const { t, lang } = useLang()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [customerType, setCustomerType] = useState('')
  const [phone, setPhone] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const clearFieldError = (key: keyof FieldErrors) => setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const e164 = toE164(phone)
    const nextErrors: FieldErrors = {
      fullName: fullName.trim() ? undefined : t('mobile_signup_nameRequired'),
      customerType: customerType ? undefined : t('mobile_signup_typeRequired'),
      phone: e164 ? undefined : t('phone_invalid_error'),
    }
    setFieldErrors(nextErrors)
    if (!e164 || Object.values(nextErrors).some(Boolean)) return

    setSubmitting(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
      await updateProfile(cred.user, { displayName: fullName.trim() })
      await createUserDocument(cred.user, { phone: e164, customerType, preferredLanguage: lang })
      // Email+password accounts stay locked until the emailed link is
      // clicked: send it, then sign out so the app never treats this session
      // as logged in. The token is kept only to authorize a resend.
      const idToken = await cred.user.getIdToken()
      const initialResult = await requestVerificationEmail(idToken, lang)
      await signOut(auth)
      onPendingVerification({ variant: 'signup', email: cred.user.email ?? email.trim(), idToken, initialResult })
    } catch (err) {
      if (auth.currentUser && !auth.currentUser.emailVerified) await signOut(auth).catch(() => {})
      setError(getAuthErrorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit}>
      {error && <Notice>{error}</Notice>}

      <TextField
        label={t('signup_fullNameLabel')}
        icon="user"
        value={fullName}
        onChange={(e) => {
          setFullName(e.target.value)
          clearFieldError('fullName')
        }}
        error={fieldErrors.fullName}
        autoComplete="name"
        autoCapitalize="words"
        enterKeyHint="next"
      />
      <TextField
        label={t('signup_emailLabel')}
        icon="mail"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoCapitalize="none"
        autoComplete="email"
        enterKeyHint="next"
      />
      <TextField
        label={t('signup_passwordLabel')}
        icon="lock"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        enterKeyHint="next"
      />

      <div className="mb-4">
        <p id="signup-customer-type" className="mb-2 text-[13px] font-semibold text-slate-700">
          {t('signup_customerTypeLabel')}
        </p>
        <div role="radiogroup" aria-labelledby="signup-customer-type" className="flex flex-wrap gap-2">
          {CUSTOMER_TYPES.map((option) => {
            const selected = option.value === customerType
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  setCustomerType(option.value)
                  clearFieldError('customerType')
                }}
                className={`min-h-10 px-3.5 rounded-full border text-sm font-semibold cursor-pointer select-none ${
                  selected ? 'border-brand bg-brandLight text-brand' : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}
              >
                {t(option.labelKey)}
              </button>
            )
          })}
        </div>
        {fieldErrors.customerType && (
          <p role="alert" className="mt-1.5 text-xs font-semibold text-red-600">
            {fieldErrors.customerType}
          </p>
        )}
      </div>

      <TextField
        label={t('signup_phoneLabel')}
        icon="phone"
        type="tel"
        value={phone}
        onChange={(e) => {
          setPhone(e.target.value)
          clearFieldError('phone')
        }}
        error={fieldErrors.phone}
        hint={t('signup_phoneNote')}
        placeholder="+972 50 123 4567"
        inputMode="tel"
        autoComplete="tel"
        enterKeyHint="go"
      />

      <div className="mt-2">
        <Button
          type="submit"
          label={submitting ? t('signup_submitBtnBusy') : t('signup_submitBtn')}
          busy={submitting}
          disabled={!email || !password}
          large
          arrow
        />
      </div>
    </form>
  )
}
