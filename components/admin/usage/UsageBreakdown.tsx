import Card from '@/components/admin/Card'
import { SECTION_HEADING } from '@/components/admin/formStyles'
import { formatCount, formatIls } from '@/lib/usage/pricing'
import type { UsageLine } from '@/lib/usage/usageReport'
import FreeTierMeter from './FreeTierMeter'

// Per-service usage and cost: a table from md, a stacked card per service
// below it. In the Combined view each count also shows its PROD / DEV split. Numbers sit in <bdi dir="ltr"> and end-aligned columns, so they
// read the same whatever the surrounding direction.

const UNIT_LABELS = { characters: 'Characters', requests: 'Requests', messages: 'Messages' } as const

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

function UpperBoundHint({ line }: { line: UsageLine }) {
  if (!line.isUpperBound) return null
  return <span className="text-[#94A3B8]"> · ≤ upper bound, Google may bill fewer</span>
}

/** Combined view: how the units split between the environments. */
function EnvSplit({ line, className = '' }: { line: UsageLine; className?: string }) {
  if (!line.byEnv) return null
  const units = (value: number | null) => (value === null ? '—' : formatCount(value))
  return (
    <span className={`block text-xs text-[#94A3B8] ${className}`}>
      <span className="font-semibold text-[#B91C1C]">PROD</span> <Num>{units(line.byEnv.prod)}</Num> ·{' '}
      <span className="font-semibold text-[#92400E]">DEV</span> <Num>{units(line.byEnv.dev)}</Num>
    </span>
  )
}

export default function UsageBreakdown({ lines }: { lines: UsageLine[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="px-4 pt-4 sm:px-6 sm:pt-5">
        <h2 className={SECTION_HEADING}>Breakdown by service</h2>
      </div>

      {/* Phones and small tablets */}
      <ul className="divide-y divide-[#F1F5F9] md:hidden">
        {lines.map((line) => (
          <li key={line.skuId} className="px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-[#0B1B3D]">{line.service}</p>
                {line.note && (
                  <p className="mt-0.5 text-xs text-[#64748B]">
                    {line.note}
                    <UpperBoundHint line={line} />
                  </p>
                )}
              </div>
              <div className="shrink-0 text-end">
                <Num className="block font-bold text-[#0B1B3D]">{formatIls(line.netIls)}</Num>
                <span className="text-xs text-[#94A3B8]">net</span>
              </div>
            </div>
            {hasMeter(line) && <FreeTierMeter service={line.service} coverage={line.coverage} status={line.status} />}
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
              <div className="min-w-0">
                <dt className="text-[#94A3B8]">{UNIT_LABELS[line.unit]}</dt>
                <dd className="font-semibold text-[#0F172A]">
                  <Num>{used(line)}</Num>
                  <EnvSplit line={line} className="font-normal" />
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[#94A3B8]">Free tier</dt>
                <dd className="font-semibold text-[#0F172A]">
                  <Num>{freeLabel(line)}</Num>
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[#94A3B8]">Billable</dt>
                <dd className="font-semibold text-[#0F172A]">
                  <Num>{formatCount(line.billable)}</Num>
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[#94A3B8]">Gross</dt>
                <dd className="font-semibold text-[#0F172A]">
                  <Num>{formatIls(line.grossIls)}</Num>
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

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
          <tbody className="divide-y divide-[#F1F5F9]">
            {lines.map((line) => (
              <tr key={line.skuId} className="align-top">
                <th scope="row" className="w-[34%] py-4 ps-6 pe-3 text-start font-normal">
                  <span className="font-semibold text-[#0B1B3D]">{line.service}</span>
                  {line.note && (
                    <span className="mt-0.5 block text-xs text-[#64748B]">
                      {line.note}
                      <UpperBoundHint line={line} />
                    </span>
                  )}
                  {hasMeter(line) && <FreeTierMeter service={line.service} coverage={line.coverage} status={line.status} />}
                </th>
                <td className="px-3 py-4 text-[#64748B]">{UNIT_LABELS[line.unit]}</td>
                <td className="whitespace-nowrap px-3 py-4 text-end text-[#0F172A]">
                  <Num>{used(line)}</Num>
                  <EnvSplit line={line} className="mt-0.5" />
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
        </table>
      </div>
    </Card>
  )
}
