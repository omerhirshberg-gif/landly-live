import Card from '@/components/admin/Card'
import { SECTION_HEADING } from '@/components/admin/formStyles'
import { useAdminT, type AdminKey } from '@/lib/admin/translations'
import { formatCount, formatIls } from '@/lib/usage/pricing'
import type { UsageGroup, UsageLine } from '@/lib/usage/usageReport'
import type { QuotaChannel, QuotaReport } from '@/lib/usage/quota'
import FreeTierMeter from './FreeTierMeter'
import QuotaControl from './QuotaControl'

// Per-service usage and cost, grouped by vendor (Google Cloud, 019
// Gateway, Meta WhatsApp) with each group's subtotal: a table from md, a stacked card per
// service below it. Numbers sit in <bdi dir="ltr"> and end-aligned columns,
// so they read the same whatever the surrounding direction.

/** The 019 services whose purchased package is tracked (lifetime, not per month). */
const QUOTA_CHANNEL: Partial<Record<UsageLine['skuId'], QuotaChannel>> = { sms019Otp: 'sms', wa019Otp: 'whatsapp' }

export interface QuotaProps {
  quota: QuotaReport
  onQuota: (channel: QuotaChannel, quota: number) => void
  onStale: () => void
}

function LineQuota({ line, quota, onQuota, onStale }: { line: UsageLine } & QuotaProps) {
  const channel = QUOTA_CHANNEL[line.skuId]
  if (!channel) return null
  return <QuotaControl channel={channel} service={line.service} state={quota[channel]} onQuota={onQuota} onStale={onStale} />
}

const VENDOR_ICONS = { google: 'fa-cloud', gateway019: 'fa-comment-sms', meta: 'fa-comments' } as const

function freeLabel(line: UsageLine, t: (key: AdminKey) => string): string {
  if (line.freeAllowance === null) return t('usage.alwaysFree')
  if (line.freeAllowance === 0) return t('usage.none')
  return formatCount(line.freeAllowance)
}

function Num({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <bdi dir="ltr" className={`tabular-nums ${className}`}>
      {children}
    </bdi>
  )
}

const used = (line: UsageLine) => `${line.isUpperBound ? '≤ ' : ''}${formatCount(line.used)}`
const hasMeter = (line: UsageLine): line is UsageLine & { coverage: number } => line.coverage !== null

function LineNote({ line, className = '' }: { line: UsageLine; className?: string }) {
  const { t } = useAdminT()
  if (!line.note && !line.isUpperBound) return null
  // The note is translated by service (usage.note.<skuId>); its numbers are LTR-isolated like every other figure.
  const params = Object.fromEntries(Object.entries(line.noteParams ?? {}).map(([key, value]) => [key, `\u2066${value}\u2069`]))
  const note = line.note ? t(`usage.note.${line.skuId}` as AdminKey, params) : null
  return (
    <span className={`block text-xs text-adm-muted ${className}`}>
      {note}
      {line.isUpperBound && <span className="text-adm-muted">{t('usage.upperBound')}</span>}
    </span>
  )
}

function GroupHeading({ group }: { group: UsageGroup }) {
  const { t } = useAdminT()
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 items-center gap-2 text-xs font-bold uppercase tracking-wider text-adm-text-2">
        <i className={`fa-solid ${VENDOR_ICONS[group.vendor]} text-adm-muted`} aria-hidden="true" />
        <bdi className="truncate">{group.label}</bdi>
      </span>
      <span className="shrink-0 text-xs text-adm-muted">
        {t('usage.subtotal', { amount: '' })}<Num className="font-bold text-adm-text">{formatIls(group.netIls)}</Num>
      </span>
    </div>
  )
}

