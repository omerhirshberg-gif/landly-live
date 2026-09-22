'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input'
import { createUserWithEmailAndPassword, signInWithPopup, signOut, updateProfile } from 'firebase/auth'
import AuthMarketingPanel from '@/components/auth/AuthMarketingPanel'
import BackToHomeLink from '@/components/auth/BackToHomeLink'
import GoogleButton from '@/components/auth/GoogleButton'
import VerifyEmailNotice from '@/components/auth/VerifyEmailNotice'
import BusinessAccountNotice from '@/components/auth/BusinessAccountNotice'
import { auth, googleProvider } from '@/lib/firebase/config'
import { getAuthErrorMessage } from '@/lib/firebase/authErrors'
import { requestVerificationEmail, type VerificationSendResult } from '@/lib/auth/requestVerificationEmail'
import { createUserDocument, ensureUserDocument } from '@/lib/firebase/users'
import { signOutIfBusinessAccount } from '@/lib/firebase/businesses'
import { useLang } from '@/lib/i18n/useLang'
import { CUSTOMER_TYPES } from '@/lib/customerTypes'

export default function SignupPage() {
  const { t, isRtl, lang } = useLang()
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [customerType, setCustomerType] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [businessAccount, setBusinessAccount] = useState(false)
  const [pendingVerification, setPendingVerification] = useState<{ email: string; idToken: string; sendResult: VerificationSendResult } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusinessAccount(false)
    if (!phone || !isValidPhoneNumber(phone)) {
      setPhoneError(t('phone_invalid_error'))
      return
    }
    setPhoneError(null)
    setSubmitting(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      const trimmedName = fullName.trim()
      if (trimmedName) {
        await updateProfile(cred.user, { displayName: trimmedName })
      }
      await createUserDocument(cred.user, { phone, customerType, preferredLanguage: lang })
      // Email+password accounts stay locked until the emailed link is
      // clicked: send it, then sign out so the app never treats this session
      // as logged in. The token is kept only to authorize a resend.
      const idToken = await cred.user.getIdToken()
      const sendResult = await requestVerificationEmail(idToken, lang)
      await signOut(auth)
      setPendingVerification({ email: cred.user.email ?? email, idToken, sendResult })
      setSubmitting(false)
    } catch (err) {
      if (auth.currentUser && !auth.currentUser.emailVerified) await signOut(auth).catch(() => {})
      setError(getAuthErrorMessage(err))
      setSubmitting(false)
    }
  }

  const handleGoogle = async () => {
    setError(null)
    setBusinessAccount(false)
    try {
      const cred = await signInWithPopup(auth, googleProvider)
      // Google here also signs in existing accounts -- reject a business
      // before ensureUserDocument can give it a customer profile.
      if (await signOutIfBusinessAccount(cred.user.uid)) {
        setBusinessAccount(true)
        return
      }
      await ensureUserDocument(cred.user, { preferredLanguage: lang })
      router.push('/')
    } catch (err) {
      setError(getAuthErrorMessage(err))
    }
  }

  return (
    <>
      {/* dir="ltr" pins physical side order (form left, marketing right) regardless
          of the active language — flex-row is otherwise direction-relative and would
          flip under document dir="rtl". RTL styling is applied per-side below instead. */}
      <div className="min-h-screen flex flex-col lg:flex-row" dir="ltr">
        {/* Form side */}
        <div dir={isRtl ? 'rtl' : 'ltr'} className="flex-1 flex items-center justify-center px-5 py-10 sm:px-10 lg:px-16 lg:py-12">
          <div className="w-full max-w-md">
            <BackToHomeLink label={t('auth_backHome')} />
            <Link href="/" className="flex justify-center mb-8">
              <img src="/logo.jpg" alt="Landly" className="h-28 w-auto" />
            </Link>

            {pendingVerification ? (
              <VerifyEmailNotice
                variant="signup"
                email={pendingVerification.email}
                idToken={pendingVerification.idToken}
                initialResult={pendingVerification.sendResult}
                onBack={() => router.push('/login')}
              />
            ) : (
              <>
              <h1 className="text-2xl font-black text-slate-900 mb-1">{t('signup_title')}</h1>
              <p className="text-sm text-slate-500 mb-7">{t('signup_subtitle')}</p>

              {error && (
                <div className="mb-4 text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              {businessAccount && (
                <BusinessAccountNotice message={t('login_businessAccountError')} linkLabel={t('login_businessAccountLink')} />
              )}

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label className="block mb-1.5 text-sm font-bold text-slate-700">{t('signup_fullNameLabel')}</label>
                  <input type="text" required className="inp" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>

                <div>
                  <label className="block mb-1.5 text-sm font-bold text-slate-700">{t('signup_emailLabel')}</label>
                  <input type="email" required className="inp" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>

                <div>
                  <label className="block mb-1.5 text-sm font-bold text-slate-700">{t('signup_passwordLabel')}</label>
                  <input type="password" required minLength={6} className="inp" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>

                <div>
                  <label className="flex items-center gap-1.5 mb-1.5 text-sm font-bold text-slate-700">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    {t('signup_customerTypeLabel')}
                  </label>
                  <select required className="inp" value={customerType} onChange={(e) => setCustomerType(e.target.value)}>
                    <option value="" disabled>{t('signup_customerType_placeholder')}</option>
                    {CUSTOMER_TYPES.map((option) => (
                      <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-1.5 text-sm font-bold text-slate-700">{t('signup_phoneLabel')}</label>
                  <PhoneInput
                    international
                    countryCallingCodeEditable={false}
                    defaultCountry="IL"
                    value={phone}
                    onChange={(value) => setPhone(value ?? '')}
                  />
                  {phoneError && <p className="text-xs text-red-600 font-semibold mt-1.5">{phoneError}</p>}
                  <p className="text-xs text-slate-500 mt-1.5">{t('signup_phoneNote')}</p>
                </div>

                <button type="submit" disabled={submitting} className="btn-primary mt-2 w-full disabled:opacity-70">
                  {submitting ? t('signup_submitBtnBusy') : t('signup_submitBtn')}
                </button>
              </form>

              <div className="flex items-center gap-3 my-5">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-semibold text-slate-400 uppercase">{t('signup_orDivider')}</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <GoogleButton label={t('signup_googleBtn')} onClick={handleGoogle} disabled={submitting} />

              <div className="text-center mt-6 text-sm">
                <span className="text-slate-500">{t('signup_haveAccount')}</span>{' '}
                <Link href="/login" className="text-brand font-bold hover:underline">{t('signup_loginLink')}</Link>
              </div>
              </>
            )}
          </div>
        </div>

        <AuthMarketingPanel headline={t('signup_marketing_headline')} sub={t('signup_marketing_sub')} />
      </div>
    </>
  )
}
