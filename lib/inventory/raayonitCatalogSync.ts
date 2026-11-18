import 'server-only'
import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore'
import { DEFAULT_REDEMPTION_METHOD } from '@/lib/offers/redemption'
import { inferRedemption, inferRedemptionModes } from './raayonitRedemption'
import { officialBrandName } from './raayonitBrandNames'
import { localizePlace } from './raayonitPlaceNames'
import venueGeo from './raayonitVenueGeo.json'
import { DEFAULT_VOUCHER_VALIDITY_DAYS } from '@/lib/payments/voucherTerms'
import { offerPlaceFields } from '@/lib/geo'
import { buildOfferTranslations } from '@/lib/translate/offerTranslations'
import { businessTranslationsForSave } from '@/lib/translate/translateBusinessOnSave'
import { offerTextSource, translationsForSave } from '@/lib/translate/translateOfferOnSave'
import { RAAYONIT_LOGO_PATH } from '@/lib/payments/issuer'
import { createSharedPool } from './poolAdmin'
import { finalizeCatalog } from './raayonitSanitize'
import { POOL_COLLECTION } from './types'
import { firstPhone, normalizeWebsiteUrl } from '@/lib/offers/contact'
import { MAX_OFFER_BRANCHES } from '@/lib/offers/branches'
import { brandSourceKey, planRaayonitMigration } from './raayonitMigration'
import type { OfferVariant } from '@/lib/offers/variants'
import {
  branchLabel, indexUrl, logoFileName, networkUrl, showNetworksUrl, parseNetworkIndex, parseNetworkPage, type RaayonitBrand,
} from './raayonitCatalog'
import snapshot from './raayonitCatalog.snapshot.json'
import { applyCanonical } from './raayonitCanonicalCatalog'

// Builds Raayonit's "תו על" offers from its catalogue: one multi-chain card plus one card per participating brand or business,
// each carrying a variant per voucher stock (100 for 89, 150 for 129, created when missing). New cards are drafts
// (published: false) until an admin publishes them, unless `publish` is set (the dev seed, which also sets `purgeRetired`). Re-running updates the cards in
// place (matched by sourceKey) and never touches their published flag, counters or creation date.

/** The stocks the product sells: face value and sale price, in agorot. */
export const DEFAULT_STOCKS = [
  { faceValueAgorot: 10000, priceAgorot: 8900 },
  { faceValueAgorot: 15000, priceAgorot: 12900 },
] as const

export const GENERAL_BRAND_HE = 'תו על רב-רשתי'
export const GENERAL_BRAND_EN = 'Super Tav Multi-Chain'

// In Hebrew the product is "תו על"; in every other language it is "Super Tav".
const GENERAL_NAME: Record<'en' | 'ru' | 'fr' | 'es', string> = { en: 'Super Tav Multi-Chain', ru: 'Super Tav Мульти-сеть', fr: 'Super Tav Multi-enseignes', es: 'Super Tav Multicadena' }
const OTHER_LANGS = ['en', 'ru', 'fr', 'es'] as const
type Overrides = Record<string, Record<string, string>>
/** Adds the redemption steps and the fine print, written in each language, to a card's title overrides. */
function withText(base: Overrides, plan: ReturnType<typeof inferRedemption> | null, brand: { restrictions: string[] } | null | undefined, inLang: ((lang: (typeof OTHER_LANGS)[number], text: string) => string) | null): Overrides {
  const out: Overrides = {}
  for (const lang of OTHER_LANGS) {
    out[lang] = { ...(base[lang] ?? {}), ...(plan ? { redemptionInstructions: plan.instructions[lang] } : {}), ...(inLang && brand && brand.restrictions.length ? { redemptionTerms: brand.restrictions.map((r) => `- ${inLang(lang, r)}`).join('\n') } : {}) }
  }
  return out
}
const mergeOverrides = (a: unknown, b: unknown): Overrides => Object.fromEntries(OTHER_LANGS.map((l) => [l, { ...((a as Overrides)?.[l] ?? {}), ...((b as Overrides)?.[l] ?? {}) }]))
/** The title in a non-Hebrew language: "FOX — Super Tav", or the multi-chain card's name. The value lives in the variant, not the title. */
export function titleIn(lang: (typeof OTHER_LANGS)[number], card: { general: boolean; name: string }): string {
  return card.general ? GENERAL_NAME[lang] : `${card.name} — Super Tav`
}
const titleOverrides = (card: { general: boolean; names: Partial<Record<(typeof OTHER_LANGS)[number], string>>; fallback: string }) =>
  Object.fromEntries(OTHER_LANGS.map((lang) => [lang, { title: titleIn(lang, { general: card.general, name: card.names[lang] || card.fallback }) }]))
