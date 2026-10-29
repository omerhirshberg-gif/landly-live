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
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'
import { offerPlaceFields, parseGeoAddress } from '@/lib/geo'
import { offerTextSource, translationsForSave } from '@/lib/translate/translateOfferOnSave'
import { parseTranslationOverrides } from '@/lib/translate/offerTranslations'
import { parseBusinessNameOverrides } from '@/lib/translate/businessTranslations'
import { businessTranslationsForSave } from '@/lib/translate/translateBusinessOnSave'
import { parseBusinessTranslations } from '@/lib/business/businessText'
import { parseLogoUrl } from '@/lib/business/businessLogo'
import { parseBusinessPhone } from '@/lib/admin/businessPhone'

interface RequestBody {
  business: {
    businessName: string
    businessId: string
    category: string
    location: string
    loginEmail: string
    loginPassword: string
    /** Picked from Places autocomplete; absent when the admin typed a free-text location. */
    address?: unknown
    /** Uploaded (logos/…) or pasted; copied onto the business's offers. Absent or '' = none. */
    logoUrl?: unknown
    /** Optional contact number, local Israeli or "+country"; stored as E.164. */
    phone?: unknown
  }
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
  translationOverrides?: unknown
  /** The admin's own wording for the business name, per language. */
  businessNameOverrides?: unknown
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export async function GET(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError

  const adminDb = getAdminDb()
  const [businessesSnap, offersSnap] = await Promise.all([
    adminDb.collection('businesses').orderBy('businessName').get(),
    adminDb.collection('offers').get(),
  ])

  const activeCounts = new Map<string, number>()
  for (const doc of offersSnap.docs) {
    const o = doc.data()
    const active = isOfferActive({
      totalQuantity: typeof o.totalQuantity === 'number' ? o.totalQuantity : null,
      claimedCount: Number(o.claimedCount) || 0,
      expiryDate: o.expiryDate instanceof Timestamp ? o.expiryDate.toDate() : null,
    })
    if (active) activeCounts.set(o.businessId, (activeCounts.get(o.businessId) ?? 0) + 1)
  }

  const businesses = businessesSnap.docs.map((doc) => ({
    uid: doc.id,
    businessName: doc.data().businessName ?? '',
    translations: parseBusinessTranslations(doc.data().translations),
    businessId: doc.data().businessId ?? '',
    category: doc.data().category ?? '',
    location: doc.data().location ?? '',
    address: parseGeoAddress(doc.data().address),
    logoUrl: typeof doc.data().logoUrl === 'string' ? doc.data().logoUrl : '',
    phone: typeof doc.data().phone === 'string' ? doc.data().phone : '',
    email: doc.data().email ?? '',
    activePerkCount: activeCounts.get(doc.id) ?? 0,
    redeemedTotal: Number(doc.data().voucherStats?.redeemedTotal) || 0,
    createdAt: doc.data().createdAt instanceof Timestamp ? doc.data().createdAt.toDate().toISOString() : null,
  }))
  return NextResponse.json({ businesses })
}

export async function POST(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const adminAuth = getAdminAuth()
  const adminDb = getAdminDb()

  const body = (await request.json().catch(() => null)) as RequestBody | null
  if (!body?.business || !body?.offer) return badRequest('Missing business or offer data.')
  const { business, offer } = body

  const requiredBusinessFields: (keyof RequestBody['business'])[] = [
    'businessName', 'businessId', 'category', 'location', 'loginEmail', 'loginPassword',
  ]
  for (const field of requiredBusinessFields) {
    if (!business[field] || typeof business[field] !== 'string') return badRequest(`Missing business.${field}.`)
  }
  if (!/^\S+@\S+\.\S+$/.test(business.loginEmail)) return badRequest('Invalid login email.')
  if (business.loginPassword.length < 6) return badRequest('Login password must be at least 6 characters.')

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
  const address = business.address === undefined || business.address === null ? null : parseGeoAddress(business.address)
  if (business.address && !address) return badRequest('business.address is not a valid place.')
  const overrides = parseTranslationOverrides(body.translationOverrides)
  if (!overrides.ok) return badRequest(overrides.error)
  const nameOverrides = parseBusinessNameOverrides(body.businessNameOverrides)
  if (!nameOverrides.ok) return badRequest(nameOverrides.error)
  const logo = parseLogoUrl(business.logoUrl)
  if (!logo.ok) return badRequest(logo.error)
  const phone = parseBusinessPhone(business.phone)
  if (!phone.ok) return badRequest(phone.error)

  const duplicate = await adminDb.collection('businesses').where('businessId', '==', business.businessId).limit(1).get()
  if (!duplicate.empty) {
    return NextResponse.json({ error: 'A business with this ח.פ already exists.' }, { status: 409 })
  }

  let uid: string
  try {
    const userRecord = await adminAuth.createUser({
      email: business.loginEmail,
      password: business.loginPassword,
    })
    uid = userRecord.uid
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code
    if (code === 'auth/email-already-exists') {
      return NextResponse.json({ error: 'A business login already uses this email.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create the business login.' }, { status: 500 })
  }

  // Translated before anything is written, so a slow Translation call can't leave a half-created business.
  const [translated, nameTranslated] = await Promise.all([
    translationsForSave(offerTextSource(offer, voucherTerms, redemption), null, overrides.overrides),
    businessTranslationsForSave(business.businessName, null, nameOverrides.overrides),
  ])
  if (!translated.ok || !nameTranslated.ok) {
    await adminAuth.deleteUser(uid)
    return badRequest(!translated.ok ? translated.error : !nameTranslated.ok ? nameTranslated.error : 'Invalid translations.')
  }

  const businessDoc = { location: business.location, ...(address ? { address } : {}) }
  const offerRef = adminDb.collection('offers').doc()
  try {
    const batch = adminDb.batch()
    batch.set(adminDb.collection('businesses').doc(uid), {
      businessName: business.businessName,
      businessId: business.businessId,
      translations: nameTranslated.translations,
      category: business.category,
      ...businessDoc,
      ...(logo.logoUrl ? { logoUrl: logo.logoUrl } : {}),
      ...(phone.phone ? { phone: phone.phone } : {}),
      email: business.loginEmail,
      voucherStats: { active: 0, redeemedTotal: 0, redeemedThisMonth: 0 },
    })
    batch.set(offerRef, {
      businessId: uid,
      businessName: business.businessName,
      businessTranslations: nameTranslated.translations,
      ...offerPlaceFields(businessDoc),
      businessLogoUrl: logo.logoUrl,
      imageUrl,
      title: offer.title,
      description: offer.description,
      originalPrice: offer.originalPrice,
      offerPrice: offer.offerPrice,
      category: business.category,
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
    await batch.commit()
  } catch {
    await adminAuth.deleteUser(uid)
    return NextResponse.json({ error: 'Failed to create the business and offer records.' }, { status: 500 })
  }
  revalidateGuestHome()

  return NextResponse.json({
    uid,
    offerId: offerRef.id,
    offerTitle: offer.title,
    businessName: business.businessName,
    loginEmail: business.loginEmail,
    loginPassword: business.loginPassword,
    translationWarning: [nameTranslated.warning, translated.warning].filter(Boolean).join(' ') || null,
  })
}
