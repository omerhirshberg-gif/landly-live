import { DEFAULT_SUBSCRIPTIONS, priceOf, type FixedSubscription } from './fixedSubscriptions'
import { grossCostIls, netCostIls, PRICES_VERIFIED_AT, SKUS, THRESHOLDS, toIls, tranzilaFeeIls, USD_TO_ILS, vatIls, withVatIls, type Money, type MeteredSku, type SkuId, type VendorId } from './pricing'
import { buildQuota, type QuotaInput, type QuotaReport } from './quota'
import { usageEnvOf, type UsageCounters, type UsageEnv } from './usageTypes'

// One month of this deployment's own counters, priced for
// /admin/system/costs: Vercel Production shows the PROD project, local and
// Preview their own DEV project. Pure (no I/O), so the route stays thin and
// the arithmetic is unit-tested.

export interface FxInfo {
  usdToIls: number
  /** When the rate was published or fetched (ISO); null for the built-in default. */
  updatedAt: string | null
  source: 'boi' | 'frankfurter' | 'default'
  /** True when a live fetch failed and an older stored rate is used. */
  stale: boolean
  verifiedAt: string
}

export const DEFAULT_FX: FxInfo = { usdToIls: USD_TO_ILS.rate, updatedAt: null, source: 'default', stale: false, verifiedAt: USD_TO_ILS.verifiedAt }

/** How a meter reads: green, amber from 80% of the allowance, red once units are billed. */
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
  /** Pre-formatted values for the translated note (`usage.note.<skuId>`). */
  noteParams: Record<string, string>
}

/** The lines of one vendor, with their subtotals. */
export interface UsageGroup {
  vendor: VendorId
  label: string
  lines: UsageLine[]
  grossIls: number
  netIls: number
}

/** Net, VAT and gross (net plus 18% VAT) in shekels. */
export interface Outlay {
  netIls: number
  vatIls: number
  grossIls: number
}

export const outlayOf = (netIls: number): Outlay => ({ netIls, vatIls: vatIls(netIls), grossIls: withVatIls(netIls) })

/** The month's real card payments (lib/usage/tranzilaCost.server.ts). */
export interface TranzilaUsage {
  configured: boolean
  transactions: number
  volumeIls: number
  /** The orders could not be read: the fee shown is 0, not known. */
  unavailable: boolean
}

export const NO_TRANZILA: TranzilaUsage = { configured: false, transactions: 0, volumeIls: 0, unavailable: false }

export type FixedStatus = 'billed' | 'inactive' | 'free' | 'over' | 'notConfigured' | 'active'

/** One row of "Fixed Subscriptions & Platform Tiers". Only `subscription` and `tranzila` rows count toward the fixed subtotal. */
export interface FixedLine {
  id: string
  kind: 'subscription' | 'resend' | 'tranzila'
  label: string
  status: FixedStatus
  /** The plan price as set (subscriptions only). */
  price: Money | null
  /** Billed this month in shekels, net of VAT. */
  netIls: number
  /** Resend: emails sent against the free allowance. */
  used: number | null
  freeAllowance: number | null
  /** Tranzila: paid orders and their volume. */
  transactions: number | null
  volumeIls: number | null
  unavailable: boolean
}

export interface UsageReport {
  month: string
  /** Months with counters, newest first, always including `month` and the current one. */
  months: string[]
  projectId: string
  environment: UsageEnv
  groups: UsageGroup[]
  totals: { grossIls: number; netIls: number; freeCoveragePct: number; otpSent: number }
  /** Fixed plan fees and platform tiers; Resend's free tier is shown here but billed in the metered lines. */
  fixed: { lines: FixedLine[]; netIls: number }
  /** What the month costs: metered APIs, fixed subscriptions, and both together. */
  outlay: { metered: Outlay; fixed: Outlay; total: Outlay }
  /** The purchased 019 packages against lifetime sends (never reset, not tied to `month`). */
  quota: QuotaReport
  /** The USD/ILS rate every dollar price was converted at, and where and when it came from. */
  fx: FxInfo
  /** Aliases of `fx.usdToIls` and `fx.updatedAt` for existing callers. */
  usdToIlsRate: number
  rateUpdatedAt: string | null
  pricesVerifiedAt: string
  generatedAt: string
}

const VENDORS: { vendor: VendorId; label: string }[] = [
  { vendor: 'google', label: 'Google Cloud' },
  { vendor: 'gateway019', label: '019 Gateway' },
  { vendor: 'meta', label: 'Meta WhatsApp' },
  { vendor: 'resend', label: 'Resend Email' },
]

const SHOWN_WHEN_USED: readonly SkuId[] = ['sim019', 'waAuthLegacy', 'resendSim']

