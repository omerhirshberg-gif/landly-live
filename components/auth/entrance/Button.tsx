'use client'

import type { ButtonHTMLAttributes } from 'react'

// Web counterpart of landly-mobile/src/components/Button.tsx: press feedback
// lands on press-in (scale 0.98 + the darker fill), a gentle 1.01 lift on
// hover only where a real pointer can hover, all on the onboarding's silk
// curve (lib/brand/onboardingMotion.ts), and an optional trailing forward
// arrow (flips in RTL).
export default function Button({
  label,
  busy,
  disabled,
  variant = 'primary',
  large,
  arrow,
  type = 'button',
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  label: string
  busy?: boolean
  variant?: 'primary' | 'secondary'
  /** Taller, bolder hero CTA with a soft brand shadow. */
  large?: boolean
  /** Trailing forward arrow. */
  arrow?: boolean
}) {
  const primary = variant === 'primary'
  const inactive = disabled || busy
  return (
    <button
      type={type}
      disabled={inactive}
      aria-busy={busy || undefined}
      className={[
        'w-full flex items-center justify-center px-5 select-none transition-[transform,background-color,box-shadow] duration-[220ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transform-none',
        // The design-system geometry (globals.css .ds-btn / .ds-btn-md): 52px or 48px, 14px corners.
        large ? 'min-h-[52px] rounded-[14px]' : 'min-h-[48px] rounded-[14px]',
        primary
          ? 'bg-brand text-white [@media(hover:hover)]:hover:enabled:bg-brandDark active:enabled:bg-brandDark'
          : 'bg-white text-ink border border-line [@media(hover:hover)]:hover:enabled:border-slate-300 [@media(hover:hover)]:hover:enabled:text-brand active:enabled:bg-brandLight',
        primary && large && !inactive && 'shadow-[0_8px_20px_-8px_rgba(0,56,184,0.55)]',
        inactive ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer [@media(hover:hover)]:hover:scale-[1.01] active:scale-[0.98]',
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {busy && (
        <span
          aria-hidden="true"
          className={`me-2 h-5 w-5 rounded-full border-2 border-current border-r-transparent animate-spin ${primary ? 'text-white' : 'text-brand'}`}
        />
      )}
      <span className={large ? 'text-[17px] font-extrabold tracking-[0.2px]' : 'text-base font-bold'}>{label}</span>
      {arrow && !busy && (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="ms-2.5 rtl:-scale-x-100">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      )}
    </button>
  )
}
