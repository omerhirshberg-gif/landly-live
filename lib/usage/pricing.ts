import type { UsageCounters } from './usageTypes'

// What each metered service costs, for the estimates on /admin/system/costs
// (lib/usage/usageReport.ts). Constants, not env vars, so DEV and PROD
// always price alike. Google bills in USD and is converted at USD_TO_ILS;
// the WhatsApp OTP rate is configured in shekels. These are estimates from
// our own counters, not an invoice: re-check the price pages below when
// `verifiedAt` gets old.

export type Currency = 'USD' | 'ILS'

export interface Money {
  amount: number
  currency: Currency
}

/** A price band: units up to `upTo` (the month's running total) cost `unitPrice` each. */
export interface PriceTier {
  upTo: number
  unitPrice: Money
}

export type SkuId = 'translation' | 'placesAutocomplete' | 'placesDetails' | 'geocoding' | 'waAuth' | 'waService' | 'waSimulated'

export interface MeteredSku {
  id: SkuId
  vendor: 'google' | 'meta'
  service: string
  unit: 'characters' | 'requests' | 'messages'
  usage: (counters: UsageCounters) => number
  /** Units free each month: 0 when every unit is billed, null when the service is always free. */
  freePerMonth: number | null
  /** Bands after the free allowance, in order; the last one is open-ended. Empty when always free. */
  tiers: PriceTier[]
  /** The count can be higher than what Google bills (see placesAutocomplete). */
  isUpperBound?: boolean
  note?: (counters: UsageCounters) => string | null
  sourceUrl?: string
}

export const USD_TO_ILS = { rate: 3.7, verifiedAt: '2026-10' } as const

/** Share of a free allowance at which the meter turns amber, and red. */
export const THRESHOLDS = { warn: 0.8, over: 1 } as const

export const PRICES_VERIFIED_AT = '2026-10'

const usd = (amount: number): Money => ({ amount, currency: 'USD' })
const ils = (amount: number): Money => ({ amount, currency: 'ILS' })
const perThousand = (amount: number) => usd(amount / 1000)

// Google Maps Platform Essentials SKUs (since March 2025): 10,000 free calls
// a month per SKU, then volume bands priced per 1,000.
const ESSENTIALS_FREE = 10_000
const essentialsTiers = (prices: [number, number, number, number, number]): PriceTier[] => [
  { upTo: 100_000, unitPrice: perThousand(prices[0]) },
  { upTo: 500_000, unitPrice: perThousand(prices[1]) },
  { upTo: 1_000_000, unitPrice: perThousand(prices[2]) },
  { upTo: 5_000_000, unitPrice: perThousand(prices[3]) },
  { upTo: Infinity, unitPrice: perThousand(prices[4]) },
]

const MAPS_PRICING = 'https://developers.google.com/maps/billing-and-pricing/pricing'

export const SKUS: readonly MeteredSku[] = [
  {
    id: 'translation',
    vendor: 'google',
    service: 'Cloud Translation',
    unit: 'characters',
    // Language detection is billed by the character like translation.
    usage: (c) => c.google.translation.chars + c.google.translation.detectChars,
    freePerMonth: 500_000,
    tiers: [{ upTo: Infinity, unitPrice: usd(20 / 1_000_000) }],
    note: (c) => (c.google.translation.detectChars ? `incl. ${formatCount(c.google.translation.detectChars)} for language detection` : null),
    sourceUrl: 'https://cloud.google.com/translate/pricing',
  },
  {
    id: 'placesAutocomplete',
    vendor: 'google',
    service: 'Places Autocomplete',
    unit: 'requests',
    // Free when the session ends in a Place Details call (sessionsCompleted),
    // billed per request when it's abandoned: the server can't tell which, so
    // this is every request.
    usage: (c) => c.google.places.autocompleteRequests,
    freePerMonth: ESSENTIALS_FREE,
    tiers: essentialsTiers([2.83, 2.27, 1.7, 1.13, 0.57]),
    isUpperBound: true,
    note: (c) => `${formatCount(c.google.places.sessionsCompleted)} sessions ended in a pick (their requests are free)`,
    sourceUrl: MAPS_PRICING,
  },
  {
    id: 'placesDetails',
    vendor: 'google',
    service: 'Place Details (Essentials)',
    unit: 'requests',
    usage: (c) => c.google.places.detailsRequests,
    freePerMonth: ESSENTIALS_FREE,
    tiers: essentialsTiers([5, 4, 3, 1.5, 0.38]),
    note: () => 'One lookup per site language for each address picked',
    sourceUrl: MAPS_PRICING,
  },
  {
    id: 'geocoding',
    vendor: 'google',
    service: 'Geocoding',
    unit: 'requests',
    usage: (c) => c.google.geocoding.requests,
    freePerMonth: ESSENTIALS_FREE,
    tiers: essentialsTiers([5, 4, 3, 1.5, 0.38]),
    note: () => 'Nearby city lookups that missed the 30-day cache',
    sourceUrl: MAPS_PRICING,
  },
  {
    id: 'waAuth',
    vendor: 'meta',
    service: 'WhatsApp OTP (authentication)',
    unit: 'messages',
    usage: (c) => c.whatsapp.authSent,
    freePerMonth: 0,
    tiers: [{ upTo: Infinity, unitPrice: ils(0.12) }],
    note: () => 'Counted when Meta accepts the send',
    sourceUrl: 'https://developers.facebook.com/docs/whatsapp/pricing',
  },
  {
    id: 'waService',
    vendor: 'meta',
    service: 'WhatsApp support replies',
    unit: 'messages',
    usage: (c) => c.whatsapp.serviceSent,
    freePerMonth: null,
    tiers: [],
    note: (c) => `Free inside the 24h service window · ${formatCount(c.whatsapp.inboundMessages)} member messages received`,
  },
  {
    id: 'waSimulated',
    vendor: 'meta',
    service: 'WhatsApp simulated sends',
    unit: 'messages',
    usage: (c) => c.whatsapp.simulated,
    freePerMonth: null,
    tiers: [],
    note: () => 'Logged instead of sent while WhatsApp is not live (DEV)',
  },
]

export function toIls(money: Money): number {
  return money.currency === 'ILS' ? money.amount : money.amount * USD_TO_ILS.rate
}

/** The cost in shekels of `used` units: the free allowance, then each band in turn. */
export function netCostIls(sku: MeteredSku, used: number): number {
  if (sku.freePerMonth === null || used <= 0) return 0
  let cost = 0
  let from = sku.freePerMonth
  for (const tier of sku.tiers) {
    if (used <= from) break
    cost += (Math.min(used, tier.upTo) - from) * toIls(tier.unitPrice)
    from = tier.upTo
  }
  return cost
}

/** What the same units would cost with no free allowance: the free ones at the first band's price. */
export function grossCostIls(sku: MeteredSku, used: number): number {
  const first = sku.tiers[0]
  if (sku.freePerMonth === null || !first || used <= 0) return 0
  return Math.min(used, sku.freePerMonth) * toIls(first.unitPrice) + netCostIls(sku, used)
}

const ILS = new Intl.NumberFormat('en-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const COUNT = new Intl.NumberFormat('en-US')

export function formatIls(amount: number): string {
  return ILS.format(amount)
}

export function formatCount(value: number): string {
  return COUNT.format(value)
}