export function meterStatus(coverage: number | null, billable: number): MeterStatus {
  if (coverage === null) return 'ok'
  if (coverage >= THRESHOLDS.over && billable > 0) return 'over'
  if (coverage >= THRESHOLDS.warn) return 'warn'
  return 'ok'
}

export function usageLine(sku: MeteredSku, counters: UsageCounters, rate: number = USD_TO_ILS.rate): UsageLine {
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
    grossIls: grossCostIls(sku, used, rate),
    netIls: netCostIls(sku, used, rate),
    coverage,
    status: meterStatus(coverage, billable),
    isUpperBound: !!sku.isUpperBound,
    note: sku.note?.(counters) ?? null,
    noteParams: sku.noteParams?.(counters) ?? {},
  }
}

const sum = (lines: UsageLine[], key: 'grossIls' | 'netIls') => lines.reduce((total, line) => total + line[key], 0)

export function buildUsageReport(input: { month: string; months: string[]; projectId: string; counters: UsageCounters; now?: Date; quota?: QuotaInput; fx?: FxInfo; subscriptions?: readonly FixedSubscription[]; tranzila?: TranzilaUsage }): UsageReport {
  const fx = input.fx ?? DEFAULT_FX
  const now = input.now ?? new Date()
  // Shown only when there is something to show: simulated sends (DEV, or a misconfigured PROD) and
  // the Meta OTPs of months before OTPs moved to 019.
  const lines = SKUS.map((sku) => usageLine(sku, input.counters, fx.usdToIls)).filter((line) => !SHOWN_WHEN_USED.includes(line.skuId) || line.used > 0)
  const groups: UsageGroup[] = VENDORS.map(({ vendor, label }) => {
    const own = lines.filter((line) => line.vendor === vendor)
    return { vendor, label, lines: own, grossIls: sum(own, 'grossIls'), netIls: sum(own, 'netIls') }
  })
  const meteredGross = sum(lines, 'grossIls')
  const meteredNet = sum(lines, 'netIls')
  const grossIls = meteredGross
  const netIls = meteredNet
  const fixed = buildFixed(input.subscriptions ?? DEFAULT_SUBSCRIPTIONS, input.tranzila ?? NO_TRANZILA, lines, fx.usdToIls)
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
      freeCoveragePct: meteredGross > 0 ? Math.round((1 - meteredNet / meteredGross) * 100) : 100,
      otpSent: input.counters.gateway019.smsOtpSent + input.counters.gateway019.whatsappOtpSent,
    },
    fixed,
    outlay: { metered: outlayOf(meteredNet), fixed: outlayOf(fixed.netIls), total: outlayOf(meteredNet + fixed.netIls) },
    quota: buildQuota(input.quota),
    fx,
    usdToIlsRate: fx.usdToIls,
    rateUpdatedAt: fx.updatedAt,
    pricesVerifiedAt: PRICES_VERIFIED_AT,
    generatedAt: now.toISOString(),
  }
}

/** Plan fees at the live rate, Resend's free-tier meter (its overage is in the metered lines), and Tranzila's fee. */
function buildFixed(subscriptions: readonly FixedSubscription[], tranzila: TranzilaUsage, lines: UsageLine[], rate: number): { lines: FixedLine[]; netIls: number } {
  const none = { used: null, freeAllowance: null, transactions: null, volumeIls: null, unavailable: false }
  const out: FixedLine[] = subscriptions.map((item) => ({
    ...none,
    id: item.id,
    kind: 'subscription',
    label: item.label,
    status: item.active ? 'billed' : 'inactive',
    price: priceOf(item),
    netIls: item.active ? toIls(priceOf(item), rate) : 0,
  }))
  const resend = lines.find((line) => line.skuId === 'resendEmail')
  out.push({
    ...none,
    id: 'resend',
    kind: 'resend',
    label: 'Resend',
    status: resend && resend.billable > 0 ? 'over' : 'free',
    price: null,
    netIls: 0,
    used: resend?.used ?? 0,
    freeAllowance: resend?.freeAllowance ?? null,
  })
  const fee = tranzila.configured ? tranzilaFeeIls(tranzila.transactions, tranzila.volumeIls) : 0
  out.push({
    ...none,
    id: 'tranzila',
    kind: 'tranzila',
    label: 'Tranzila',
    status: tranzila.configured ? 'active' : 'notConfigured',
    price: null,
    netIls: fee,
    transactions: tranzila.configured ? tranzila.transactions : null,
    volumeIls: tranzila.configured ? tranzila.volumeIls : null,
    unavailable: tranzila.unavailable,
  })
  return { lines: out, netIls: out.filter((line) => line.kind !== 'resend').reduce((total, line) => total + line.netIls, 0) }
}

/** Every line of the report, in group order. */
export function reportLines(report: Pick<UsageReport, 'groups'>): UsageLine[] {
  return report.groups.flatMap((group) => group.lines)
}
