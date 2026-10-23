'use client'

import { useEffect, useRef, useState } from 'react'
import { formatPhoneNumberIntl } from 'react-phone-number-input'
import type { User } from 'firebase/auth'
import {
  CONTACT_CHANGE_FAILED,
  contactChangeErrorKey,
  finishEmailChange,
  requestPhoneChange,
  resendEmailChange,
  verifyEmailCode,
  verifyPhoneCode,
  type ContactChangeFailure,
} from '@/lib/account/contactChange'
import { auth } from '@/lib/firebase/config'
import { normalizeOtpInput, OTP_LENGTH, type OtpTarget } from '@/lib/auth/otp'
import { useResendCountdown } from '@/lib/auth/useResendCountdown'
import { useLang } from '@/lib/i18n/useLang'

// The 6-digit code for a pending change on /profile (app:
// components/OtpSheet.tsx): "Verify via WhatsApp" for a new phone number, or
// the code emailed to a new address. A native <dialog> opened with
// showModal() (top layer, focus kept inside, Esc closes), centred from
// 640px and near the top on phones so the keyboard never covers it.
//
// One real input lies over six drawn boxes, so iOS/Android one-time-code
// autofill, paste ("123 456" or a whole message) and screen readers all
// meet a single field; the sixth digit submits. "Resend code" counts down
// 60 seconds after every send.
export default function OtpDialog({
  user,
  target,
  resendIn,
  onClose,
  onVerified,
}: {
  user: User
  /** The pending E.164 number or email address. */
  target: OtpTarget
  /** Seconds before "Resend code" is allowed (from the send that opened this). */
  resendIn: number
  onClose: () => void
  onVerified: () => void
}) {
  const { t, lang } = useLang()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [code, setCode] = useState('')
  const [focused, setFocused] = useState(false)
  const [busy, setBusy] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const { secondsLeft, restart } = useResendCountdown(resendIn)

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
    const message = t(contactChangeErrorKey(result.reason, target.kind))
    return result.reason === 'invalidCode' && result.attemptsLeft
      ? `${message} ${t('otp_attempts_left').replace('{count}', String(result.attemptsLeft))}`
      : message
  }

  const verify = async (value: string) => {
    if (value.length !== OTP_LENGTH || busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    const idToken = await user.getIdToken().catch(() => null)
    const result = !idToken
      ? CONTACT_CHANGE_FAILED
      : await (isEmail ? verifyEmailCode(idToken, value) : verifyPhoneCode(idToken, value)).catch(() => CONTACT_CHANGE_FAILED)
    if (result.ok) {
      // Every session just ended with the email change; this one signs back in.
      if (isEmail) await finishEmailChange(auth, user, 'customToken' in result ? result.customToken : undefined).catch(() => {})
      setBusy(false)
      onVerified()
      return
    }
    setBusy(false)
    setError(failure(result))
    setCode('')
    inputRef.current?.focus()
  }

  const resend = async () => {
    if (secondsLeft > 0 || resending) return
    setResending(true)
    setError(null)
    setNotice(null)
    const idToken = await user.getIdToken().catch(() => null)
    const result = !idToken
      ? CONTACT_CHANGE_FAILED
      : await (target.kind === 'email'
          ? resendEmailChange(idToken, lang)
          : requestPhoneChange(idToken, { phone: target.phone, lang, channel: 'whatsapp' })
        ).catch(() => CONTACT_CHANGE_FAILED)
    setResending(false)
    if (result.ok) {
      if ('mode' in result && result.mode === 'direct') {
        onClose()
        return
      }
      restart('resendIn' in result ? result.resendIn : 0)
      setCode('')
      // LRI…PDI: the number or address stays left-to-right inside a Hebrew sentence.
      setNotice(isEmail ? t('pending_email_body').replace('{email}', `⁦${display}⁩`) : t('pending_phone_body').replace('{phone}', `⁦${display}⁩`))
      inputRef.current?.focus()
      return
    }
    if (result.retryAfter) restart(result.retryAfter)
    setError(failure(result))
  }

  const onChange = (raw: string) => {
    const next = normalizeOtpInput(raw)
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
          <i className="fa-solid fa-xmark text-lg" aria-hidden="true"></i>
        </button>

        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full ${isEmail ? 'bg-brandLight text-brand' : 'bg-[#E7F8EE] text-[#128C4B]'}`}
          aria-hidden="true"
        >
          <i className={isEmail ? 'fa-solid fa-envelope text-xl' : 'fa-brands fa-whatsapp text-2xl'}></i>
        </div>
        <h2 id="otp-dialog-title" className="mt-4 pe-10 text-lg font-bold text-slate-900">{t(isEmail ? 'otp_email_title' : 'otp_title')}</h2>
        <p id="otp-dialog-subtitle" className="mt-1 text-sm text-slate-500">
          {t(isEmail ? 'otp_email_subtitle' : 'otp_subtitle')}{' '}
          {/* An address may be long: it wraps anywhere; a number never breaks. */}
          <bdi dir="ltr" className={`font-semibold text-slate-700 ${isEmail ? '[overflow-wrap:anywhere]' : 'whitespace-nowrap'}`}>{display}</bdi>
        </p>

        <form
          className="mt-5"
          onSubmit={(e) => {
            e.preventDefault()
            verify(code)
          }}
        >
          <div className="relative" dir="ltr" onClick={() => inputRef.current?.focus()}>
            <div className="grid grid-cols-6 gap-2" aria-hidden="true">
              {Array.from({ length: OTP_LENGTH }, (_, i) => {
                const active = focused && (i === code.length || (i === OTP_LENGTH - 1 && code.length === OTP_LENGTH))
                return (
                  <span
                    key={i}
                    className={`flex h-14 items-center justify-center rounded-[12px] border-[1.5px] bg-white text-2xl font-bold text-slate-900 transition-colors ${
                      error ? 'border-red-300' : active ? 'border-brand ring-2 ring-brand/15' : code[i] ? 'border-slate-300' : 'border-slate-200'
                    }`}
                  >
                    {code[i] ?? ''}
                  </span>
                )
              })}
            </div>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              aria-label={t('otp_input_label')}
              aria-invalid={!!error || undefined}
              value={code}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              disabled={busy}
              className="otp-input"
            />
          </div>

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
            {resending ? '…' : secondsLeft > 0 ? t('otp_resend_in').replace('{seconds}', String(secondsLeft)) : t('otp_resend_btn')}
          </button>
        </form>
      </div>
    </dialog>
  )
}
