'use client'

import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { useLang } from '@/lib/i18n/useLang'

// Web counterpart of landly-mobile/src/components/TextField.tsx: label, a
// 52px field with a leading outline icon, a focus ring, and an eye toggle on
// password fields. `error` replaces `hint` below the field and turns it red.
// Email, password and phone values are typed left-to-right even in Hebrew;
// free text (type="text", e.g. a name) follows the page direction.
// `prefix` sits inside the field before the value (the phone country code).
// On focus the field box (never the text itself, which would blur) grows to
// 1.025 with the brand border and halo — a transform, so nothing around it
// moves. No permanent will-change: with it the browser keeps the box as a
// bitmap rasterized at 1.0 and stretches it, leaving the typed text soft;
// without it the text is re-rasterized crisp at 1.025 once the transition
// settles. Reduced motion keeps the colour change only (mobile: TextField.tsx).
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
  icon,
  hint,
  error,
  prefix,
  type = 'text',
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> & {
  label: string
  icon?: keyof typeof ICONS
  hint?: string
  error?: string | null
  prefix?: ReactNode
}) {
  const { t } = useLang()
  const id = useId()
  const [revealed, setRevealed] = useState(false)
  const password = type === 'password'
  const iconColor = error ? 'stroke-red-600' : 'stroke-slate-400 group-focus-within:stroke-brand'
  return (
    <div className="mb-4">
      <label htmlFor={id} className="block mb-2 text-[13px] font-semibold text-slate-700">
        {label}
      </label>
      <div
        className={`group flex items-center h-[52px] px-3.5 sm:px-4 rounded-[14px] border bg-slate-50 cursor-text [transition:transform_200ms_cubic-bezier(0.16,1,0.3,1),box-shadow_200ms_ease,border-color_200ms_ease,background-color_200ms_ease] focus-within:scale-[1.025] motion-reduce:focus-within:scale-100 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(0,56,184,0.12),0_8px_20px_-8px_rgba(0,56,184,0.28)] ${
          error ? 'border-red-600' : 'border-slate-200 focus-within:border-brand'
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
          dir={type === 'text' ? undefined : 'ltr'}
          className="flex-1 min-w-0 h-full bg-transparent border-0 p-0 text-base text-slate-900 placeholder:text-slate-400 outline-none focus:ring-0"
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
        <p role="alert" className="mt-1.5 text-xs font-semibold text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs leading-[17px] text-slate-500">{hint}</p>
      ) : null}
    </div>
  )
}
