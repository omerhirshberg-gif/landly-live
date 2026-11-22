import 'server-only'
import { isPaymentSandboxEnabled } from '@/lib/payments/devSandbox'
import { DEMO_CODES_PER_TOPUP } from '@/lib/payments/sandboxDemoStock'
import { revalidateTag, unstable_cache } from 'next/cache'
import { getAdminDb } from './admin'
import { isBusinessUnavailable, publicOfferData, withLiveBrandIndex } from '@/lib/offers/availability'
import { parseVariants } from '@/lib/offers/variants'
import { offerToWire, toOfferDocument, type OfferWire } from '@/lib/offers/offerDocument'
import { isRaayonitBrandCard, isRaayonitGeneralCard, gateGeneralCard } from '@/lib/offers/raayonitGate'
import { isRaayonitDisplayEnabled } from '@/lib/flags/featureFlags.server'
import { countInStock } from '@/lib/inventory/ledger/stock'
import { raayonitCategoryOf } from '@/lib/offers/raayonitCategories'
import categoryByKey from '@/lib/offers/raayonitCategoryByKey.json'
import { translations } from '@/lib/i18n/translations'
import { PRODUCTS_COLLECTION } from '@/lib/inventory/ledger/types'

// The live offers for GET /api/public/offers: read once with the Admin SDK
// (getAdminDb(), so DEV and PROD each read their own project), kept in the
// Next data cache for a minute, and dropped at once when an admin changes an
// offer (revalidatePublicOffers). Checkout never reads this: initiateOrder and
// claimOfferForOrder re-read the offer inside their transactions.
export const PUBLIC_OFFERS_TAG = 'public-offers'
export const PUBLIC_OFFERS_LIMIT = 500
export const PUBLIC_OFFERS_REVALIDATE_SECONDS = 60

const CATEGORY_BY_KEY = categoryByKey as Record<string, string>
const NEUTRAL_LABELS = Object.fromEntries(Object.entries(translations).map(([lang, dict]) => [lang, dict.multi_chain_voucher_label]))

async function readLiveOffers(): Promise<OfferWire[]> {
  const db = getAdminDb()
  const snap = await db.collection('offers').limit(PUBLIC_OFFERS_LIMIT).get()
  const docs = snap.docs.filter((d) => d.data().published !== false)
  // Voucher stock per pool, and which businesses still exist and may trade: an offer is public only while both hold.
  const poolIds = [...new Set(docs.flatMap((d) => [d.data().poolId, ...parseVariants(d.data().variants).map((v) => v.poolId)]).filter((p): p is string => typeof p === 'string' && !!p))]
  const businessIds = [...new Set(docs.map((d) => d.data().businessId).filter((b): b is string => typeof b === 'string' && !!b))]
  const [pools, businesses, users, products, displayEnabled] = await Promise.all([
    poolIds.length ? db.getAll(...poolIds.map((id) => db.collection('couponPools').doc(id))) : [],
    businessIds.length ? db.getAll(...businessIds.map((id) => db.collection('businesses').doc(id))) : [],
    businessIds.length ? db.getAll(...businessIds.map((id) => db.collection('users').doc(id))) : [],
    poolIds.length ? db.getAll(...poolIds.map((id) => db.collection(PRODUCTS_COLLECTION).doc(id))) : [],
    isRaayonitDisplayEnabled(),
  ])
  const poolRemaining = new Map(pools.map((p) => [p.id, p.exists && p.data()?.status !== 'archived' ? Number(p.data()?.remainingCount) || 0 : 0]))
  // A product that lives in the ledger is counted from its IN_STOCK codes (an aggregation, no counter document to contend on).
  await Promise.all(products.filter((p) => p.exists && p.data()?.active !== false).map(async (p) => poolRemaining.set(p.id, await countInStock(db, p.id))))
  // Dev sandbox only: an empty Raayonit stock still lists, because a test checkout fills it with RAAYONIT-DEMO codes (lib/payments/sandboxDemoStock.ts).
  if (isPaymentSandboxEnabled()) {
    for (const d of docs) {
      if (d.data().fulfillmentType !== 'raayonit_pool') continue
      for (const id of [d.data().poolId, ...parseVariants(d.data().variants).map((v) => v.poolId)]) if (typeof id === 'string' && id && !poolRemaining.get(id)) poolRemaining.set(id, DEMO_CODES_PER_TOPUP)
    }
  }
  const userById = new Map(users.map((u) => [u.id, u.data()]))
  const activeBusinesses = new Set(businesses.filter((b) => b.exists && !isBusinessUnavailable(b.data(), userById.get(b.id))).map((b) => b.id))
  const listed = docs.flatMap((d) => {
    const data = publicOfferData(d.data(), { poolRemaining, activeBusinesses })
    return data ? [{ id: d.id, data }] : []
  })
  // While display is on, every chain's own card is listed (each opens its detail page and sells the shared 100 / 150 stock) and carries
  // its Raayonit category; with the kill switch off the per-chain cards disappear and the general card goes neutral.
  const indexed = displayEnabled ? withLiveBrandIndex(listed) : listed
  return indexed
    .filter(({ data }) => displayEnabled || !isRaayonitBrandCard(data))
    .map(({ id, data }) => ({ id, data: data.fulfillmentType === 'raayonit_pool' && data.perkScope !== 'multi_chain' ? { ...data, raayonitCategory: raayonitCategoryOf(data, CATEGORY_BY_KEY) } : data }))
    .map(({ id, data }) => ({ id, data: isRaayonitGeneralCard(data) ? gateGeneralCard(data, displayEnabled, NEUTRAL_LABELS) : data }))
    .map(({ id, data }) => offerToWire(toOfferDocument(id, data)))
}

export const getCachedPublicOffers = unstable_cache(readLiveOffers, ['public-offers-v2'], {
  revalidate: PUBLIC_OFFERS_REVALIDATE_SECONDS,
  tags: [PUBLIC_OFFERS_TAG],
})

/** Call after any admin write that changes what an offer shows. Never throws: a write has already succeeded. */
export function revalidatePublicOffers() {
  try {
    revalidateTag(PUBLIC_OFFERS_TAG, { expire: 0 })
  } catch {
    // Outside a Next request (scripts, tests) there is no cache to drop.
  }
}
