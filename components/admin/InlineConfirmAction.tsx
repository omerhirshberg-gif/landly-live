'use client'

import { useState } from 'react'

// A destructive-ish row action that asks twice, in place: the first tap swaps
// the button for "Confirm" and "Cancel" (no browser dialog, so it works the
// same in every in-app WebView). Both keep 44px touch targets. Escape or
// Cancel backs out; the parent's onConfirm does the work and reports failures.
export default function InlineConfirmAction({ label, confirmLabel, cancelLabel, ariaLabel, onConfirm, tone = 'danger' }: {
  label: string
  confirmLabel: string
  cancelLabel: string
  /** Names the row the action is about, for screen readers. */
  ariaLabel?: string
  onConfirm: () => Promise<void>
  tone?: 'danger' | 'neutral'
}) {
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const base = 'inline-flex items-center justify-center rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-adm-accent disabled:opacity-60'

  if (!asking) {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setAsking(true)}
        className={`${base} min-h-11 min-w-11 ${tone === 'danger' ? 'text-adm-danger hover:bg-adm-danger-soft' : 'text-adm-accent hover:bg-adm-accent-soft'}`}
      >
        {label}
      </button>
    )
  }
  return (
    <span role="group" aria-label={ariaLabel} onKeyDown={(event) => { if (event.key === 'Escape') setAsking(false) }} className="inline-flex items-center gap-1">
      <button
        type="button"
        autoFocus
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            await onConfirm()
          } finally {
            setBusy(false)
            setAsking(false)
          }
        }}
        className={`${base} min-h-11 min-w-11 border border-adm-danger-line bg-adm-danger-soft text-adm-danger`}
      >
        {confirmLabel}
      </button>
      <button type="button" disabled={busy} onClick={() => setAsking(false)} className={`${base} min-h-11 min-w-11 text-adm-text-2 hover:bg-adm-raised`}>
        {cancelLabel}
      </button>
    </span>
  )
}
