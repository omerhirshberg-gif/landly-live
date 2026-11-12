import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { endOfIsraelDay } from '@/lib/admin/expiryDate'
import { isOfferActive } from '@/lib/admin/offerStatus'
import { adminListParams, adminNextCursor } from '@/lib/admin/adminList'
import { revalidateGuestHome } from '@/lib/admin/revalidateHome'
import { isValidImageUrl } from '@/lib/admin/validateImageUrl'
import { validateOfferPrices } from '@/lib/admin/validateOfferPrices'
import { parseOfferVoucherTerms } from '@/lib/payments/voucherTerms'
import { imageUrlProblem, normalizeImageUrl } from '@/lib/offers/imageUrl'
import { parseOfferRedemption } from '@/lib/offers/redemption'
import { getAdminDb } from '@/lib/firebase/admin'
import { parseFulfillmentType } from '@/lib/inventory/types'
import { addPoolEntries, createPool, deletePoolCascade } from '@/lib/inventory/poolAdmin'
import { validateSheetEntry } from '@/lib/inventory/parseCodeSheet'
import { CipherConfigError } from '@/lib/crypto/fieldCipher'
import { PaymentError } from '@/lib/payments/paymentValidation'
import { offerPlaceFields } from '@/lib/geo'
import { parsePerkScopeFields } from '@/lib/offers/perkScope'
import { BUSINESS_CATEGORIES } from '@/lib/categories'
import { parseBusinessTranslations } from '@/lib/business/businessText'
import { offerTextSource, translationsForSave } from '@/lib/translate/translateOfferOnSave'

interface RequestBody {
  /** A local-business perk's business. Absent for a Multipass perk, which has a brand instead. */
  businessUid?: string
  /** A Multipass perk's brand and scope (lib/offers/perkScope.ts), plus its category. */
  perk?: { perkScope?: string; brandName?: string; participatingChains?: unknown; universalRedemptionGuide?: unknown; category?: string }
  offer: {
    title: string
    description: string
    originalPrice: number
    offerPrice: number
    imageUrl?: string
    expiryDate: string | null
    totalQuantity: number | null
    isBestseller?: boolean
    validityDays?: number
    redemptionTerms?: string
    redemptionMethod?: string
    redemptionInstructions?: string
  }
  /** The admin's own translations, per language and field (lib/translate/offerTranslations.ts). */
  translationOverrides?: unknown
  /** A Multipass offer: its pool, created with the offer. */
  pool?: { unitCost: number; warningThreshold: number }
  /** The supplier sheet's rows (lib/inventory/parseCodeSheet), stored encrypted with the pool; re-checked here. */
  codeRows?: unknown[]
}

const MAX_CODE_ROWS = 2000

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export async function GET(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError

  const businessUid = new URL(request.url).searchParams.get('businessUid')
  const scope = `admin:offers:${businessUid ?? '*'}`
  let page
  try { page = adminListParams(request, scope) }
  catch (error) { return badRequest(error instanceof Error ? error.message : 'Invalid pagination.') }

  // Read in id order (an equality filter plus __name__ needs no composite index), at most one
  // page of it; sorted by title in memory below so the screen's order is unchanged.
  let query = businessUid ? getAdminDb().collection('offers').where('businessId', '==', businessUid) : getAdminDb().collection('offers')
  query = query.orderBy('__name__')
  if (page.cursor) query = query.startAfter(page.cursor.id)
  const fetched = await query.limit(page.limit + 1).get()
  const hasMore = fetched.docs.length > page.limit
  const snap = { docs: fetched.docs.slice(0, page.limit) }
  const offers = snap.docs
    .map((doc) => {
      const data = doc.data()
      const expiryDate = data.expiryDate instanceof Timestamp ? data.expiryDate.toDate() : null
      const totalQuantity = typeof data.totalQuantity === 'number' ? data.totalQuantity : null
      const claimedCount = Number(data.claimedCount) || 0
      return {
        id: doc.id,
        title: data.title ?? '',
        businessId: data.businessId ?? '',
        businessName: data.businessName ?? '',
        category: typeof data.category === 'string' ? data.category : '',
        fulfillmentType: parseFulfillmentType(data.fulfillmentType),
        poolId: typeof data.poolId === 'string' ? data.poolId : null,
        imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : '',
        businessLogoUrl: typeof data.businessLogoUrl === 'string' ? data.businessLogoUrl : '',
        originalPrice: Number(data.originalPrice) || 0,
        offerPrice: Number(data.offerPrice) || 0,
        expiryDate: expiryDate ? expiryDate.toISOString() : null,
        totalQuantity,
        claimedCount,
        active: isOfferActive({ totalQuantity, claimedCount, expiryDate }),
      }
    })
    .sort((a, b) => a.title.localeCompare(b.title))
  return NextResponse.json({ offers, nextCursor: adminNextCursor(hasMore, snap.docs.at(-1)?.id, scope) })
}

