'use client'

import { useEffect, useRef, useState } from 'react'
import { formatPhoneNumberIntl } from 'react-phone-number-input'
import type { User } from 'firebase/auth'
import { Mail, MessageSquareText, X } from 'lucide-react'
import { WhatsAppIcon } from '@/components/ui/SocialIcon'
import {
  CONTACT_CHANGE_FAILED,
  contactChangeErrorKey,
  finishEmailChange,
  requestPhoneChange,
  requestSignupOtp,
  resendEmailChange,
  resendEndsChange,
  verifyEmailCode,
  verifyPhoneCode,
  verifySignupCode,
  type ContactChangeFailure,
  type ContactChangeResult,
  type SignupOtpStart,
} from '@/lib/account/contactChange'
import { auth } from '@/lib/firebase/config'
import { formatOtpCountdown, isOtpChannel, OTP_LENGTH, OTP_RESEND_SECONDS, type OtpChannel, type OtpTarget } from '@/lib/auth/otp'
import { otpCopyKeys, resolveOtpChannel, splitAtPlaceholder } from '@/lib/auth/otpChannel'
import { useResendCountdown } from '@/lib/auth/useResendCountdown'
import { useLang } from '@/lib/i18n/useLang'
import OtpCodeInput, { type OtpCodeInputHandle } from '@/components/auth/OtpCodeInput'

