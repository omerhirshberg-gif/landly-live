import Card from '@/components/admin/Card'
import { formatCount, formatIls } from '@/lib/usage/pricing'
import { reportLines, type UsageReport } from '@/lib/usage/usageReport'

const ACCENTS = {
  blue: 'bg-[#F0F7FF] text-[#0038B8]',
  emerald: 'bg-[#ECFDF5] text-emerald-700',
  amber: 'bg-[#FFFBEB] text-amber-700',
  red: 'bg-[#FEF2F2] text-[#B91C1C]',
  violet: 'bg-violet-50 text-violet-700',
} as const

function SummaryCard({ label, value, hint, icon, accent }: { label: string; value: string; hint: string; icon: string; accent: keyof typeof ACCENTS }) {
  return (
    // Two to a row on a phone, four from lg, like the dashboard's StatCards.
    <Card className="p-4 sm:p-6">
      <div className="flex items-start justify-between gap-2 sm:gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium text-[#475569]">{label}</div>
          <div className="mt-2 truncate text-2xl font-extrabold tracking-tight text-[#0B1B3D] tabular-nums sm:text-3xl">
            <bdi dir="ltr">{value}</bdi>
          </div>
        </div>
        <div className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base sm:flex sm:h-12 sm:w-12 sm:text-lg ${ACCENTS[accent]}`}>
          <i className={`fa-solid ${icon}`} aria-hidden="true" />
        </div>
      </div>
      <div className="mt-2 text-xs text-[#94A3B8]">{hint}</div>
    </Card>
  )
}

export default function UsageSummary({ report }: { report: UsageReport }) {
  const { netIls, grossIls, freeCoveragePct, otpSent } = report.totals
  const otpPrice = reportLines(report).find((line) => line.skuId === 'waAuth')
  const coverageAccent = freeCoveragePct >= 90 ? 'emerald' : freeCoveragePct >= 50 ? 'amber' : 'red'
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <SummaryCard label="Estimated payable" value={formatIls(netIls)} hint="This month, after free tiers" icon="fa-shekel-sign" accent="blue" />
      <SummaryCard
        label="Free-tier coverage"
        value={`${freeCoveragePct}%`}
        hint="Of the gross cost the free tiers absorb"
        icon="fa-shield-halved"
        accent={coverageAccent}
      />
      <SummaryCard label="Gross cost" value={formatIls(grossIls)} hint="The same usage with no free tiers" icon="fa-receipt" accent="violet" />
      <SummaryCard
        label="OTP codes sent"
        value={formatCount(otpSent)}
        hint={otpPrice && otpSent > 0 ? `${formatIls(otpPrice.netIls / otpSent)} each, billed by Meta` : 'Billed by Meta per accepted code'}
        icon="fa-key"
        accent="amber"
      />
    </div>
  )
}
