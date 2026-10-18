import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { isValidImageUrl } from '@/lib/admin/validateImageUrl'
import { validateOfferPrices } from '@/lib/admin/validateOfferPrices'
import { parseOfferVoucherTerms } from '@/lib/payments/voucherTerms'
import { imageUrlProblem, normalizeImageUrl } from '@/lib/offers/imageUrl'
import { parseOfferRedemption } from '@/lib/offers/redemption'
import { getAdminDb } from '@/lib/firebase/admin'

interface PatchBody {
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
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ offerId: string }> }) {
  const authError = requireAdminAuth(request)
  if (authError) return authError

  const { offerId } = await params
  const ref = getAdminDb().collection('offers').doc(offerId)
  const snap = await ref.get()
  if (!snap.exists) {
    return NextResponse.json({ error: 'Offer not found.' }, { status: 404 })
  }
  await ref.delete()
  return NextResponse.json({ deleted: true })
}

// Never touches claimedCount, businessId, businessName, location, category, or
// createdAt — those are either denormalized from the business, immutable, or
// (for category/business reassignment) a separate, more sensitive operation
// not supported by this form.
export async function PATCH(request: Request, { params }: { params: Promise<{ offerId: string }> }) {
  const authError = requireAdminAuth(request)
  if (authError) return authError

  const { offerId } = await params
  const body = (await request.json().catch(() => null)) as PatchBody | null
  if (!body?.offer) return badRequest('Missing offer data.')
  const { offer } = body

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

  const ref = getAdminDb().collection('offers').doc(offerId)
  const snap = await ref.get()
  if (!snap.exists) {
    return NextResponse.json({ error: 'Offer not found.' }, { status: 404 })
  }
  const claimedCount = Number(snap.data()?.claimedCount) || 0
  if (offer.totalQuantity !== null && offer.totalQuantity < claimedCount) {
    return badRequest(`offer.totalQuantity can't be less than the ${claimedCount} claim(s) this offer already has.`)
  }

  await ref.update({
    title: offer.title,
    description: offer.description,
    originalPrice: offer.originalPrice,
    offerPrice: offer.offerPrice,
    imageUrl,
    expiryDate: offer.expiryDate ? Timestamp.fromDate(new Date(offer.expiryDate)) : null,
    totalQuantity: offer.totalQuantity,
    isBestseller: !!offer.isBestseller,
    // Orders already created keep the terms they were shown (see initiateOrder).
    validityDays: voucherTerms.validityDays,
    redemptionTerms: voucherTerms.redemptionTerms,
    redemptionMethod: redemption.redemptionMethod,
    redemptionInstructions: redemption.redemptionInstructions,
  })

  return NextResponse.json({ updated: true })
}
