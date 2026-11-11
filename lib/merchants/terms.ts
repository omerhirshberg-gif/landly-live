// The commercial terms agreed with a merchant. Pure and client-safe: the admin
// invite form, the onboarding page and settlement all read the same list.
export const PAYMENT_TERMS = ['net_0', 'net_15', 'net_30', 'net_45', 'net_60'] as const
export type PaymentTerms = (typeof PAYMENT_TERMS)[number]

export const COMMISSION_PRESETS = [0.05, 0.1, 0.15] as const

export function isPaymentTerms(value: unknown): value is PaymentTerms {
  return typeof value === 'string' && (PAYMENT_TERMS as readonly string[]).includes(value)
}

/** The days a payout waits after redemption: net_30 -> 30. */
export function paymentTermsDays(terms: PaymentTerms): number {
  return Number(terms.slice(4))
}

/** A commission as a fraction, 0 (exclusive of nothing) to 0.5 at most, in whole basis points. */
export function isCommissionRate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 0.5
    && Math.abs(value * 10000 - Math.round(value * 10000)) < 1e-9
}

/** Terms frozen onto an order and voucher; null when the merchant has none yet. */
export interface FrozenTerms { commissionRate: number; paymentTerms: PaymentTerms }

export function parseFrozenTerms(source: { commissionRate?: unknown; paymentTerms?: unknown } | null | undefined): FrozenTerms | null {
  if (!source || !isCommissionRate(source.commissionRate) || !isPaymentTerms(source.paymentTerms)) return null
  return { commissionRate: source.commissionRate, paymentTerms: source.paymentTerms }
}

/** What Landly keeps of a sale, in agorot, rounded per voucher so file totals always add up. */
export function commissionAgorot(amountAgorot: number, commissionRate: number): number {
  return Math.round(amountAgorot * Math.round(commissionRate * 10000) / 10000)
}
