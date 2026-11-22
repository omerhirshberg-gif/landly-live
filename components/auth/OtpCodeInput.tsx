'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { mergeOtpInput, normalizeOtpInput, OTP_LENGTH } from '@/lib/auth/otp'

export interface OtpCodeInputHandle {
  focus: () => void
  /** Drops the keyboard for good: the field is not refocused when it is enabled again. */
  blur: () => void
  /** A wrong code: a short sideways shake (a CSS keyframe, off under prefers-reduced-motion). */
  shake: () => void
}

// Six drawn boxes over one real input (the app twin is
// landly-mobile/src/components/OtpCodeInput.tsx): iOS/Android one-time-code
// autofill, a paste ("482 913", "482-913", a whole message) and screen readers
// all meet a single field, the value is one string, and Backspace simply
// removes the last digit. mergeOtpInput turns whatever arrives into at most
// six digits, and a paste replaces the value outright. The boxes read
// left-to-right in every language (dir="ltr"). While `disabled` (a request is
// out) the input is off; once it is on again the focus returns if it had been
// in the field, so a wrong code or a resend never leaves the member clicking
// the boxes. The input is 16px, so iOS Safari never zooms into it.
const OtpCodeInput = forwardRef<OtpCodeInputHandle, {
  value: string
  onChange: (next: string) => void
  error?: boolean
  disabled?: boolean
  label: string
}>(function OtpCodeInput({ value, onChange, error = false, disabled = false, label }, ref) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  const [shakes, setShakes] = useState(0)
  const keyboardUp = useRef(false)

  useImperativeHandle(
    ref,
    () => ({
      focus: () => inputRef.current?.focus(),
      blur: () => {
        keyboardUp.current = false
        inputRef.current?.blur()
      },
      shake: () => setShakes((n) => n + 1),
    }),
    []
  )

  useEffect(() => {
    if (!disabled && keyboardUp.current) inputRef.current?.focus()
  }, [disabled])

  return (
    <div className="relative" dir="ltr" onClick={() => inputRef.current?.focus()}>
      {/* A new key restarts the keyframe on every wrong code. */}
      <div key={shakes} className={`grid grid-cols-6 gap-2 ${shakes ? 'otp-shake' : ''}`} aria-hidden="true">
        {Array.from({ length: OTP_LENGTH }, (_, i) => {
          const active = focused && (i === value.length || (i === OTP_LENGTH - 1 && value.length === OTP_LENGTH))
          return (
            <span
              key={i}
              className={`flex h-14 items-center justify-center rounded-[12px] border-[1.5px] bg-white text-2xl font-bold text-slate-900 transition-colors ${
                error ? 'border-red-300' : active ? 'border-brand ring-2 ring-brand/15' : value[i] ? 'border-slate-300' : 'border-slate-200'
              }`}
            >
              {value[i] ?? ''}
            </span>
          )
        })}
      </div>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        enterKeyHint="done"
        pattern="[0-9]*"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label={label}
        aria-invalid={error || undefined}
        value={value}
        onChange={(e) => onChange(mergeOtpInput(value, e.target.value))}
        onPaste={(e) => {
          const pasted = normalizeOtpInput(e.clipboardData.getData('text'))
          if (!pasted) return
          e.preventDefault()
          onChange(pasted)
        }}
        onFocus={() => {
          keyboardUp.current = true
          setFocused(true)
        }}
        onBlur={() => {
          // An input switched off by `disabled` loses focus without the member leaving it.
          if (!disabled) keyboardUp.current = false
          setFocused(false)
        }}
        disabled={disabled}
        className="otp-input"
      />
    </div>
  )
})

export default OtpCodeInput
