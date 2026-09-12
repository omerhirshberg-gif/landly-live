'use client'

import { useState } from 'react'

interface Props {
  children: string
  className?: string
}

// Masks a sensitive value (e.g. a freshly-created login password) behind a
// reveal toggle instead of printing it to the screen by default.
export default function RevealableText({ children, className }: Props) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="flex items-center gap-2">
      <span className={className}>{visible ? children : '•'.repeat(Math.max(children.length, 8))}</span>
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="text-slate-400 hover:text-slate-200"
        aria-label={visible ? 'Hide' : 'Reveal'}
      >
        <i className={`fa-solid ${visible ? 'fa-eye-slash' : 'fa-eye'} text-xs`} aria-hidden="true" />
      </button>
    </div>
  )
}
