'use client'

import DashboardSectionCard from '@/components/business/DashboardSectionCard'
import { useBusinessLang } from '@/lib/business/BusinessLangProvider'

interface RedeemedVoucher {
  id: string
  offerTitle: string
  redeemedAt: string | null
}

const LIMIT = 5

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

// The 5 most recent rows of the same redeemed-vouchers data behind the full
// Redemption History page -- a quick-glance feed, not a replacement for it.
export default function RecentActivityList({
  vouchers,
  error,
}: {
  vouchers: RedeemedVoucher[] | null
  error: string | null
}) {
  const { t } = useBusinessLang()
  const recent = vouchers?.slice(0, LIMIT) ?? null

  return (
    <DashboardSectionCard title={t('bizdash_section_recent_activity')}>
      {error && <p className="text-sm font-semibold text-red-400">{error}</p>}
      {!error && recent === null && <p className="text-slate-400 text-sm">{t('bizdash_loading')}</p>}
      {!error && recent?.length === 0 && <p className="text-slate-500 text-sm">{t('bizdash_recent_activity_empty')}</p>}
      {recent && recent.length > 0 && (
        <ul className="divide-y divide-white/5">
          {recent.map((v) => (
            <li key={v.id} className="py-2.5 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
              <span className="text-white font-semibold text-sm truncate">{v.offerTitle}</span>
              <span className="text-slate-500 text-xs font-semibold shrink-0" dir="ltr">
                {formatDate(v.redeemedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </DashboardSectionCard>
  )
}
