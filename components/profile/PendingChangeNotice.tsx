'use client'

import { useEffect, useRef, useState, type ComponentType } from 'react'
import { useLang } from '@/lib/i18n/useLang'

const EXIT_MS = 200

// The amber "Verification required" card under the email or phone row on
// /profile (app: components/PendingChangeNotice.tsx), shown while
// users/{uid}.pendingEmail / pendingPhone is set. `message` holds a
// placeholder ({email} or {phone}) where the pending value goes, isolated as
// LTR with <bdi> so "+1 415…" or an address never reverses inside Hebrew.
// It opens and closes by its own height (globals.css .pending-notice), and
// stays mounted through the close so the last value fades out with it.
// Phones stack the text over the buttons; from 640px they share one row.
export default function PendingChangeNotice({
  show,
  message,
  placeholder,
  value,
  icon: Icon,
  actionLabel,
  onAction,
  actionBusy,
  onCancel,
  cancelBusy,
  status,
}: {
  show: boolean
  message: string
  placeholder: '{email}' | '{phone}'
  value: string
  /** The leading icon: a Lucide glyph, or a brand mark (components/ui/SocialIcon.tsx). */
  icon: ComponentType<{ className?: string; strokeWidth?: number }>
  actionLabel: string
  onAction: () => void
  actionBusy?: boolean
  onCancel: () => void
  cancelBusy?: boolean
  /** A one-line result under the card ("A new link is on its way.", or an error). */
  status?: { tone: 'info' | 'error'; text: string } | null
}) {
  const { t } = useLang()
  const [mounted, setMounted] = useState(show)
  const [open, setOpen] = useState(false)
  const lastValue = useRef(value)
  if (value) lastValue.current = value

  useEffect(() => {
    if (show) {
      setMounted(true)
      // Two frames, so the closed state is painted before it opens and the transition runs.
      let inner = 0
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setOpen(true))
      })
      return () => {
        cancelAnimationFrame(outer)
        cancelAnimationFrame(inner)
      }
    }
    setOpen(false)
    const timer = setTimeout(() => setMounted(false), EXIT_MS)
    return () => clearTimeout(timer)
  }, [show])

  if (!mounted) return null

  const [before, after = ''] = message.split(placeholder)
  const busy = actionBusy || cancelBusy

  return (
    <div className="pending-notice" data-state={open ? 'open' : 'closed'}>
      <div>
        <div className="pt-3">
          <div
            role="status"
            className="bg-amber-50 text-amber-900 border border-amber-200 rounded-xl p-3 text-sm flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="flex items-start gap-2.5 min-w-0 leading-5">
              <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" strokeWidth={1.75} />
              <span className="min-w-0">
                <span className="font-bold">{t('pending_title')}: </span>
                {before}
                <bdi dir="ltr" className="font-semibold [overflow-wrap:anywhere]">{lastValue.current}</bdi>
                {after}
              </span>
            </p>
            <div className="flex items-center justify-end gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={onCancel}
                disabled={busy}
                className="tap-target px-3 rounded-[12px] text-xs font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-950 disabled:opacity-60"
              >
                {t('pending_cancel')}
              </button>
              <button
                type="button"
                onClick={onAction}
                disabled={busy}
                aria-busy={actionBusy}
                className="tap-target inline-flex items-center justify-center h-11 px-4 rounded-[12px] bg-white border border-amber-300 text-amber-900 text-sm font-semibold hover:bg-amber-100 transition-colors disabled:opacity-60"
              >
                {actionBusy ? '…' : actionLabel}
              </button>
            </div>
          </div>
          {status && (
            <p role={status.tone === 'error' ? 'alert' : 'status'} className={`mt-1.5 text-xs font-semibold ${status.tone === 'error' ? 'text-red-600' : 'text-amber-800'}`}>
              {status.text}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
