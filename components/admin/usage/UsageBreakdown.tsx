import Card from '@/components/admin/Card'
import { SECTION_HEADING } from '@/components/admin/formStyles'
import { formatCount, formatIls } from '@/lib/usage/pricing'
import type { UsageGroup, UsageLine } from '@/lib/usage/usageReport'
import FreeTierMeter from './FreeTierMeter'

// Per-service usage and cost, grouped by vendor (Google Cloud, Meta
// WhatsApp) with each group's subtotal: a table from md, a stacked card per
// service below it. Numbers sit in <bdi dir="ltr"> and end-aligned columns,
// so they read the same whatever the surrounding direction.

const UNIT_LABELS = { characters: 'Characters', requests: 'Requests', messages: 'Messages' } as const
const VENDOR_ICONS = { google: 'fa-cloud', meta: 'fa-comments' } as const

function freeLabel(line: UsageLine): string {
  if (line.freeAllowance === null) return 'Always free'
  if (line.freeAllowance === 0) return 'None'
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
  if (!line.note && !line.isUpperBound) return null
  return (
    <span className={`block text-xs text-[#64748B] ${className}`}>
      {line.note}
      {line.isUpperBound && <span className="text-[#94A3B8]"> · ≤ upper bound, Google may bill fewer</span>}
    </span>
  )
}

function GroupHeading({ group }: { group: UsageGroup }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#475569]">
        <i className={`fa-solid ${VENDOR_ICONS[group.vendor]} text-[#94A3B8]`} aria-hidden="true" />
        <span className="truncate">{group.label}</span>
      </span>
      <span className="shrink-0 text-xs text-[#64748B]">
        Subtotal <Num className="font-bold text-[#0B1B3D]">{formatIls(group.netIls)}</Num>
      </span>
    </div>
  )
}

function MobileGroup({ group }: { group: UsageGroup }) {
  return (
    <section aria-label={group.label}>
      <div className="border-y border-[#F1F5F9] bg-[#F8FAFC] px-4 py-2.5">
        <GroupHeading group={group} />
      </div>
      <ul className="divide-y divide-[#F1F5F9]">
        {group.lines.map((line) => (
          <li key={line.skuId} className="px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-[#0B1B3D]">{line.service}</p>
                <LineNote line={line} className="mt-0.5" />
              </div>
              <div className="shrink-0 text-end">
                <Num className="block font-bold text-[#0B1B3D]">{formatIls(line.netIls)}</Num>
                <span className="text-xs text-[#94A3B8]">net</span>
              </div>
            </div>
            {hasMeter(line) && <FreeTierMeter service={line.service} coverage={line.coverage} status={line.status} />}
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
              {[
                [UNIT_LABELS[line.unit], used(line)],
                ['Free tier', freeLabel(line)],
                ['Billable', formatCount(line.billable)],
                ['Gross', formatIls(line.grossIls)],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-[#94A3B8]">{label}</dt>
                  <dd className="font-semibold text-[#0F172A]">
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

export default function UsageBreakdown({ groups }: { groups: UsageGroup[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="px-4 pt-4 sm:px-6 sm:pt-5">
        <h2 className={SECTION_HEADING}>Breakdown by service</h2>
      </div>

      {/* Phones and small tablets */}
      <div className="md:hidden">
        {groups.map((group) => (
          <MobileGroup key={group.vendor} group={group} />
        ))}
      </div>

      {/* md and up */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E2E8F0] text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
              <th scope="col" className="py-3 ps-6 pe-3 text-start">Service</th>
              <th scope="col" className="px-3 py-3 text-start">Metric</th>
              <th scope="col" className="px-3 py-3 text-end">Used</th>
              <th scope="col" className="px-3 py-3 text-end">Free tier</th>
              <th scope="col" className="px-3 py-3 text-end">Billable</th>
              <th scope="col" className="px-3 py-3 text-end">Gross</th>
              <th scope="col" className="py-3 ps-3 pe-6 text-end">Net payable</th>
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.vendor} className="divide-y divide-[#F1F5F9] border-b border-[#E2E8F0] last:border-b-0">
              <tr className="bg-[#F8FAFC]">
                <th scope="colgroup" colSpan={7} className="py-2.5 ps-6 pe-6 text-start font-normal">
                  <GroupHeading group={group} />
                </th>
              </tr>
              {group.lines.map((line) => (
                <tr key={line.skuId} className="align-top">
                  <th scope="row" className="w-[34%] py-4 ps-6 pe-3 text-start font-normal">
                    <span className="font-semibold text-[#0B1B3D]">{line.service}</span>
                    <LineNote line={line} className="mt-0.5" />
                    {hasMeter(line) && <FreeTierMeter service={line.service} coverage={line.coverage} status={line.status} />}
                  </th>
                  <td className="px-3 py-4 text-[#64748B]">{UNIT_LABELS[line.unit]}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-end text-[#0F172A]">
                    <Num>{used(line)}</Num>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-end text-[#64748B]">
                    <Num>{freeLabel(line)}</Num>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-end text-[#0F172A]">
                    <Num>{formatCount(line.billable)}</Num>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-end text-[#64748B]">
                    <Num>{formatIls(line.grossIls)}</Num>
                  </td>
                  <td className="whitespace-nowrap py-4 ps-3 pe-6 text-end font-bold text-[#0B1B3D]">
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
