import { useAdminT } from '@/lib/admin/translations'
import type { QuotaStatus } from '@/lib/usage/quota'

const BAR = { ok: 'bg-emerald-500', warn: 'bg-amber-500', critical: 'bg-[#DC2626]' } as const
const TEXT = { ok: 'text-adm-muted', warn: 'text-adm-warn', critical: 'text-adm-danger' } as const

/** Lifetime sent against the purchased package: emerald below 80%, amber from 80%, red from 95% or with nothing left. */
export default function QuotaMeter({ service, pct, status }: { service: string; pct: number; status: QuotaStatus }) {
  const { t } = useAdminT()
  const shown = Math.round(pct)
  const width = Math.min(Math.max(pct, 0), 100)
  return (
    <div className="flex items-center gap-2">
      <div
        role="meter"
        aria-label={t('usage.quota.meterAria', { service })}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(shown, 100)}
        aria-valuetext={t('usage.quota.meterValue', { pct: shown })}
        className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-adm-raised"
      >
        <div className={`h-full rounded-full ${BAR[status]}`} style={{ inlineSize: `${width}%` }} />
      </div>
      <span className={`shrink-0 text-xs font-medium tabular-nums ${TEXT[status]}`}>
        <bdi dir="ltr">{shown}%</bdi>
      </span>
    </div>
  )
}
