import { NextResponse, after } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { writeAudit } from '@/lib/admin/auditLog'
import { revalidateGuestHome } from '@/lib/admin/revalidateHome'
import { BATCH_COMMIT_CHUNK, parseOffersSheet, type BatchOffer, type BatchRow } from '@/lib/admin/offersBatch'
import { getAdminDb } from '@/lib/firebase/admin'
import { createPool } from '@/lib/inventory/poolAdmin'
import { offerPlaceFields } from '@/lib/geo'
import { businessTranslationsForSave } from '@/lib/translate/translateBusinessOnSave'
import { parseBusinessTranslations } from '@/lib/business/businessText'
import { DEFAULT_REDEMPTION_METHOD } from '@/lib/offers/redemption'
import { DEFAULT_VOUCHER_VALIDITY_DAYS } from '@/lib/payments/voucherTerms'
import { buildOfferTranslations } from '@/lib/translate/offerTranslations'
import { offerTextSource, translationsForSave } from '@/lib/translate/translateOfferOnSave'

// Offers in bulk, in two steps so nothing is created by surprise (same contract as merchants/batch):
//   mode "validate": per-row problems, nothing written.
//   mode "create":   every valid row becomes an offer; invalid rows are returned, not created.
// The browser sends the sheet's cells and every row is re-checked here. Offers are written in
// Firestore batches of BATCH_COMMIT_CHUNK, each all-or-nothing. Machine translation runs after
// the response, so a large upload isn't held up by Cloud Translation; an admin-written English
// title (both title columns filled) is stored at once.
const MAX_MATRIX_ROWS = 1000
const DEFAULT_POOL_WARNING = 10

const summarize = (row: BatchRow) => ({ row: row.row, title: row.title, ok: row.errors.length === 0, errors: row.errors })
const overridesOf = (offer: BatchOffer) => (offer.titleHe && offer.titleEn ? { en: { title: offer.titleEn } } : {})
const sourceOf = (offer: BatchOffer) =>
  offerTextSource({ title: offer.titleHe || offer.titleEn, description: '' }, { redemptionTerms: '' }, { redemptionInstructions: offer.redemptionInstructions })