const CHUNK = 200

export type SnapshotBrand = RaayonitBrand & { logoFile?: string; logoKind?: 'logo' | 'photo' }
export const bundledCatalog = (): SnapshotBrand[] => applyCanonical((snapshot as { brands: SnapshotBrand[] }).brands)

/** Fetches the live catalogue from Raayonit's pages (index, then each network). Falls back to nothing: the caller uses the bundled copy. */
export async function scrapeRaayonitCatalog(fetcher: typeof fetch = fetch): Promise<{ brands: SnapshotBrand[]; failed: string[] }> {
  const get = async (url: string) => {
    const res = await fetcher(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; GoLandlyCatalogSync)' }, signal: AbortSignal.timeout(15_000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.text()
  }
  const list = parseNetworkIndex(await get(showNetworksUrl()))
  const brands: SnapshotBrand[] = []
  const failed: string[] = []
  const queue = [...list]
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      try {
        const brand = parseNetworkPage(await get(networkUrl(item.key)), item.key, item.logoUrl)
        if (brand) brands.push(brand)
        else failed.push(item.key)
      } catch {
        failed.push(item.key)
      }
    }
  }))
  return { brands: brands.sort((a, b) => Number(a.key) - Number(b.key) || a.key.localeCompare(b.key)), failed }
}
export { indexUrl }

/** Translates Hebrew strings (fine print lines, branch names, cities, streets) into one language; wired to Cloud Translation by the caller. */
export type TranslateBatch = (texts: string[], lang: (typeof OTHER_LANGS)[number]) => Promise<string[]>

/** Translates each distinct string once per language, in batches. A string that comes back empty keeps its Hebrew. */
async function translateAll(strings: Iterable<string>, translateBatch: TranslateBatch): Promise<Record<(typeof OTHER_LANGS)[number], Map<string, string>>> {
  const unique = [...new Set([...strings].map((x) => x.trim()).filter(Boolean))]
  const out = Object.fromEntries(OTHER_LANGS.map((l) => [l, new Map<string, string>()])) as Record<(typeof OTHER_LANGS)[number], Map<string, string>>
  for (const lang of OTHER_LANGS) {
    for (let i = 0; i < unique.length; i += 100) {
      const slice = unique.slice(i, i + 100)
      const done = await translateBatch(slice, lang)
      slice.forEach((text, j) => out[lang].set(text, done[j]?.trim() || text))
    }
  }
  return out
}

export interface SyncResult { stocksCreated: number; created: number; updated: number; brands: number; pools: number; retired: number; merged: number; purged?: number; archived?: number }

/**
 * Permanently removes retired Raayonit cards (the pre-unification one-per-stock "150 ₪" cards, suspended and vanished brands, every `retired:` card),
 * except one an order or a voucher still points at: that one stays, retired and unpublished, as the record of what was sold.
 */
export async function purgeRetiredRaayonitOffers(db: Firestore, ids: readonly string[]): Promise<{ purged: number; archived: number }> {
  let purged = 0
  let archived = 0
  for (let i = 0; i < ids.length; i += CHUNK) {
    const batch = db.batch()
    for (const id of ids.slice(i, i + CHUNK)) {
      const [order, voucher] = await Promise.all([
        db.collection('orders').where('offerId', '==', id).limit(1).get(),
        db.collection('vouchers').where('offerId', '==', id).limit(1).get(),
      ])
      if (order.empty && voucher.empty) { batch.delete(db.collection('offers').doc(id)); purged++ }
      else { batch.update(db.collection('offers').doc(id), { published: false, archivedForOrders: true }); archived++ }
    }
    await batch.commit()
  }
  return { purged, archived }
}

/** Every Raayonit card already retired (a `retired:` source key), for the purge. */
export async function retiredRaayonitOfferIds(db: Firestore): Promise<string[]> {
  const snap = await db.collection('offers').where('fulfillmentType', '==', 'raayonit_pool').get()
  return snap.docs.filter((d) => String(d.data().sourceKey ?? '').startsWith('retired:') && d.data().archivedForOrders !== true).map((d) => d.id)
}

