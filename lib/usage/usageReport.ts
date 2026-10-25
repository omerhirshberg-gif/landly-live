import { grossCostIls, netCostIls, PRICES_VERIFIED_AT, SKUS, THRESHOLDS, USD_TO_ILS, type MeteredSku, type SkuId } from './pricing'
import { usageEnvOf, type UsageCounters, type UsageEnv } from './usageTypes'

// One month of this deployment's own counters, priced for
// /admin/system/costs: Vercel Production shows the PROD project, local and
// Preview their own DEV project. Pure (no I/O), so the route stays thin and
// the arithmetic is unit-tested.

export type MeterStatus = 'ok' | 'warn' | 'over'

export interface UsageLine {
  skuId: SkuId
  vendor: MeteredSku['vendor']
  service: string
  unit: MeteredSku['unit']
  used: number
  /** 0: every unit is billed; null: always free. */
  freeAllowance: number | null
  billable: number
  grossIls: number
  netIls: number
  /** used / freeAllowance (uncapped), or null when there is no allowance to measure against. */
  coverage: number | null
  status: MeterStatus
  isUpperBound: boolean
  note: string | null
}

/** The lines of one vendor, with their subtotals. */
export interface UsageGroup {
  vendor: MeteredSku['vendor']
  label: string
  lines: UsageLine[]
  grossIls: number
  netIls: number
}

export interface UsageReport {
  month: string
  /** Months with counters, newest first, always including `month` and the current one. */
  months: string[]
  projectId: string
  environment: UsageEnv
  groups: UsageGroup[]
  totals: { grossIls: number; netIls: number; freeCoveragePct: number; otpSent: number }
  fx: { usdToIls: number; verifiedAt: string }
  pricesVerifiedAt: string
  generatedAt: string
}

const VENDORS: { vendor: MeteredSku['vendor']; label: string }[] = [
  { vendor: 'google', label: 'Google Cloud' },
  { vendor: 'meta', label: 'Meta WhatsApp' },
]

export function meterStatus(coverage: number | null, billable: number): MeterStatus {
  if (coverage === null) return 'ok'
  if (coverage >= THRESHOLDS.over && billable > 0) return 'over'
  if (coverage >= THRESHOLDS.warn) return 'warn'
  return 'ok'
}

export function usageLine(sku: MeteredSku, counters: UsageCounters): UsageLine {
  const used = sku.usage(counters)
  const free = sku.freePerMonth
  const billable = free === null ? 0 : Math.max(0, used - free)
  const coverage = free ? used / free : null
  return {
    skuId: sku.id,
    vendor: sku.vendor,
    service: sku.service,
    unit: sku.unit,
    used,
    freeAllowance: free,
    billable,
    grossIls: grossCostIls(sku, used),
    netIls: netCostIls(sku, used),
    coverage,
    status: meterStatus(coverage, billable),
    isUpperBound: !!sku.isUpperBound,
    note: sku.note?.(counters) ?? null,
  }
}

const sum = (lines: UsageLine[], key: 'grossIls' | 'netIls') => lines.reduce((total, line) => total + line[key], 0)

export function buildUsageReport(input: { month: string; months: string[]; projectId: string; counters: UsageCounters; now?: Date }): UsageReport {
  const now = input.now ?? new Date()
  // Simulated sends happen only where WhatsApp isn't live: shown when there are any (DEV, or a misconfigured PROD).
  const lines = SKUS.map((sku) => usageLine(sku, input.counters)).filter((line) => line.skuId !== 'waSimulated' || line.used > 0)
  const groups = VENDORS.map(({ vendor, label }) => {
    const own = lines.filter((line) => line.vendor === vendor)
    return { vendor, label, lines: own, grossIls: sum(own, 'grossIls'), netIls: sum(own, 'netIls') }
  })
  const grossIls = sum(lines, 'grossIls')
  const netIls = sum(lines, 'netIls')
  const months = [...new Set([...input.months, input.month, now.toISOString().slice(0, 7)])].sort().reverse()
  return {
    month: input.month,
    months,
    projectId: input.projectId,
    environment: usageEnvOf(input.projectId),
    groups,
    totals: {
      grossIls,
      netIls,
      freeCoveragePct: grossIls > 0 ? Math.round((1 - netIls / grossIls) * 100) : 100,
      otpSent: input.counters.whatsapp.authSent,
    },
    fx: { usdToIls: USD_TO_ILS.rate, verifiedAt: USD_TO_ILS.verifiedAt },
    pricesVerifiedAt: PRICES_VERIFIED_AT,
    generatedAt: now.toISOString(),
  }
}

/** Every line of the report, in group order. */
export function reportLines(report: Pick<UsageReport, 'groups'>): UsageLine[] {
  return report.groups.flatMap((group) => group.lines)
}
