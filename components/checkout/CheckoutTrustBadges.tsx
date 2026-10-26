'use client'

import { ShieldCheck, Smartphone, Zap } from 'lucide-react'
import IconFrame from '@/components/ui/IconFrame'
import { useLang } from '@/lib/i18n/useLang'

const BADGES = [
  { icon: ShieldCheck, key: 'checkout_trust_secure', tone: 'brand' },
  { icon: Zap, key: 'checkout_trust_instant', tone: 'success' },
  { icon: Smartphone, key: 'checkout_trust_digital', tone: 'ink' },
] as const

// Three reassurances under the checkout summary: an encrypted payment, the
// voucher issued right after it (the webhook creates it on confirmation),
// and a pass that lives on the phone. Side by side from 640px, stacked on
// narrow phones.
export default function CheckoutTrustBadges({ className = '' }: { className?: string }) {
  const { t } = useLang()
  return (
    <ul className={`grid gap-2 sm:grid-cols-3 sm:gap-3 ${className}`}>
      {BADGES.map(({ icon, key, tone }) => (
        <li key={key} className="flex items-center gap-3 rounded-2xl bg-white/80 px-3 py-2.5 ring-1 ring-slate-200/70 sm:flex-col sm:items-center sm:gap-2 sm:py-3 sm:text-center">
          <IconFrame icon={icon} size="sm" tone={tone} />
          <span className="text-xs font-semibold leading-snug text-slate-700">{t(key)}</span>
        </li>
      ))}
    </ul>
  )
}
