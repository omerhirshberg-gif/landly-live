import Card from '@/components/admin/Card'
import { formatCount, formatIls } from '@/lib/usage/pricing'
import { reportLines, type UsageReport } from '@/lib/usage/usageReport'
import { useAdminT } from '@/lib/admin/translations'

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
      <div className="mt-2 text-xs text-[#64748B]">{hint}</div>
    </Card>
  )
}

export default function UsageSummary({ report }: { report: UsageReport }) {
  const { t } = useAdminT()
  const { netIls, grossIls, freeCoveragePct, otpSent } = report.totals
  const otpPrice = reportLines(report).find((line) => line.skuId === 'waAuth')
  const coverageAccent = freeCoveragePct >= 90 ? 'emerald' : freeCoveragePct >= 50 ? 'amber' : 'red'
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <SummaryCard label={t('usage.sum.payable')} value={formatIls(netIls)} hint={t('usage.sum.payableHint')} icon="fa-shekel-sign" accent="blue" />
      <SummaryCard
        label={t('usage.sum.coverage')}
        value={`${freeCoveragePct}%`}
        hint={t('usage.sum.coverageHint')}
        icon="fa-shield-halved"
        accent={coverageAccent}
      />
      <SummaryCard label={t('usage.sum.gross')} value={formatIls(grossIls)} hint={t('usage.sum.grossHint')} icon="fa-receipt" accent="violet" />
      <SummaryCard
        label={t('usage.sum.otp')}
        value={formatCount(otpSent)}
        hint={otpPrice && otpSent > 0 ? t('usage.sum.otpEach', { price: formatIls(otpPrice.netIls / otpSent) }) : t('usage.sum.otpHint')}
        icon="fa-key"
        accent="amber"
      />
    </div>
  )
}
