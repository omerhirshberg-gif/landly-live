import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { isAdminPassword } from '@/lib/admin/checkAdminPassword'
import { isOfferActive } from '@/lib/admin/offerStatus'
import { isValidImageUrl } from '@/lib/admin/validateImageUrl'
import { validateOfferPrices } from '@/lib/admin/validateOfferPrices'
import { getAdminDb } from '@/lib/firebase/admin'

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
  }
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization') ?? ''
  const password = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null
  if (!isAdminPassword(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const businessUid = new URL(request.url).searchParams.get('businessUid')
  if (!businessUid) return badRequest('Missing businessUid query param.')

  // Sorted in-memory (not via orderBy) so this doesn't need a composite
  // Firestore index (where + orderBy on different fields requires one).
  const snap = await getAdminDb().collection('offers').where('businessId', '==', businessUid).get()
  const offers = snap.docs
    .map((doc) => {
      const data = doc.data()
      const expiryDate = data.expiryDate instanceof Timestamp ? data.expiryDate.toDate() : null
      const totalQuantity = typeof data.totalQuantity === 'number' ? data.totalQuantity : null
      const claimedCount = Number(data.claimedCount) || 0
      return {
        id: doc.id,
        title: data.title ?? '',
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
  const authHeader = request.headers.get('authorization') ?? ''
  const password = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null
  if (!isAdminPassword(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
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
  const imageUrl = typeof offer.imageUrl === 'string' ? offer.imageUrl.trim() : ''
  if (imageUrl && !isValidImageUrl(imageUrl)) return badRequest('offer.imageUrl must be a valid http(s) URL.')

  const businessSnap = await adminDb.collection('businesses').doc(businessUid).get()
  if (!businessSnap.exists) {
    return NextResponse.json({ error: 'Business not found.' }, { status: 404 })
  }
  const business = businessSnap.data()!

  const offerRef = adminDb.collection('offers').doc()
  await offerRef.set({
    businessId: businessUid,
    businessName: business.businessName ?? '',
    location: business.location ?? '',
    imageUrl,
    title: offer.title,
    description: offer.description,
    originalPrice: offer.originalPrice,
    offerPrice: offer.offerPrice,
    category: business.category ?? '',
    createdAt: Timestamp.now(),
    isBestseller: !!offer.isBestseller,
    expiryDate: offer.expiryDate ? Timestamp.fromDate(new Date(offer.expiryDate)) : null,
    totalQuantity: offer.totalQuantity,
    claimedCount: 0,
  })

  return NextResponse.json({
    offerId: offerRef.id,
    offerTitle: offer.title,
    businessName: business.businessName ?? '',
  })
}
