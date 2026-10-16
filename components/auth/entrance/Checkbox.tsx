'use client'

import type { ReactNode } from 'react'

// Web counterpart of landly-mobile/src/components/Checkbox.tsx, on a real
// (visually hidden) checkbox input so keyboard and form semantics stay native.
// A label may hold links (the sign-up consent line): clicking one follows it
// without toggling the box. `invalid` marks the box red and names the error.
export default function Checkbox({
  label,
  checked,
  onChange,
  invalid,
  describedBy,
}: {
  label: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  invalid?: boolean
  describedBy?: string
}) {
  return (
    <label className="relative flex items-center gap-2 py-3 -my-3 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={`flex shrink-0 items-center justify-center h-5 w-5 rounded-md border-[1.5px] peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40 ${
          checked ? 'bg-brand border-brand' : invalid ? 'bg-white border-red-500' : 'bg-white border-slate-400'
        }`}
      >
        {checked && (
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </span>
      <span className="text-[13px] font-semibold text-slate-700">{label}</span>
    </label>
  )
}
