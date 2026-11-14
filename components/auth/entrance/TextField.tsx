'use client'

import { useId, useRef, useState, type InputHTMLAttributes, type ReactNode, type Ref } from 'react'
import { useLang } from '@/lib/i18n/useLang'
import { useShake } from '@/lib/useShake'
import { directionalProps } from '@/lib/directionalInput'

// Web counterpart of landly-mobile/src/components/TextField.tsx: a 48px field
// with the field's name as a grey hint inside it (no label above; the name is
// still the input's aria-label, so screen readers and password managers read
// it), a leading outline icon, a focus ring, and an eye toggle on password
// fields. `showLabel` keeps a small label above instead, for a pair of
// fields that look alike once typed in (create / confirm password). `error` replaces `hint` below the field and turns it red.
// Email, password and phone values are typed left-to-right even in Hebrew;
// free text (type="text", e.g. a name) follows the page direction.
// `prefix` sits inside the field before the value (the phone country code).
// `shake` plays the invalid-field shake each time it goes up while there's an
// error (a submit that failed validation); the message is tied to the input
// with aria-describedby, so a screen reader reads it with the field.
// On focus the box gets the brand border and a soft ring; it does not scale.
// While the field is empty its hint follows the page direction (start edge in
// Hebrew); typed email, password and phone values are left-to-right.
const ICONS = {
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 7l-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7',
  lock: 'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM7 11V7a5 5 0 0 1 10 0v4',
  user: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  phone:
    'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
} as const
const EYE = 'M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'
const EYE_OFF =
  'M10.73 5.08A10.43 10.43 0 0 1 12 5c4.97 0 8.5 4 9.94 6.65a1 1 0 0 1 0 .7 13.16 13.16 0 0 1-1.67 2.68M14.08 14.16a3 3 0 0 1-4.24-4.24M17.48 17.5A10.75 10.75 0 0 1 2.06 12.35a1 1 0 0 1 0-.7 10.38 10.38 0 0 1 4.45-5.13M2 2l20 20'

export default function TextField({
  label,
  showLabel = false,
  icon,
  hint,
  error,
  prefix,
  shake = 0,
  type = 'text',
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> & {
  label: string
  /** A small label above the box, and no hint inside it. */
  showLabel?: boolean
  icon?: keyof typeof ICONS
  hint?: string
  error?: string | null
  prefix?: ReactNode
  shake?: number
  /** Reaches the input through ...props (React 19 passes ref as a prop). */
  ref?: Ref<HTMLInputElement>
}) {
  const { t, isRtl } = useLang()
  const id = useId()
  const [revealed, setRevealed] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  useShake(boxRef, shake, !!error)
  const messageId = error || hint ? `${id}-message` : undefined
  const password = type === 'password'
  const iconColor = error ? 'stroke-red-600' : 'stroke-slate-400 group-focus-within:stroke-brand'
  return (
    <div className="mb-4">
      {showLabel && (
        <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-slate-600">
          {label}
        </label>
      )}
      <div
        ref={boxRef}
        className={`group flex items-center h-12 px-4 rounded-xl border bg-slate-50/80 cursor-text transition-[border-color,background-color,box-shadow] duration-200 focus-within:bg-white focus-within:ring-2 ${
          error ? 'border-red-600 focus-within:ring-red-600/15' : 'border-slate-200 focus-within:border-[#0038B8] focus-within:ring-[#0038B8]/15'
        }`}
      >
        {prefix}
        {icon && (
          <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`shrink-0 me-2.5 transition-colors duration-150 ${iconColor}`}
          >
            <path d={ICONS[icon]} />
          </svg>
        )}
        <input
          id={id}
          type={password && revealed ? 'text' : type}
          aria-invalid={!!error || undefined}
          aria-describedby={messageId}
          aria-label={label}
          placeholder={showLabel ? undefined : label}
          {...directionalProps(String(props.value ?? props.defaultValue ?? ''), showLabel ? undefined : label, isRtl, type === 'text' ? 'text' : 'ltr')}
          className="flex-1 min-w-0 h-full bg-transparent border-0 p-0 text-base text-slate-900 placeholder:text-slate-400 outline-none focus:ring-0 text-start"
          {...props}
        />
        {password && (
          <button
            type="button"
            aria-label={t(revealed ? 'mobile_hidePassword' : 'mobile_showPassword')}
            aria-pressed={revealed}
            onClick={() => setRevealed((r) => !r)}
            className="shrink-0 ms-1 -me-2 p-2 rounded-lg cursor-pointer"
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={revealed ? EYE_OFF : EYE} />
            </svg>
          </button>
        )}
      </div>
      {error ? (
        <p id={messageId} role="alert" className="mt-1.5 text-xs font-semibold text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="mt-1.5 text-xs leading-[17px] text-slate-500">{hint}</p>
      ) : null}
    </div>
  )
}
