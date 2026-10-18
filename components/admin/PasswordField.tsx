'use client'

import { useState } from 'react'
import { ADMIN_INPUT } from './formStyles'

interface Props {
  id?: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  minLength?: number
  autoComplete?: string
  autoFocus?: boolean
  /** Font Awesome icon shown at the start of the field. */
  icon?: string
  /** Id of an error message describing this field, marking it invalid. */
  errorId?: string
}

// Masked by default (shoulder-surfing/screen-share protection) with a
// click-to-reveal toggle, since the admin still needs to read this value
// back to relay it to the business owner.
export default function PasswordField({ id, value, onChange, required, minLength, autoComplete, autoFocus, icon, errorId }: Props) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      {icon && (
        <i
          className={`fa-solid ${icon} pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]`}
          aria-hidden="true"
        />
      )}
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        aria-invalid={errorId ? true : undefined}
        aria-describedby={errorId}
        dir="ltr"
        className={`${ADMIN_INPUT} pe-12 ${icon ? 'ps-11' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 end-0 flex w-12 items-center justify-center rounded-e-xl text-[#94A3B8] transition-colors hover:text-[#0038B8] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[#0038B8]"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        <i className={`fa-solid ${visible ? 'fa-eye-slash' : 'fa-eye'} text-sm`} aria-hidden="true" />
      </button>
    </div>
  )
}
