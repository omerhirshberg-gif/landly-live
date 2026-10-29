import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { endOfIsraelDay } from '@/lib/admin/expiryDate'
import { isOfferActive } from '@/lib/admin/offerStatus'
import { revalidateGuestHome } from '@/lib/admin/revalidateHome'
import { isValidImageUrl } from '@/lib/admin/validateImageUrl'
import { validateOfferPrices } from '@/lib/admin/validateOfferPrices'
import { parseOfferVoucherTerms } from '@/lib/payments/voucherTerms'
import { imageUrlProblem, normalizeImageUrl } from '@/lib/offers/imageUrl'
import { parseOfferRedemption } from '@/lib/offers/redemption'
import { getAdminDb } from '@/lib/firebase/admin'
import { offerPlaceFields } from '@/lib/geo'
import { parseBusinessTranslations } from '@/lib/business/businessText'
import { offerTextSource, translationsForSave } from '@/lib/translate/translateOfferOnSave'

interface RequestBody {
  businessUid: string
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
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export async function GET(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError

  const businessUid = new URL(request.url).searchParams.get('businessUid')

  // Sorted in-memory (not via orderBy) so this doesn't need a composite
  // Firestore index (where + orderBy on different fields requires one).
  const snap = businessUid
    ? await getAdminDb().collection('offers').where('businessId', '==', businessUid).get()
    : await getAdminDb().collection('offers').get()
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
  return NextResponse.json({ offers })
}

export async function POST(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const adminDb = getAdminDb()

  const body = (await request.json().catch(() => null)) as RequestBody | null
  if (!body?.businessUid || !body?.offer) return badRequest('Missing businessUid or offer data.')
  const { businessUid, offer } = body

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

  const businessSnap = await adminDb.collection('businesses').doc(businessUid).get()
  if (!businessSnap.exists) {
    return NextResponse.json({ error: 'Business not found.' }, { status: 404 })
  }
  const business = businessSnap.data()!
  const translated = await translationsForSave(offerTextSource(offer, voucherTerms, redemption), null, body.translationOverrides)
  if (!translated.ok) return badRequest(translated.error)

  const offerRef = adminDb.collection('offers').doc()
  await offerRef.set({
    businessId: businessUid,
    businessName: business.businessName ?? '',
    businessTranslations: parseBusinessTranslations(business.translations),
    ...offerPlaceFields(business),
    // The business's logo (lib/business/businessLogo.ts), for the perk card's badge.
    businessLogoUrl: typeof business.logoUrl === 'string' ? business.logoUrl : '',
    imageUrl,
    title: offer.title,
    description: offer.description,
    originalPrice: offer.originalPrice,
    offerPrice: offer.offerPrice,
    category: business.category ?? '',
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
  revalidateGuestHome()

  return NextResponse.json({
    offerId: offerRef.id,
    offerTitle: offer.title,
    businessName: business.businessName ?? '',
    translationWarning: translated.warning,
  })
}
