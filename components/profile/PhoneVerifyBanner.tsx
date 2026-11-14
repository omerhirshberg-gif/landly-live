'use client'

import { Smartphone, X } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'

// The Profile page's "Complete your profile" card (app:
// components/PhoneVerifyBanner.tsx), shown while the member's phone isn't
// verified, in the manner of Apple's Settings: a plain white card with a
// hairline border, a small icon tile, a title, one line on why, and a compact
// action. The ✕ (a 44px target) hides the card for 7 days; the red "1" on the
// navigation stays until the number is verified. Logical properties only, so
// Hebrew mirrors it.
export default function PhoneVerifyBanner({
  onVerify,
  onDismiss,
  busy,
  error,
}: {
  onVerify: () => void
  onDismiss: () => void
  busy?: boolean
  error?: string | null
}) {
  const { t } = useLang()
  return (
    <section
      aria-labelledby="phone-nudge-title"
      className="relative mb-4 lg:mb-6 rounded-2xl border border-[#E2E8F0] bg-white p-4 sm:p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:pe-10">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600" aria-hidden="true">
            <Smartphone className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 pe-9 sm:pe-0">
            <h2 id="phone-nudge-title" className="text-base font-bold leading-snug text-slate-900">{t('phone_nudge_title')}</h2>
            <p className="mt-1 text-sm leading-5 text-slate-600">{t('phone_nudge_body')}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onVerify}
          disabled={busy}
          aria-busy={busy}
          className="tap-target inline-flex h-11 min-w-[7rem] flex-shrink-0 items-center justify-center self-start rounded-xl bg-brand px-5 text-sm font-semibold text-white transition-colors hover:bg-brandDark disabled:opacity-60 sm:self-auto"
        >
          {busy ? '…' : t('phone_nudge_cta')}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-red-600">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={onDismiss}
        disabled={busy}
        aria-label={t('phone_nudge_dismiss')}
        className="tap-target absolute top-0 end-0 inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-slate-600 disabled:opacity-60"
      >
        <X aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </button>
    </section>
  )
}