function MobileGroup({ group, ...quota }: { group: UsageGroup } & QuotaProps) {
  const { t } = useAdminT()
  return (
    <section aria-label={group.label}>
      <div className="border-y border-adm-line-soft bg-adm-sunken px-4 py-2.5">
        <GroupHeading group={group} />
      </div>
      <ul className="divide-y divide-adm-line-soft">
        {group.lines.map((line) => (
          <li key={line.skuId} className="px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-adm-text"><bdi>{line.service}</bdi></p>
                <LineNote line={line} className="mt-0.5" />
              </div>
              <div className="shrink-0 text-end">
                <Num className="block font-bold text-adm-text">{formatIls(line.netIls)}</Num>
                <span className="text-xs text-adm-muted">{t('usage.net')}</span>
              </div>
            </div>
            {hasMeter(line) && <FreeTierMeter service={line.service} coverage={line.coverage} status={line.status} />}
            <LineQuota line={line} {...quota} />
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
              {[
                [t(`usage.unit.${line.unit}` as AdminKey), used(line)],
                [t('usage.freeTier'), freeLabel(line, t)],
                [t('usage.billable'), formatCount(line.billable)],
                [t('usage.gross'), formatIls(line.grossIls)],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-adm-muted">{label}</dt>
                  <dd className="font-semibold text-adm-text">
                    <Num>{value}</Num>
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function UsageBreakdown({ groups, ...quota }: { groups: UsageGroup[] } & QuotaProps) {
  const { t } = useAdminT()
  return (
    <Card className="overflow-hidden">
      <div className="px-4 pt-4 sm:px-6 sm:pt-5">
        <h2 className={SECTION_HEADING}>{t('usage.breakdown')}</h2>
      </div>

      {/* Phones and small tablets */}
      <div className="md:hidden">
        {groups.map((group) => (
          <MobileGroup key={group.vendor} group={group} {...quota} />
        ))}
      </div>

      {/* md and up */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-adm-line text-xs font-semibold uppercase tracking-wider text-adm-muted">
              <th scope="col" className="py-3 ps-6 pe-3 text-start">{t('usage.col.service')}</th>
              <th scope="col" className="px-3 py-3 text-start">{t('usage.col.metric')}</th>
              <th scope="col" className="px-3 py-3 text-end">{t('usage.col.used')}</th>
              <th scope="col" className="px-3 py-3 text-end">{t('usage.freeTier')}</th>
              <th scope="col" className="px-3 py-3 text-end">{t('usage.billable')}</th>
              <th scope="col" className="px-3 py-3 text-end">{t('usage.gross')}</th>
              <th scope="col" className="py-3 ps-3 pe-6 text-end">{t('usage.col.netPayable')}</th>
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.vendor} className="divide-y divide-adm-line-soft border-b border-adm-line last:border-b-0">
              <tr className="bg-adm-sunken">
                <th scope="colgroup" colSpan={7} className="py-2.5 ps-6 pe-6 text-start font-normal">
                  <GroupHeading group={group} />
                </th>
              </tr>
              {group.lines.map((line) => (
                <tr key={line.skuId} className="align-top">
                  <th scope="row" className="w-[34%] py-4 ps-6 pe-3 text-start font-normal">
                    <span className="font-semibold text-adm-text"><bdi>{line.service}</bdi></span>
                    <LineNote line={line} className="mt-0.5" />
                    {hasMeter(line) && <FreeTierMeter service={line.service} coverage={line.coverage} status={line.status} />}
                    <LineQuota line={line} {...quota} />
                  </th>
                  <td className="px-3 py-4 text-adm-muted">{t(`usage.unit.${line.unit}` as AdminKey)}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-end text-adm-text">
                    <Num>{used(line)}</Num>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-end text-adm-muted">
                    <Num>{freeLabel(line, t)}</Num>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-end text-adm-text">
                    <Num>{formatCount(line.billable)}</Num>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-end text-adm-muted">
                    <Num>{formatIls(line.grossIls)}</Num>
                  </td>
                  <td className="whitespace-nowrap py-4 ps-3 pe-6 text-end font-bold text-adm-text">
                    <Num>{formatIls(line.netIls)}</Num>
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </Card>
  )
}
