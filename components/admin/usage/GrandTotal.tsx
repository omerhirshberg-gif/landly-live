import Card from '@/components/admin/Card'
import { formatIls } from '@/lib/usage/pricing'
import type { Outlay, UsageReport } from '@/lib/usage/usageReport'
import { useAdminT, type AdminKey } from '@/lib/admin/translations'

// Metered APIs, fixed subscriptions and the total outlay of the month, each
// with net, 18% VAT and gross in shekels: three columns from sm, stacked on a phone.

function Column({ title, outlay, strong }: { title: string; outlay: Outlay; strong?: boolean }) {
  const { t } = useAdminT()
  const rows: [AdminKey, number][] = [
    ['usage.total.net', outlay.netIls],
    ['usage.total.vat', outlay.vatIls],
  ]
  return (
    <div className={`rounded-xl border p-4 ${strong ? 'border-adm-accent/30 bg-adm-accent-soft' : 'border-adm-line/80 bg-adm-sunken'}`}>
      <p className="text-sm font-semibold text-adm-text">{title}</p>
      <dl className="mt-3 space-y-1.5 text-sm">
        {rows.map(([key, value]) => (
          <div key={key} className="flex items-baseline justify-between gap-3">
            <dt className="text-adm-text-2">{t(key)}</dt>
            <dd className="font-medium tabular-nums text-adm-text">
              <bdi dir="ltr">{formatIls(value)}</bdi>
            </dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 border-t border-adm-line/80 pt-2">
          <dt className="font-semibold text-adm-text">{t('usage.total.gross')}</dt>
          <dd className={`font-extrabold tabular-nums text-adm-text ${strong ? 'text-xl' : 'text-lg'}`}>
            <bdi dir="ltr">{formatIls(outlay.grossIls)}</bdi>
          </dd>
        </div>
      </dl>
    </div>
  )
}

export default function GrandTotal({ report }: { report: UsageReport }) {
  const { t } = useAdminT()
  const { metered, fixed, total } = report.outlay
  return (
    <Card className="p-4 sm:p-6">
      <h2 className="text-base font-bold text-adm-text">{t('usage.total.title')}</h2>
      <p className="mt-1 text-sm text-adm-text-2">{t('usage.total.subtitle')}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3 sm:gap-4">
        <Column title={t('usage.total.metered')} outlay={metered} />
        <Column title={t('usage.total.fixed')} outlay={fixed} />
        <Column title={t('usage.total.outlay')} outlay={total} strong />
      </div>
    </Card>
  )
}
