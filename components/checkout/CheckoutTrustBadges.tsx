'use client'

import { useLang } from '@/lib/i18n/useLang'

const BADGES = [
  { icon: 'fa-shield-halved', key: 'checkout_trust_secure', tint: 'bg-[#F0F7FF] text-[#0038B8]' },
  { icon: 'fa-bolt', key: 'checkout_trust_instant', tint: 'bg-emerald-50 text-emerald-600' },
  { icon: 'fa-mobile-screen', key: 'checkout_trust_digital', tint: 'bg-violet-50 text-violet-600' },
] as const

// Three reassurances under the checkout summary: an encrypted payment, the
// voucher issued right after it (the webhook creates it on confirmation),
// and a pass that lives on the phone. Side by side from 640px, stacked on
// narrow phones.
export default function CheckoutTrustBadges({ className = '' }: { className?: string }) {
  const { t } = useLang()
  return (
    <ul className={`grid gap-2 sm:grid-cols-3 sm:gap-3 ${className}`}>
      {BADGES.map(({ icon, key, tint }) => (
        <li key={key} className="flex items-center gap-3 rounded-2xl bg-white/80 px-3 py-2.5 ring-1 ring-slate-200/70 sm:flex-col sm:items-center sm:gap-2 sm:py-3 sm:text-center">
          <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tint}`}>
            <i className={`fa-solid ${icon} text-sm`} aria-hidden="true"></i>
          </span>
          <span className="text-xs font-semibold leading-snug text-slate-700">{t(key)}</span>
        </li>
      ))}
    </ul>
  )
}