export async function POST(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const adminDb = getAdminDb()

  const body = (await request.json().catch(() => null)) as RequestBody | null
  if (!body?.offer) return badRequest('Missing offer data.')
  const { offer } = body
  const multipass = !!body.pool
  const scope = parsePerkScopeFields({
    fulfillmentType: multipass ? 'multipass_pool' : 'direct_merchant',
    businessId: multipass ? undefined : body.businessUid,
    ...(multipass ? { ...body.perk, businessId: body.businessUid } : {}),
  })
  if (!scope.ok) return badRequest(scope.error)
  const category = body.perk?.category
  if (multipass && !(BUSINESS_CATEGORIES as readonly string[]).includes(category ?? '')) return badRequest('Choose a category for a Multipass perk.')

  if (!offer.title || typeof offer.title !== 'string') return badRequest('Missing offer.title.')
  if (offer.totalQuantity !== null && (!Number.isInteger(offer.totalQuantity) || offer.totalQuantity < 1)) {
    return badRequest('offer.totalQuantity must be a positive integer or null.')
  }
  const priceError = validateOfferPrices(Number(offer.originalPrice), Number(offer.offerPrice))
  if (priceError) return badRequest(priceError)
  const imageUrl = normalizeImageUrl(typeof offer.imageUrl === 'string' ? offer.imageUrl : '')
  if (imageUrl && !isValidImageUrl(imageUrl)) return badRequest('offer.imageUrl must be a valid http(s) URL.')
  const imageProblem = imageUrl ? imageUrlProblem(imageUrl) : null
  if (imageProblem) return badRequest(`offer.imageUrl: ${imageProblem}`)
  const voucherTerms = parseOfferVoucherTerms(offer)
  if (!voucherTerms.ok) return badRequest(voucherTerms.error)
  const redemption = parseOfferRedemption(offer)
  if (!redemption.ok) return badRequest(redemption.error)

  // A Multipass perk has no business document: its brand name stands in for the business name.
  let business: FirebaseFirestore.DocumentData = {}
  if (!multipass) {
    const businessSnap = await adminDb.collection('businesses').doc(scope.fields.businessId!).get()
    if (!businessSnap.exists) {
      return NextResponse.json({ error: 'Business not found.' }, { status: 404 })
    }
    business = businessSnap.data()!
  }
  const displayName: string = multipass ? scope.fields.brandName! : business.businessName ?? ''
  const translated = await translationsForSave(offerTextSource(offer, voucherTerms, redemption), null, body.translationOverrides)
  if (!translated.ok) return badRequest(translated.error)

  let poolInput: { unitCostAgorot: number; retailPriceAgorot: number; warningThreshold: number } | null = null
  let codeEntries: { code: string; pin: string | null; expiresAt: Date | null }[] = []
  if (body.pool) {
    const unitCost = Number(body.pool.unitCost)
    const warningThreshold = Number(body.pool.warningThreshold)
    if (!Number.isFinite(unitCost) || unitCost < 0) return badRequest('pool.unitCost must be 0 or more.')
    if (!Number.isInteger(warningThreshold) || warningThreshold < 0) return badRequest('pool.warningThreshold must be a whole number, 0 or more.')
    poolInput = { unitCostAgorot: Math.round(unitCost * 100), retailPriceAgorot: Math.round(Number(offer.originalPrice) * 100), warningThreshold }
    if (body.codeRows !== undefined) {
      if (!Array.isArray(body.codeRows) || body.codeRows.length > MAX_CODE_ROWS) return badRequest(`Send at most ${MAX_CODE_ROWS} code rows.`)
      codeEntries = body.codeRows.flatMap((raw) => {
        const row = validateSheetEntry(raw)
        return row ? [{ code: row.code, pin: row.pin, expiresAt: row.expiresAt ? endOfIsraelDay(row.expiresAt) : null }] : []
      })
      if (body.codeRows.length > 0 && codeEntries.length === 0) return badRequest('None of the code rows are valid.')
    }
  }

  const offerRef = adminDb.collection('offers').doc()
  await offerRef.set({
    ...scope.fields,
    fulfillmentType: multipass ? 'multipass_pool' : 'direct_merchant',
    businessName: displayName,
    businessTranslations: multipass ? null : parseBusinessTranslations(business.translations),
    ...offerPlaceFields(business),
    // The business's logo (lib/business/businessLogo.ts), for the perk card's badge.
    businessLogoUrl: typeof business.logoUrl === 'string' ? business.logoUrl : '',
    imageUrl,
    title: offer.title,
    description: offer.description,
    originalPrice: offer.originalPrice,
    offerPrice: offer.offerPrice,
    category: multipass ? category : business.category ?? '',
    createdAt: Timestamp.now(),
    isBestseller: !!offer.isBestseller,
    expiryDate: offer.expiryDate ? Timestamp.fromDate(endOfIsraelDay(offer.expiryDate)) : null,
    totalQuantity: offer.totalQuantity,
    claimedCount: 0,
    validityDays: voucherTerms.validityDays,
    redemptionTerms: voucherTerms.redemptionTerms,
    redemptionMethod: redemption.redemptionMethod,
    redemptionInstructions: redemption.redemptionInstructions,
    translations: translated.translations,
  })

  // A Multipass offer's pool and first codes follow the offer. If any of it fails, everything
  // written so far is removed again, so a failed upload never leaves a sold-out offer behind.
  let codes: { added: number; duplicates: number; invalid: number } | null = null
  if (poolInput) {
    try {
      await createPool(adminDb, { offerId: offerRef.id, ...poolInput })
      if (codeEntries.length > 0) codes = await addPoolEntries(adminDb, offerRef.id, codeEntries)
      if (codeEntries.length > 0 && codes?.added === 0) throw new PaymentError('No new codes could be stored.', 400)
    } catch (err) {
      await deletePoolCascade(adminDb, offerRef.id).catch((e) => console.error('Pool rollback failed', e))
      await offerRef.delete().catch((e) => console.error('Offer rollback failed', e))
      if (err instanceof PaymentError) return NextResponse.json({ error: err.message, rolledBack: true }, { status: err.status })
      if (err instanceof CipherConfigError) return NextResponse.json({ error: 'Code encryption key is not configured on the server.', rolledBack: true }, { status: 503 })
      console.error('Multipass offer creation failed', err)
      return NextResponse.json({ error: 'Could not store the codes. Nothing was created.', rolledBack: true }, { status: 500 })
    }
  }
  revalidateGuestHome()

  return NextResponse.json({
    codes,
    offerId: offerRef.id,
    offerTitle: offer.title,
    businessName: displayName,
    translationWarning: translated.warning,
  })
}