/** The logo a card shows: the bundled copy on this site when we have one, else the supplier's link. */
function logoFor(brand: SnapshotBrand, origin: string): string {
  const bundled = brand.logoFile ?? (bundledCatalog().find((b) => b.key === brand.key)?.logoFile)
  // No image of its own: the Raayonit mark, never a broken or remote link.
  return bundled ? `${origin}/images/raayonit-brands/${bundled}` : `${origin}${RAAYONIT_LOGO_PATH}`
}


/**
 * How a brand written by the daily diff goes out: live, or staged for an admin (`pending`). `reuse` maps a brand key to the id of an
 * archived card to bring back instead of creating a new one.
 */
export interface PartialSyncOptions {
  decide: (brand: SnapshotBrand) => { published: boolean; pending: boolean }
  reuse?: ReadonlyMap<string, string>
}

export async function syncRaayonitCatalog(db: Firestore, input: { brands: SnapshotBrand[]; origin: string; publish?: boolean; purgeRetired?: boolean; translateBatch?: TranslateBatch; after?: (task: () => Promise<void>) => void; partial?: PartialSyncOptions }): Promise<SyncResult> {
  // `partial` (the daily diff): only the brands passed in are written. No general card, no stock creation, no migration, and nothing is
  // retired because it is missing from `brands` (the caller decides what is gone).
  const partial = input.partial
  // 1. The stocks: create the default two when missing.
  let stocksCreated = 0
  const poolSnap = await db.collection(POOL_COLLECTION).where('kind', '==', 'shared').get()
  const hasValue = new Set(poolSnap.docs.filter((d) => d.data().status !== 'archived').map((d) => d.data().faceValueAgorot))
  for (const stock of partial ? [] : DEFAULT_STOCKS) {
    if (hasValue.has(stock.faceValueAgorot)) continue
    await createSharedPool(db, { title: `רעיונית - תו על ${stock.faceValueAgorot / 100} ₪`, faceValueAgorot: stock.faceValueAgorot, priceAgorot: stock.priceAgorot, warningThreshold: 10, unitCostAgorot: 0 })
    stocksCreated++
  }
  const pools = (await db.collection(POOL_COLLECTION).where('kind', '==', 'shared').get()).docs
    .map((d) => ({ id: d.id, ...d.data() } as { id: string; faceValueAgorot: number; priceAgorot: number; status?: string }))
    .filter((p) => p.status !== 'archived' && Number.isInteger(p.faceValueAgorot) && Number.isInteger(p.priceAgorot))

  // 2. What exists already. Cards from before variants (one per stock and brand) are merged into one per brand.
  const faceOf = new Map(pools.map((p) => [p.id, p.faceValueAgorot]))
  const found = (await db.collection('offers').where('fulfillmentType', '==', 'raayonit_pool').get()).docs
    .map((d) => ({ id: d.id, sourceKey: typeof d.data().sourceKey === 'string' ? (d.data().sourceKey as string) : '', faceValueAgorot: faceOf.get(d.data().poolId) ?? Math.round((Number(d.data().originalPrice) || 0) * 100) }))
    .filter((c) => c.sourceKey.startsWith('raayonit:'))
  const plan = partial ? { survivors: new Map([...planRaayonitMigration(found).survivors]), retire: [], rekey: [] } : planRaayonitMigration(found)
  for (let i = 0; i < plan.retire.length + plan.rekey.length; i += CHUNK) {
    const batch = db.batch()
    const slice = [...plan.rekey.map((r) => ({ ...r, retire: false as const, supersededBy: '' })), ...plan.retire.map((r) => ({ ...r, retire: true as const, sourceKey: '' }))].slice(i, i + CHUNK)
    for (const item of slice) {
      const ref = db.collection('offers').doc(item.id)
      if (item.retire) batch.update(ref, { published: false, sourceKey: `retired:${item.id}`, supersededBy: item.supersededBy, retiredAt: Timestamp.now() })
      else batch.update(ref, { sourceKey: item.sourceKey })
    }
    await batch.commit()
  }
  const existing = new Map<string, string>([...plan.survivors].map(([brandKey, id]) => [brandSourceKey(brandKey), id]))

  const brands = finalizeCatalog(input.brands).filter((b) => b.nameHe)
  // Fine print and branches in every language, each distinct string translated once (so no Hebrew leaks into the other locales).
  const strings: string[] = []
  for (const b of brands) strings.push(...b.restrictions)
  // No brand name is machine-translated: each comes from the glossary, and a Hebrew-letter brand without a row stops the sync.
  const unnamed = partial ? [] : brands.filter((b) => officialBrandName(b.nameHe, 'en') === null).map((b) => b.nameHe)
  if (unnamed.length) throw new Error(`Raayonit brands missing from lib/inventory/raayonitBrandNames.ts: ${unnamed.join(' | ')}`)
  const nameIn = (lang: (typeof OTHER_LANGS)[number], nameHe: string) => (nameHe === GENERAL_BRAND_HE ? GENERAL_NAME[lang] : officialBrandName(nameHe, lang) ?? nameHe)
  const tr = input.translateBatch ? await translateAll(strings, input.translateBatch) : null
  const inLang = (lang: (typeof OTHER_LANGS)[number], text: string) => (text ? tr?.[lang].get(text.trim()) ?? text : '')
  // The one branch's address as the card's place snapshot: "street, city" in Hebrew; the other languages from the place-name dictionary.
  const singleVenuePlace = (brand: SnapshotBrand, b: SnapshotBrand['branches'][number]) => {
    const line = (l: 'he' | (typeof OTHER_LANGS)[number]) => {
      const city = (b.city ?? '').trim()
      const addr = (b.address ?? '').trim()
      const [a, c] = l === 'he' ? [addr, city] : [localizePlace(addr, l), localizePlace(city, l)]
      return [a, c && a && !a.includes(c) ? c : a ? '' : c].filter(Boolean).join(', ')
    }
    const langs = ['he', ...OTHER_LANGS] as const
    const text = Object.fromEntries(langs.map((l) => [l, line(l)]).filter(([, v]) => v)) as Record<string, string>
    if (Object.keys(text).length === 0) return offerPlaceFields({})
    const cityText = Object.fromEntries(langs.map((l) => [l, l === 'he' ? (b.city ?? '').trim() : localizePlace((b.city ?? '').trim(), l)]).filter(([, v]) => v)) as Record<string, string>
    const point = (venueGeo as Record<string, { lat: number; lng: number } | null>)[brand.key]
    return { location: text.he ?? '', geo: point ? { lat: point.lat, lng: point.lng } : null, city: cityText, address: { placeId: `raayonit:${brand.key}`, formatted: text, short: text } }
  }
  const writes: { ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown>; isNew: boolean; decision: { published: boolean; pending: boolean } | null; reactivate: boolean; text: ReturnType<typeof offerTextSource>; overrides: unknown; brandName: string; meta: { general: boolean; face: number; price: number; nameHe: string; nameEn: string } }[] = []
  const variants: OfferVariant[] = [...pools].sort((x, y) => x.faceValueAgorot - y.faceValueAgorot).map((p) => ({ faceValueAgorot: p.faceValueAgorot, priceAgorot: p.priceAgorot, poolId: p.id }))
  const first = variants[0]
  if (first) {
    const face = first.faceValueAgorot / 100
    const price = first.priceAgorot / 100
    const cards: { key: string; brand: SnapshotBrand | null }[] = [...(partial ? [] : [{ key: 'general', brand: null }]), ...brands.map((brand) => ({ key: brand.key, brand }))]
    for (const card of cards) {
      const brand = card.brand
      const general = !brand
      const brandName = general ? GENERAL_BRAND_HE : brand.nameHe
      const title = general ? GENERAL_BRAND_HE : `תו על — ${brand.nameHe}`
      const meta = { general, face, price, nameHe: brandName, nameEn: brand?.nameEn ?? '' }
      const redemptionTerms = general ? '' : brand.restrictions.map((r) => `- ${r}`).join('\n')
      const plan = general ? null : inferRedemption(brand)
      const instructions = plan ? plan.instructions.he : ''
      const modes = brand && plan ? inferRedemptionModes(brand, plan) : (['online', 'in_store'] as const)
      const onlineOnly = modes.length === 1 && modes[0] === 'online'
      const chains = general ? brands.map((b) => b.nameHe) : brand.branches.map((b) => (b.kosher ? `${branchLabel(b)} · כשר` : branchLabel(b)))
      const kosherBranchCount = general ? 0 : brand.branches.filter((b) => b.kosher).length
      const scopeFields = general
        ? { perkScope: 'multi_chain', universalRedemptionGuide: {
            he: 'מגיעים לאחת הרשתות או העסקים המשתתפים ומציגים או מקריאים את קוד התו בקופה. ההגבלות של כל עסק מופיעות בעמוד ההטבה שלו.',
            en: "Visit any participating chain or business and show or read out your voucher code at the till. Each one's own limits are on its perk page.",
          } }
        : { perkScope: 'single_business' }
      const ownFile = brand ? brand.logoFile ?? bundledCatalog().find((b) => b.key === brand.key)?.logoFile : undefined
      const kind: 'logo' | 'photo' | 'fallback' = !ownFile ? 'fallback' : (brand?.logoKind ?? bundledCatalog().find((b) => b.key === brand?.key)?.logoKind ?? (ownFile.endsWith('.jpg') ? 'photo' : 'logo'))
      const sourceKey = brandSourceKey(card.key)
      const id = existing.get(sourceKey) ?? partial?.reuse?.get(card.key)
      const reactivate = !!id && !existing.has(sourceKey)
      const decision = partial && brand ? partial.decide(brand) : null
      const ref = id ? db.collection('offers').doc(id) : db.collection('offers').doc()
      const overrides = withText(titleOverrides({ general, names: brand ? Object.fromEntries(OTHER_LANGS.map((l) => [l, nameIn(l, brand.nameHe)])) : {}, fallback: brand?.nameEn || brandName }), plan, brand, tr ? inLang : null)
      const text = offerTextSource({ title, description: '' }, { redemptionTerms }, { redemptionInstructions: instructions })
      const content = {
        ...scopeFields,
        brandName,
        participatingChains: [...new Set(chains)],
        chainsCount: new Set(chains).size,
        kosherBranchCount,
        // The clean branch list (city and street for each), for the branch strip and the location filter.
        branches: general ? [] : brand.branches.slice(0, MAX_OFFER_BRANCHES).map((b) => ({ name: b.name, city: b.city ?? '', address: b.address, phone: b.phone, kosher: b.kosher === true, i18n: Object.fromEntries(OTHER_LANGS.map((l) => [l, { name: localizePlace(b.name, l, brand.nameHe), city: localizePlace(b.city ?? '', l), address: localizePlace(b.address, l) }])) })),
        isNationwide: true,
        fulfillmentType: 'raayonit_pool',
        businessName: brandName,
        // A single-location brand carries its real address (street and city, in all five languages) so its card says where it is; a
        // multi-branch brand carries none (its branches list each one). Coordinates come from raayonitVenueGeo.json (scripts/raayonit-geo.mts, precise street hits only); the sync itself calls no maps API.
        ...(brand && brand.branches.length === 1 && !onlineOnly ? singleVenuePlace(brand, brand.branches[0]!) : offerPlaceFields({})),
        // The multi-chain card uses the shared Super Tav photo; a brand shows its own image (the Raayonit mark when it has none).
        // The brand's image is the card's one picture (imageUrl), shown whole over the ambient backdrop or edge to edge by its shape; there is
        // never a corner merchant badge (businessLogoUrl stays empty). A brand with no image keeps the small Raayonit mark ('fallback').
        businessLogoUrl: '',
        imageUrl: brand ? (kind === 'fallback' ? '' : logoFor(brand, input.origin)) : `${input.origin}/images/raayonit/super-tav-multi-chain.jpg`,
        ...(brand ? { logoKind: kind } : {}),
        title,
        description: '',
        // The default (cheapest stock) variant sits in the classic fields; the member picks among `variants` on the offer page.
        originalPrice: face,
        offerPrice: price,
        poolId: first.poolId,
        variants,
        category: brand ? brand.category : 'Fashion and Shopping',
        redemptionTerms,
        redemptionMethod: plan ? plan.method : DEFAULT_REDEMPTION_METHOD,
        redemptionModes: [...modes],
        redemptionInstructions: instructions,
        sourceKey,
        source: 'raayonit-sync',
        ...(brand ? { sourceUrl: brand.siteUrl, websiteUrl: normalizeWebsiteUrl(brand.siteUrl), contactPhone: brand.branches.length === 1 ? firstPhone(brand.branches[0]!.phone)?.display ?? '' : '' } : {}),
        ...(input.publish && !partial ? { published: true } : {}),
      }
      writes.push({ ref, data: content, isNew: !id, decision, reactivate, text, overrides, brandName, meta })
    }
  }

  // Cards whose brand is no longer in the catalogue (suspended, merged into another brand, or gone) leave the public catalogue.
  const wanted = new Set(writes.map((w) => (w.data as { sourceKey: string }).sourceKey))
  const gone = partial ? [] : [...existing].filter(([key]) => !wanted.has(key))
  for (let i = 0; i < gone.length; i += CHUNK) {
    const batch = db.batch()
    for (const [, id] of gone.slice(i, i + CHUNK)) batch.update(db.collection('offers').doc(id), { published: false, sourceKey: `retired:${id}`, retiredAt: Timestamp.now(), retiredReason: 'not in the Raayonit catalogue' })
    await batch.commit()
  }

  // A retired card stays out of the public catalogue whatever else happens to it.
  const retiredIds = [...plan.retire.map((r) => r.id), ...gone.map(([, id]) => id)]

  let created = 0
  let updated = 0
  for (let start = 0; start < writes.length; start += CHUNK) {
    const batch = db.batch()
    for (const w of writes.slice(start, start + CHUNK)) {
      const built = await buildOfferTranslations(w.text, null, w.overrides as never, null)
      if (w.isNew) {
        batch.set(w.ref, { ...w.data, createdAt: Timestamp.now(), isBestseller: false, expiryDate: null, totalQuantity: null, claimedCount: 0, validityDays: DEFAULT_VOUCHER_VALIDITY_DAYS, published: w.decision ? w.decision.published : input.publish === true, ...(w.decision ? { raayonitSyncPending: w.decision.pending, ...(w.decision.pending ? { pendingSince: Timestamp.now() } : {}) } : {}), translations: built.translations, businessTranslations: null })
        created++
      } else {
        // Bringing an archived card back: the same card (its history and vouchers stay attached), live or staged by the decision.
        const back = w.reactivate && w.decision ? { published: w.decision.published, raayonitSyncPending: w.decision.pending, ...(w.decision.pending ? { pendingSince: Timestamp.now() } : {}), archivedReason: FieldValue.delete(), archivedAt: FieldValue.delete(), archivedSourceKey: FieldValue.delete(), retiredAt: FieldValue.delete(), retiredReason: FieldValue.delete(), reactivatedAt: Timestamp.now() } : {}
        batch.update(w.ref, { ...w.data, ...back, translations: built.translations })
        updated++
      }
    }
    await batch.commit()
  }

  for (let i = 0; i < retiredIds.length; i += CHUNK) {
    const batch = db.batch()
    for (const id of retiredIds.slice(i, i + CHUNK)) batch.update(db.collection('offers').doc(id), { published: false })
    await batch.commit()
  }

  // Dev: the retired cards leave the database (the ones orders or vouchers point at are archived). Production keeps them retired until an admin removes them.
  const purge = input.purgeRetired ? await purgeRetiredRaayonitOffers(db, [...new Set([...retiredIds, ...(await retiredRaayonitOfferIds(db))])]) : null

  // 3. Machine translation (he -> en, ru, fr, es) runs after the response: the cards are already saved.
  const translate = async () => {
    for (const w of writes) {
      try {
        // Names come from the glossary in every language (never machine-translated), so these writes call no translator.
        const names = Object.fromEntries(OTHER_LANGS.map((lang) => [lang, { businessName: nameIn(lang, w.meta.nameHe) }]))
        const brand = await businessTranslationsForSave(w.brandName, null, names)
        const translated = await translationsForSave(w.text, null, mergeOverrides(w.overrides, titleOverrides({ general: w.meta.general, names: Object.fromEntries(OTHER_LANGS.map((l) => [l, nameIn(l, w.meta.nameHe)])), fallback: w.meta.nameHe })))
        if (translated.ok) await w.ref.update({ translations: translated.translations, ...(brand?.ok && brand.translations ? { businessTranslations: brand.translations } : {}) })
      } catch (err) {
        console.error('Raayonit card translation failed', w.ref.id, err)
      }
    }
  }
  if (input.after) input.after(translate)
  return { stocksCreated, created, updated, brands: brands.length, pools: pools.length, retired: plan.retire.length + gone.length, merged: plan.rekey.length, ...(purge ?? {}) }
}

export { logoFileName }