// The 6-digit code for a pending change on /profile (app:
// components/OtpSheet.tsx): "Verify via SMS" (Israeli numbers) or "Verify via WhatsApp" for a new phone number, or
// the code emailed to a new address. A native <dialog> opened with
// showModal() (top layer, focus kept inside, Esc closes), centred from
// 640px and near the top on phones so the keyboard never covers it.
//
// The code field is OtpCodeInput: one real input over six drawn boxes, so
// iOS/Android one-time-code autofill, paste ("123 456" or a whole message)
// and screen readers all meet a single field; the sixth digit submits, and a
// wrong code shakes the boxes, clears them and keeps the focus in the field.
// "Resend code" counts down 60 seconds (m:ss) after every send.
//
// With `signup` it confirms a brand-new account instead of a profile change:
// the session is the sign-up's own ID token (the member is signed out until
// the code is right), the code goes through /api/auth/verify-signup-otp, and
// `onVerified` receives the custom token the server mints so a caller without
// the password can still sign in.
export default function OtpDialog({
  user,
  signup,
  target,
  resendIn,
  onClose,
  onVerified,
  onEnded,
}: {
  /** The signed-in member (profile changes); a sign-up has none and passes `signup`. */
  user?: User
  /** Confirms a new account: where the ID token comes from, and the send (or cooldown lookup) already in flight. */
  signup?: { getIdToken: () => Promise<string>; initialSend?: Promise<ContactChangeResult<SignupOtpStart>> }
  /** The pending E.164 number or email address. */
  target: OtpTarget
  /** Seconds before "Resend code" is allowed (from the send that opened this). */
  resendIn: number
  onClose: () => void
  onVerified: (customToken?: string) => void
  /** A resend ended the change (resendEndsChange): closes here, and the profile screen shows `message`. */
  onEnded: (message: string) => void
}) {
  const { t, lang } = useLang()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<OtpCodeInputHandle>(null)
  const inFlight = useRef(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // SMS for an Israeli number, WhatsApp elsewhere: decided by the number, confirmed by the server's answer on a resend.
  const [channel, setChannel] = useState<OtpChannel>(() => (target.kind === 'phone' ? resolveOtpChannel(target.phone) : 'whatsapp'))
  const copy = otpCopyKeys(channel)
  const { secondsLeft, restart } = useResendCountdown(resendIn)
  const getToken = () => (signup ? signup.getIdToken() : user!.getIdToken())
  const errorKind = signup ? 'signup' : target.kind

  // A sign-up's first code is still being sent when the dialog opens (or the cooldown is being looked up).
  const initialSend = signup?.initialSend
  useEffect(() => {
    if (!initialSend) return
    let live = true
    initialSend.then((result) => {
      if (!live) return
      if (result.ok) {
        restart(result.resendIn)
        return
      }
      restart(result.retryAfter ?? 0)
      if (result.reason !== 'rateLimited') setError(t(contactChangeErrorKey(result.reason, 'signup')))
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per send
  }, [initialSend])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!dialog.open) dialog.showModal()
    inputRef.current?.focus()
    const root = document.documentElement
    const previousOverflow = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = previousOverflow
      if (dialog.open) dialog.close()
      opener?.focus({ preventScroll: true })
    }
  }, [])

  const isEmail = target.kind === 'email'
  const display = target.kind === 'email' ? target.email : formatPhoneNumberIntl(target.phone) || target.phone

  const failure = (result: ContactChangeFailure) => {
    const message = t(contactChangeErrorKey(result.reason, errorKind))
    return result.reason === 'invalidCode' && result.attemptsLeft
      ? `${message} ${t('otp_attempts_left').replace('{count}', String(result.attemptsLeft))}`
      : message
  }

  const verify = async (value: string) => {
    if (value.length !== OTP_LENGTH || busy || inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    setNotice(null)
    const idToken = await getToken().catch(() => null)
    const result = !idToken
      ? CONTACT_CHANGE_FAILED
      : await (signup ? verifySignupCode(idToken, value) : isEmail ? verifyEmailCode(idToken, value) : verifyPhoneCode(idToken, value)).catch(() => CONTACT_CHANGE_FAILED)
    inFlight.current = false
    if (result.ok) {
      // Every session just ended with the email change; this one signs back in.
      if (!signup && isEmail) await finishEmailChange(auth, user!, 'customToken' in result ? result.customToken : undefined).catch(() => {})
      setBusy(false)
      inputRef.current?.blur()
      onVerified(signup && 'customToken' in result ? result.customToken : undefined)
      return
    }
    // Wrong, expired or unreachable: shake, empty the boxes; the field takes the focus back once it is enabled.
    setBusy(false)
    setError(failure(result))
    setCode('')
    inputRef.current?.shake()
  }

  const resend = async () => {
    if (secondsLeft > 0 || resending) return
    setResending(true)
    setError(null)
    setNotice(null)
    const idToken = await getToken().catch(() => null)
    const result = !idToken
      ? CONTACT_CHANGE_FAILED
      : await (signup
          ? requestSignupOtp(idToken, { lang })
          : target.kind === 'email'
            ? resendEmailChange(idToken, lang)
            : requestPhoneChange(idToken, { phone: target.phone, lang })
        ).catch(() => CONTACT_CHANGE_FAILED)
    setResending(false)
    if (result.ok) {
      if ('mode' in result && result.mode === 'direct') {
        onClose()
        return
      }
      restart(('resendIn' in result && result.resendIn) || OTP_RESEND_SECONDS)
      const sentVia: OtpChannel = 'channel' in result && isOtpChannel(result.channel) ? result.channel : channel
      setChannel(sentVia)
      setCode('')
      // LRI…PDI: the number or address stays left-to-right inside a Hebrew sentence.
      setNotice(isEmail ? t('pending_email_body').replace('{email}', `⁦${display}⁩`) : t(otpCopyKeys(sentVia).pendingBody).replace('{phone}', `⁦${display}⁩`))
      inputRef.current?.focus()
      return
    }
    if (!signup && resendEndsChange(result.reason)) {
      onEnded(failure(result))
      return
    }
    if (result.retryAfter) restart(result.retryAfter)
    setError(failure(result))
  }

  const onChange = (next: string) => {
    setCode(next)
    setError(null)
    if (next.length === OTP_LENGTH) verify(next)
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="otp-dialog-title"
      aria-describedby="otp-dialog-subtitle"
      className="otp-dialog"
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onClose()
      }}
    >
      <div className="relative p-6">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label={t('otp_close')}
          className="tap-target absolute top-3 end-3 inline-flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        >
          <X aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
        </button>

        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl border ${isEmail || channel === 'sms' ? 'border-sky-200/60 bg-brandTint text-brand' : 'border-emerald-200/70 bg-[#E7F8EE] text-[#128C4B]'}`}
          aria-hidden="true"
        >
          {isEmail ? <Mail aria-hidden="true" className="h-6 w-6" strokeWidth={1.75} /> : channel === 'sms' ? <MessageSquareText aria-hidden="true" className="h-6 w-6" strokeWidth={1.75} /> : <WhatsAppIcon className="h-6 w-6" />}
        </div>
        <h2 id="otp-dialog-title" className="mt-4 pe-10 text-lg font-bold text-slate-900">{t(signup ? 'otp_signup_title' : isEmail ? 'otp_email_title' : copy.title)}</h2>
        <p id="otp-dialog-subtitle" className="mt-1 text-sm text-slate-500">
          {isEmail ? t(signup ? 'otp_signup_subtitle' : 'otp_email_subtitle') : splitAtPlaceholder(t(copy.subtitle), '{phone}')[0]}
          {isEmail && ' '}
          {/* An address may be long: it wraps anywhere; a number never breaks. */}
          <bdi dir="ltr" className={`font-semibold text-slate-700 ${isEmail ? '[overflow-wrap:anywhere]' : 'whitespace-nowrap'}`}>{display}</bdi>
          {!isEmail && splitAtPlaceholder(t(copy.subtitle), '{phone}')[1]}
        </p>

        <form
          className="mt-5"
          onSubmit={(e) => {
            e.preventDefault()
            verify(code)
          }}
        >
          <OtpCodeInput ref={inputRef} value={code} onChange={onChange} error={!!error} disabled={busy} label={t('otp_input_label')} />

          {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
          {notice && !error && <p role="status" className="mt-3 text-sm font-semibold text-emerald-700">{notice}</p>}

          <button type="submit" disabled={busy || code.length !== OTP_LENGTH} aria-busy={busy} className="ds-btn ds-btn-primary ds-btn-md w-full mt-5">
            {busy ? '…' : t('otp_verify_btn')}
          </button>
          <button
            type="button"
            onClick={resend}
            disabled={secondsLeft > 0 || resending || busy}
            className="tap-target w-full mt-2 rounded-[12px] text-sm font-semibold text-brand hover:bg-brandLight/60 transition-colors disabled:text-slate-400 disabled:hover:bg-transparent"
          >
            {resending ? '…' : secondsLeft > 0 ? t('otp_resend_in').replace('{time}', formatOtpCountdown(secondsLeft)) : t('otp_resend_btn')}
          </button>
        </form>
      </div>
    </dialog>
  )
}
