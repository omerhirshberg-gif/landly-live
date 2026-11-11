import 'server-only'
import { Timestamp, type Firestore } from 'firebase-admin/firestore'
import { endOfIsraelDay } from '@/lib/admin/expiryDate'
import { validateOfferPrices } from '@/lib/admin/validateOfferPrices'
import { BUSINESS_CATEGORIES } from '@/lib/categories'
import { offerPlaceFields } from '@/lib/geo'
import { DEFAULT_REDEMPTION_METHOD } from '@/lib/offers/redemption'
import { parsePerkScopeFields } from '@/lib/offers/perkScope'
import { DEFAULT_VOUCHER_VALIDITY_DAYS } from '@/lib/payments/voucherTerms'
import { PaymentError } from '@/lib/payments/paymentValidation'
import { CipherConfigError } from '@/lib/crypto/fieldCipher'
import { offerTextSource, translationsForSave } from '@/lib/translate/translateOfferOnSave'
import { addPoolEntries, createPool, deletePoolCascade, type AddCodesResult } from './poolAdmin'
import { matchText, type SmartPerk } from './smartSheet'

export const DEFAULT_WARNING_THRESHOLD = 10

export interface ExistingPerk { offerId: string; title: string; brand: string; remaining: number }

export type PlannedPerk =
  | { key: string; status: 'new' }
  | { key: string; status: 'restock'; offer: ExistingPerk }
  | { key: string; status: 'ambiguous'; candidates: ExistingPerk[] }

/** Every Multipass perk in the store, as the sheet's perks are matched against. */
export async function loadMultipassPerks(db: Firestore): Promise<ExistingPerk[]> {
  const snap = await db.collection('offers').where('fulfillmentType', '==', 'multipass_pool').get()
  const pools = await Promise.all(snap.docs.map((d) => db.collection('couponPools').doc(d.id).get()))
  return snap.docs.map((d, i) => {
    const data = d.data()
    return {
      offerId: d.id,
      title: String(data.title ?? ''),
      brand: String(data.brandName || data.businessName || ''),
      remaining: Number(pools[i]!.data()?.remainingCount) || 0,
    }
  })
}

/** A sheet perk against the store: one stored perk with the same brand and title is a restock, none is new, several need a choice. */
export function matchPerks(perks: readonly SmartPerk[], existing: readonly ExistingPerk[]): PlannedPerk[] {
  return perks.map((perk) => {
    const title = matchText(perk.title)
    const brand = matchText(perk.brand || perk.title)
    const hits = existing.filter((e) => matchText(e.title) === title && matchText(e.brand) === brand)
    if (hits.length === 1) return { key: perk.key, status: 'restock', offer: hits[0]! }
    if (hits.length > 1) return { key: perk.key, status: 'ambiguous', candidates: hits }
    return { key: perk.key, status: 'new' }
  })
}

/** What the admin decided for one perk in the review table. */
export interface PerkDecision {
  key: string
  action: 'create' | 'restock'
  /** The stored perk to restock (action 'restock'). */
  offerId?: string
  /** For a new perk; the sheet's own values are used when these are absent. */
  retailPrice?: number
  memberPrice?: number
  unitCost?: number
  category?: string
}

export type PerkResult =
  | { key: string; status: 'created' | 'restocked'; offerId: string; counts: AddCodesResult }
  | { key: string; status: 'failed'; error: string }

const money = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null)

/**
 * Writes each perk on its own: a new perk is its offer, its pool and its encrypted codes together
 * and is removed again if any of them fails; a restock appends to the existing pool in transactions
 * that skip codes already stored. One perk failing never undoes the others. Counts only, never codes, go to the caller.
 */
