'use client'

import { useState } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  required?: boolean
  minLength?: number
}

// Masked by default (shoulder-surfing/screen-share protection) with a
// click-to-reveal toggle, since the admin still needs to read this value
// back to relay it to the business owner.
export default function PasswordField({ value, onChange, required, minLength }: Props) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        required={required}
        minLength={minLength}
        className="inp inp-dark !py-3.5 pr-12"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 px-4 text-slate-400 hover:text-slate-200"
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        <i className={`fa-solid ${visible ? 'fa-eye-slash' : 'fa-eye'} text-sm`} aria-hidden="true" />
      </button>
    </div>
  )
}