export async function POST(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const body = await request.json().catch(() => null)
  const matrix: unknown = body?.matrix
  if (!Array.isArray(matrix) || matrix.length === 0 || matrix.length > MAX_MATRIX_ROWS || matrix.some((r) => !Array.isArray(r))) {
    return NextResponse.json({ error: 'Send the sheet as a list of rows.' }, { status: 400 })
  }

  const db = getAdminDb()
  const businessSnap = await db.collection('businesses').get()
  const byKey = new Map<string, string>()
  for (const doc of businessSnap.docs) {
    const companyId = doc.data().businessId
    if (typeof companyId === 'string' && companyId.trim()) byKey.set(companyId.trim().toLowerCase(), doc.id)
  }
  for (const doc of businessSnap.docs) byKey.set(doc.id.toLowerCase(), doc.id)
  const businesses = new Map(businessSnap.docs.map((doc) => [doc.id, doc.data()]))

  const parsed = parseOffersSheet(matrix as unknown[][], (key) => byKey.get(key.trim().toLowerCase()) ?? null)
  const rows = parsed.rows.map(summarize)
  const valid = parsed.rows.filter((r) => r.offer)
  if (body.mode !== 'create') {
    return NextResponse.json({ rows, valid: valid.length, invalid: parsed.rows.length - valid.length, tooMany: parsed.tooMany, missingColumns: parsed.missingColumns })
  }
  if (parsed.missingColumns.length > 0) {
    return NextResponse.json({ error: 'The sheet is missing required columns.', missingColumns: parsed.missingColumns }, { status: 400 })
  }

  const created: { row: number; offerId: string; offer: BatchOffer }[] = []
  const failedRows: number[] = []
  for (let start = 0; start < valid.length; start += BATCH_COMMIT_CHUNK) {
    const chunk = valid.slice(start, start + BATCH_COMMIT_CHUNK)
    const batch = db.batch()
    const pending: { row: number; offerId: string; offer: BatchOffer }[] = []
    for (const row of chunk) {
      const offer = row.offer!
      const multipass = offer.fulfillmentType === 'multipass_pool'
      // A Multipass perk and a manual multi-chain pass have no business: the brand stands in for the name, and they carry no place or logo.
      const noBusiness = multipass || offer.perkScope === 'multi_chain'
      const business = noBusiness ? {} : businesses.get(offer.businessUid)!
      const ref = db.collection('offers').doc()
      const built = await buildOfferTranslations(sourceOf(offer), null, overridesOf(offer), null)
      batch.set(ref, {
        ...(noBusiness
          ? { perkScope: offer.perkScope, brandName: offer.brandName, ...(offer.participatingChains.length > 0 ? { participatingChains: offer.participatingChains, chainsCount: offer.participatingChains.length } : {}) }
          : { perkScope: 'single_business', businessId: offer.businessUid, ...(offer.participatingChains.length > 0 ? { participatingChains: offer.participatingChains, chainsCount: offer.participatingChains.length } : {}) }),
        isNationwide: offer.isNationwide,
        fulfillmentType: offer.fulfillmentType,
        businessName: noBusiness ? offer.brandName : business.businessName ?? '',
        businessTranslations: noBusiness ? null : parseBusinessTranslations(business.translations),
        ...offerPlaceFields(business),
        businessLogoUrl: typeof business.logoUrl === 'string' ? business.logoUrl : '',
        imageUrl: offer.imageUrl,
        title: offer.titleHe || offer.titleEn,
        description: '',
        originalPrice: offer.originalPrice,
        offerPrice: offer.offerPrice,
        category: offer.category ?? business.category ?? '',
        createdAt: Timestamp.now(),
        isBestseller: false,
        expiryDate: null,
        totalQuantity: offer.fulfillmentType === 'multipass_pool' ? null : offer.totalQuantity,
        claimedCount: 0,
        validityDays: DEFAULT_VOUCHER_VALIDITY_DAYS,
        redemptionTerms: '',
        redemptionMethod: DEFAULT_REDEMPTION_METHOD,
        redemptionInstructions: offer.redemptionInstructions,
        translations: built.translations,
      })
      pending.push({ row: row.row, offerId: ref.id, offer })
    }
    try {
      await batch.commit()
      created.push(...pending)
    } catch (err) {
      console.error('Offers batch chunk failed', err)
      failedRows.push(...chunk.map((r) => r.row))
    }
  }

  // Multipass rows get their (empty) pool; codes are loaded from Stock & Pools. A failure is reported, not hidden.
  const warnings: { row: number; offerId: string }[] = []
  for (const item of created.filter((c) => c.offer.fulfillmentType === 'multipass_pool')) {
    try {
      await createPool(db, { offerId: item.offerId, warningThreshold: DEFAULT_POOL_WARNING, unitCostAgorot: 0, retailPriceAgorot: Math.round(item.offer.originalPrice * 100) })
    } catch (err) {
      console.error('Batch pool creation failed', err)
      warnings.push({ row: item.row, offerId: item.offerId })
    }
  }

  // The sheet's commission and payment terms are the business's agreed terms (the wizard saves them the same way).
  const terms = new Map<string, { commissionRate: number; paymentTerms: string }>()
  for (const item of created) {
    if (item.offer.businessUid && item.offer.commissionRate !== null && item.offer.paymentTerms) terms.set(item.offer.businessUid, { commissionRate: item.offer.commissionRate, paymentTerms: item.offer.paymentTerms })
  }
  for (const [uid, value] of terms) {
    await db.collection('businesses').doc(uid).update(value)
    await writeAudit(db, request, { action: 'business.terms', targetType: 'business', targetId: uid, after: { ...value, source: 'offersBatch' } })
  }

  if (created.length > 0) {
    revalidateGuestHome()
    await writeAudit(db, request, { action: 'offer.batchCreate', targetType: 'batch', targetId: created[0]!.offerId, after: { created: created.length, failed: failedRows.length, source: 'sheet' } })
    after(async () => {
      for (const item of created) {
        try {
          const translated = await translationsForSave(sourceOf(item.offer), null, overridesOf(item.offer))
          const brand = item.offer.brandName ? await businessTranslationsForSave(item.offer.brandName, null, undefined) : null
          if (translated.ok) await db.collection('offers').doc(item.offerId).update({ translations: translated.translations, ...(brand?.ok && brand.translations ? { businessTranslations: brand.translations } : {}) })
        } catch (err) {
          console.error('Batch offer translation failed', item.offerId, err)
        }
      }
    })
  }
  return NextResponse.json({ created: created.length, failedRows, warnings, rows, invalid: parsed.rows.length - valid.length })
}
