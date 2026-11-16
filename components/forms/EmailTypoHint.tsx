'use client'

import { Fragment } from 'react'
import { suggestEmail } from '@/lib/validation/emailTypo'

// "Did you mean name@icloud.com?" with a one-tap fix, under an email field.
// The text comes with an {email} placeholder (translated by the caller); the
// address is isolated in a left-to-right <bdi> so it reads correctly inside
// Hebrew. Renders nothing when the address looks fine. A hint, not an error:
// the submit is never blocked.
export default function EmailTypoHint({ value, message, actionLabel, onApply, id, className = '' }: {
  value: string
  message: string
  actionLabel: string
  onApply: (email: string) => void
  id?: string
  className?: string
}) {
  const suggestion = suggestEmail(value)
  if (!suggestion) return null
  const [before, after = ''] = message.split('{email}')
  return (
    <div
      id={id}
      role="status"
      className={`mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-sm text-slate-700 ${className}`}
    >
      <span className="min-w-0 break-words">
        <Fragment>{before}</Fragment>
        <bdi dir="ltr" className="font-semibold text-slate-900 tabular-nums">{suggestion.email}</bdi>
        <Fragment>{after}</Fragment>
      </span>
      <button
        type="button"
        onClick={() => onApply(suggestion.email)}
        className="inline-flex min-h-11 items-center rounded-lg px-3 font-semibold text-blue-700 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 sm:min-h-9"
      >
        {actionLabel}
      </button>
    </div>
  )
}
