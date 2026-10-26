'use client'

import { Globe, Phone, Store, type LucideIcon } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'
import { REDEMPTION_METHOD_LABEL_KEYS, type RedemptionMethod } from '@/lib/offers/redemption'

export const REDEMPTION_METHOD_ICONS: Record<RedemptionMethod, LucideIcon> = {
  in_store: Store,
  online: Globe,
  phone_booking: Phone,
}

/** "In store" / "Online" / "By phone" as a small chip. */
export default function RedemptionBadge({ method, className = '' }: { method: RedemptionMethod; className?: string }) {
  const { t } = useLang()
  const Icon = REDEMPTION_METHOD_ICONS[method]
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-micro font-semibold leading-none text-body ${className}`}
    >
      <Icon aria-hidden="true" className="h-3 w-3 text-brand" strokeWidth={2} />
      {t(REDEMPTION_METHOD_LABEL_KEYS[method])}
    </span>
  )
}