export async function commitSmartImport(db: Firestore, perks: readonly SmartPerk[], decisions: readonly PerkDecision[], existing: readonly ExistingPerk[]): Promise<PerkResult[]> {
  const results: PerkResult[] = []
  for (const decision of decisions) {
    const perk = perks.find((p) => p.key === decision.key)
    if (!perk) { results.push({ key: decision.key, status: 'failed', error: 'This perk is not in the file.' }); continue }
    const entries = perk.entries.map((e) => ({ code: e.code, pin: e.pin, expiresAt: e.expiresAt ? endOfIsraelDay(e.expiresAt) : null }))
    try {
      if (decision.action === 'restock') {
        const target = existing.find((e) => e.offerId === decision.offerId)
        if (!target) throw new PaymentError('The perk to restock was not found.', 404)
        const counts = await addPoolEntries(db, target.offerId, entries)
        results.push({ key: perk.key, status: 'restocked', offerId: target.offerId, counts })
        continue
      }
      results.push(await createPerk(db, perk, decision, entries))
    } catch (err) {
      if (err instanceof CipherConfigError) throw err
      if (!(err instanceof PaymentError)) console.error('Smart import failed for a perk', err)
      results.push({ key: perk.key, status: 'failed', error: err instanceof PaymentError ? err.message : 'Could not store this perk. Nothing was created for it.' })
    }
  }
  return results
}

async function createPerk(db: Firestore, perk: SmartPerk, decision: PerkDecision, entries: { code: string; pin: string | null; expiresAt: Date | null }[]): Promise<PerkResult> {
  const retail = money(decision.retailPrice) ?? perk.retailPrice
  const member = money(decision.memberPrice) ?? perk.memberPrice
  const unitCost = money(decision.unitCost) ?? perk.unitCost
  const category = decision.category || perk.category || ''
  if (!perk.title) throw new PaymentError('The perk has no name.', 400)
  if (retail === null || member === null || unitCost === null) throw new PaymentError('Prices and unit cost are required for a new perk.', 400)
  const priceError = validateOfferPrices(retail, member)
  if (priceError) throw new PaymentError(priceError, 400)
  if (!(BUSINESS_CATEGORIES as readonly string[]).includes(category)) throw new PaymentError('Choose a category for the new perk.', 400)
  const scope = parsePerkScopeFields({ fulfillmentType: 'multipass_pool', brandName: perk.brand || perk.title })
  if (!scope.ok) throw new PaymentError(scope.error, 400)

  const translated = await translationsForSave(offerTextSource({ title: perk.title, description: '' }, { redemptionTerms: '' }, { redemptionInstructions: '' }), null, undefined).catch(() => null)
  const offerRef = db.collection('offers').doc()
  await offerRef.set({
    ...scope.fields,
    fulfillmentType: 'multipass_pool',
    businessName: scope.fields.brandName,
    businessTranslations: null,
    ...offerPlaceFields({}),
    businessLogoUrl: '',
    imageUrl: '',
    title: perk.title,
    description: '',
    originalPrice: retail,
    offerPrice: member,
    category,
    createdAt: Timestamp.now(),
    isBestseller: false,
    expiryDate: null,
    totalQuantity: null,
    claimedCount: 0,
    validityDays: DEFAULT_VOUCHER_VALIDITY_DAYS,
    redemptionTerms: '',
    redemptionMethod: DEFAULT_REDEMPTION_METHOD,
    redemptionInstructions: '',
    translations: translated && translated.ok ? translated.translations : null,
  })
  try {
    await createPool(db, { offerId: offerRef.id, warningThreshold: DEFAULT_WARNING_THRESHOLD, unitCostAgorot: Math.round(unitCost * 100), retailPriceAgorot: Math.round(retail * 100) })
    const counts = await addPoolEntries(db, offerRef.id, entries)
    if (entries.length > 0 && counts.added === 0) throw new PaymentError('No new codes could be stored.', 400)
    return { key: perk.key, status: 'created', offerId: offerRef.id, counts }
  } catch (err) {
    await deletePoolCascade(db, offerRef.id).catch((e) => console.error('Pool rollback failed', e))
    await offerRef.delete().catch((e) => console.error('Offer rollback failed', e))
    throw err
  }
}
