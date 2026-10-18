'use client'

import { useLang } from '@/lib/i18n/useLang'
import { REDEMPTION_METHOD_LABEL_KEYS, type RedemptionMethod } from '@/lib/offers/redemption'

export const REDEMPTION_METHOD_ICONS: Record<RedemptionMethod, string> = {
  in_store: 'fa-store',
  online: 'fa-globe',
  phone_booking: 'fa-phone',
}

/** "In store" / "Online" / "By phone" as a small chip. */
export default function RedemptionBadge({ method, className = '' }: { method: RedemptionMethod; className?: string }) {
  const { t } = useLang()
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#F1F5F9] px-2.5 py-1 text-[11px] font-semibold leading-none text-[#475569] ${className}`}
    >
      <i className={`fa-solid ${REDEMPTION_METHOD_ICONS[method]} text-[10px] text-[#0038B8]`} aria-hidden="true" />
      {t(REDEMPTION_METHOD_LABEL_KEYS[method])}
    </span>
  )
}
