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
import { poolPriceProblem, readSharedPoolTerms } from '@/lib/inventory/poolAdmin'
import { offerPlaceFields } from '@/lib/geo'
import { parsePerkScopeFields } from '@/lib/offers/perkScope'
import { BUSINESS_CATEGORIES } from '@/lib/categories'
import { businessTranslationsForSave } from '@/lib/translate/translateBusinessOnSave'
import { parseBusinessTranslations } from '@/lib/business/businessText'
import { offerTextSource, translationsForSave } from '@/lib/translate/translateOfferOnSave'

interface RequestBody {
  /** A local-business perk's business. Absent for a Raayonit perk, which has a brand instead. */
  businessUid?: string
  /** A Raayonit perk's brand and scope (lib/offers/perkScope.ts), plus its category. */
  perk?: { perkScope?: string; brandName?: string; participatingChains?: unknown; participatingPlaces?: unknown; universalRedemptionGuide?: unknown; category?: string }
  offer: {
    title: string
    description: string
    originalPrice: number
    offerPrice: number
    imageUrl?: string
    expiryDate: string | null
    totalQuantity: number | null
    isBestseller?: boolean
    isNationwide?: boolean
    participatingChains?: unknown
    participatingPlaces?: unknown
    validityDays?: number
    redemptionTerms?: string
    redemptionMethod?: string
    redemptionInstructions?: string
  }
  /** The admin's own translations, per language and field (lib/translate/offerTranslations.ts). */
  translationOverrides?: unknown
  /** A Raayonit offer: the shared voucher stock it draws from (stocks are created and filled on the inventory page). */
  poolId?: string
}

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
  const raayonit = typeof body.poolId === 'string' && body.poolId !== ''
  // A manual multi-chain pass is a direct perk with no business: its issuer's brand stands in, as for Raayonit.
  const manualChain = !raayonit && body.perk?.perkScope === 'multi_chain'
  const noBusiness = raayonit || manualChain
  // The business is read first: a chain's new offer is nationwide unless the admin turned that off.
  let business: FirebaseFirestore.DocumentData = {}
  if (!noBusiness && typeof body.businessUid === 'string' && body.businessUid) {
    const businessSnap = await adminDb.collection('businesses').doc(body.businessUid).get()
    if (!businessSnap.exists) return NextResponse.json({ error: 'Business not found.' }, { status: 404 })
    business = businessSnap.data()!
  }
  const scope = parsePerkScopeFields({
    fulfillmentType: raayonit ? 'raayonit_pool' : 'direct_merchant',
    businessId: noBusiness ? undefined : body.businessUid,
    ...(noBusiness ? { ...body.perk, businessId: body.businessUid } : {}),
    isNationwide: offer.isNationwide === undefined ? !noBusiness && business.isChain === true : offer.isNationwide === true,
    ...(noBusiness ? {} : { participatingChains: offer.participatingChains, participatingPlaces: offer.participatingPlaces }),
  })
  if (!scope.ok) return badRequest(scope.error)
  const category = body.perk?.category
  if (noBusiness && !(BUSINESS_CATEGORIES as readonly string[]).includes(category ?? '')) return badRequest('Choose a category for this perk.')

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

  // A Raayonit perk and a manual multi-chain pass have no business document: the brand name stands in for the business name.
  const displayName: string = noBusiness ? scope.fields.brandName! : business.businessName ?? ''
  const translated = await translationsForSave(offerTextSource(offer, voucherTerms, redemption), null, body.translationOverrides)
  if (!translated.ok) return badRequest(translated.error)
  // The brand's name in the other languages, when it is written in Hebrew letters (a Latin-script brand stays as written).
  const brandTranslations = noBusiness ? await businessTranslationsForSave(displayName, null, undefined) : null

  // A Raayonit offer sells exactly what its stock holds: same face value, same price.
  let poolId: string | null = null
  if (raayonit) {
    const terms = await readSharedPoolTerms(adminDb, body.poolId)
    if (!terms) return badRequest('Choose a voucher stock for this offer.')
    const mismatch = poolPriceProblem(terms, offer.originalPrice, offer.offerPrice)
    if (mismatch) return badRequest(mismatch)
    poolId = body.poolId!
  }

  const offerRef = adminDb.collection('offers').doc()
  await offerRef.set({
    ...scope.fields,
    fulfillmentType: raayonit ? 'raayonit_pool' : 'direct_merchant',
    businessName: displayName,
    businessTranslations: noBusiness ? (brandTranslations?.ok ? brandTranslations.translations : null) : parseBusinessTranslations(business.translations),
    ...offerPlaceFields(business),
    // The business's logo (lib/business/businessLogo.ts), for the perk card's badge.
    businessLogoUrl: typeof business.logoUrl === 'string' ? business.logoUrl : '',
    imageUrl,
    title: offer.title,
    description: offer.description,
    originalPrice: offer.originalPrice,
    offerPrice: offer.offerPrice,
    category: noBusiness ? category : business.category ?? '',
    createdAt: Timestamp.now(),
    isBestseller: !!offer.isBestseller,
    expiryDate: offer.expiryDate ? Timestamp.fromDate(endOfIsraelDay(offer.expiryDate)) : null,
    totalQuantity: raayonit ? null : offer.totalQuantity,
    ...(poolId ? { poolId } : {}),
    claimedCount: 0,
    validityDays: voucherTerms.validityDays,
    redemptionTerms: voucherTerms.redemptionTerms,
    redemptionMethod: redemption.redemptionMethod,
    redemptionInstructions: redemption.redemptionInstructions,
    translations: translated.translations,
  })

  revalidateGuestHome()

  return NextResponse.json({
    offerId: offerRef.id,
    offerTitle: offer.title,
    businessName: displayName,
    translationWarning: translated.warning,
  })
}
