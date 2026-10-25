import { grossCostIls, netCostIls, PRICES_VERIFIED_AT, SKUS, THRESHOLDS, USD_TO_ILS, type MeteredSku, type SkuId } from './pricing'
import { emptyCounters, sumCounters, type UsageCounters, type UsageEnv } from './usageTypes'

// One month's counters priced for /admin/system/costs, for one of three
// views: PROD, DEV, or both combined. The two projects share one Google
// Cloud billing account and one Meta account, so Combined adds their units
// first and prices the total once, against one free allowance: that's the
// actual bill. PROD and DEV alone are priced as if each had the free tiers
// to itself (`sharedFreeTier`). Pure (no I/O), so the route stays thin and
// the arithmetic is unit-tested.

export type MeterStatus = 'ok' | 'warn' | 'over'

export const USAGE_VIEWS = ['combined', 'prod', 'dev'] as const
export type UsageView = (typeof USAGE_VIEWS)[number]

export function isUsageView(value: unknown): value is UsageView {
  return (USAGE_VIEWS as readonly unknown[]).includes(value)
}

/** Where one environment's counters came from, and whether they could be read. */
export interface UsageSource {
  env: UsageEnv
  projectId: string
  status: 'ok' | 'unconfigured' | 'unavailable' | 'mismatch'
  /** local: this deployment's own project; peer-reader / peer-export: lib/usage/peerGuard.ts. */
  via: 'local' | 'peer-reader' | 'peer-export'
  message?: string
}

export interface SourceData {
  source: UsageSource
  /** null unless source.status is 'ok'. */
  counters: UsageCounters | null
  months: string[]
}

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
  /** Combined view: each environment's units (null where it couldn't be read). */
  byEnv?: Record<UsageEnv, number | null>
}

export interface UsageReport {
  month: string
  /** Months either environment has counters for, newest first, always including `month` and the current one. */
  months: string[]
  view: UsageView
  /** PROD first. */
  sources: UsageSource[]
  /** The view has figures: false when its only environment couldn't be read. */
  available: boolean
  /** Combined with one environment missing: the totals cover the other only. */
  partial: boolean
  /** A single environment priced on its own, though the free tiers are shared. */
  sharedFreeTier: boolean
  lines: UsageLine[]
  totals: { grossIls: number; netIls: number; freeCoveragePct: number; otpSent: number }
  fx: { usdToIls: number; verifiedAt: string }
  pricesVerifiedAt: string
  generatedAt: string
}

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

/** The counters a view shows: Combined sums whichever environments could be read. */
export function viewCounters(view: UsageView, prod: SourceData, dev: SourceData): UsageCounters | null {
  if (view === 'prod') return prod.counters
  if (view === 'dev') return dev.counters
  const readable = [prod.counters, dev.counters].filter((counters): counters is UsageCounters => counters !== null)
  return readable.length ? sumCounters(...readable) : null
}

export function buildUsageReport(input: { month: string; view: UsageView; prod: SourceData; dev: SourceData; now?: Date }): UsageReport {
  const { month, view, prod, dev } = input
  const now = input.now ?? new Date()
  const counters = viewCounters(view, prod, dev)
  const lines = SKUS.map((sku) => {
    const line = usageLine(sku, counters ?? emptyCounters())
    if (view !== 'combined') return line
    const unitsOf = (data: SourceData) => (data.counters ? sku.usage(data.counters) : null)
    return { ...line, byEnv: { prod: unitsOf(prod), dev: unitsOf(dev) } }
  })
  const grossIls = lines.reduce((sum, line) => sum + line.grossIls, 0)
  const netIls = lines.reduce((sum, line) => sum + line.netIls, 0)
  const months = [...new Set([...prod.months, ...dev.months, month, now.toISOString().slice(0, 7)])].sort().reverse()
  return {
    month,
    months,
    view,
    sources: [prod.source, dev.source],
    available: counters !== null,
    partial: view === 'combined' && counters !== null && (prod.counters === null || dev.counters === null),
    sharedFreeTier: view !== 'combined',
    lines: counters ? lines : [],
    totals: {
      grossIls,
      netIls,
      freeCoveragePct: grossIls > 0 ? Math.round((1 - netIls / grossIls) * 100) : 100,
      otpSent: counters?.whatsapp.authSent ?? 0,
    },
    fx: { usdToIls: USD_TO_ILS.rate, verifiedAt: USD_TO_ILS.verifiedAt },
    pricesVerifiedAt: PRICES_VERIFIED_AT,
    generatedAt: now.toISOString(),
  }
}
