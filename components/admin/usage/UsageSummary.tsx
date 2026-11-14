import Card from '@/components/admin/Card'
import { formatCount, formatIls } from '@/lib/usage/pricing'
import { reportLines, type UsageReport } from '@/lib/usage/usageReport'
import { useAdminT } from '@/lib/admin/translations'

const ACCENTS = {
  blue: 'bg-adm-accent-soft text-adm-accent',
  emerald: 'bg-adm-ok-soft text-adm-ok',
  amber: 'bg-adm-warn-soft text-adm-warn',
  red: 'bg-adm-danger-soft text-adm-danger',
  violet: 'bg-adm-violet-soft text-adm-violet',
} as const

function SummaryCard({ label, value, hint, icon, accent }: { label: string; value: string; hint: string; icon: string; accent: keyof typeof ACCENTS }) {
  return (
    // Two to a row on a phone, four from lg, like the dashboard's StatCards.
    <Card className="p-4 sm:p-6">
      <div className="flex items-start justify-between gap-2 sm:gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium text-adm-text-2">{label}</div>
          <div className="mt-2 truncate text-2xl font-extrabold tracking-tight text-adm-text tabular-nums sm:text-3xl">
            <bdi dir="ltr">{value}</bdi>
          </div>
        </div>
        <div className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base sm:flex sm:h-12 sm:w-12 sm:text-lg ${ACCENTS[accent]}`}>
          <i className={`fa-solid ${icon}`} aria-hidden="true" />
        </div>
      </div>
      <div className="mt-2 text-xs text-adm-muted">{hint}</div>
    </Card>
  )
}

export default function UsageSummary({ report }: { report: UsageReport }) {
  const { t } = useAdminT()
  const { netIls, grossIls, freeCoveragePct, otpSent } = report.totals
  // The blended price of a code: 0.06 ₪ by SMS, 0.12 ₪ by WhatsApp.
  const otpCost = reportLines(report).filter((line) => line.skuId === 'sms019Otp' || line.skuId === 'wa019Otp').reduce((sum, line) => sum + line.netIls, 0)
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
        hint={otpSent > 0 ? t('usage.sum.otpEach', { price: formatIls(otpCost / otpSent) }) : t('usage.sum.otpHint')}
        icon="fa-key"
        accent="amber"
      />
    </div>
  )
}
