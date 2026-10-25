import type { MeterStatus } from '@/lib/usage/usageReport'

const BAR = { ok: 'bg-emerald-500', warn: 'bg-amber-500', over: 'bg-[#DC2626]' } as const
const TEXT = { ok: 'text-[#64748B]', warn: 'text-amber-700', over: 'text-[#B91C1C]' } as const

/** How much of a free monthly allowance is used: green, amber from 80%, red once units are billed. */
export default function FreeTierMeter({ service, coverage, status }: { service: string; coverage: number; status: MeterStatus }) {
  const pct = Math.round(coverage * 100)
  return (
    <div className="mt-2 flex items-center gap-2">
      <div
        role="meter"
        aria-label={`${service}: free tier used`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(pct, 100)}
        aria-valuetext={`${pct}% of the free tier`}
        className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#E2E8F0]"
      >
        <div className={`h-full rounded-full ${BAR[status]}`} style={{ inlineSize: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={`shrink-0 text-xs font-medium tabular-nums ${TEXT[status]}`}>
        <bdi dir="ltr">{pct}%</bdi>
      </span>
    </div>
  )
}
