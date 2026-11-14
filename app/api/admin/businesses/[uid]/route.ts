import { NextResponse } from 'next/server'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { isOfferActive } from '@/lib/admin/offerStatus'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { chunked } from '@/lib/firebase/batching'
import { revalidateGuestHome } from '@/lib/admin/revalidateHome'
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'
import { offerPlaceFields, parseGeoAddress } from '@/lib/geo'
import { parseLogoUrl } from '@/lib/business/businessLogo'
import { parseBusinessPhone } from '@/lib/admin/businessPhone'
import { deleteBannerByUrl, deleteLogoByUrl } from '@/lib/storage/banners'
import { businessTranslationsForSave } from '@/lib/translate/translateBusinessOnSave'

interface PatchBody {
  business: {
    businessName: string
    category: string
    location: string
    /** Picked from Places autocomplete; null clears a stale one when the admin types free text. */
    address?: unknown
    /** Uploaded (logos/…) or pasted; '' removes it. Absent keeps the stored one. */
    logoUrl?: unknown
    /** Contact number (local Israeli or "+country"); '' removes it. Absent keeps the stored one. */
    phone?: unknown
    /** A nationwide chain / multi-branch business: the location is optional (headquarters only) and its offers carry no address. */
    isChain?: unknown
  }
  /** With isChain on: also mark the business's live offers nationwide (never vouchers already issued). */
  markExistingNationwide?: unknown
  /** The admin's own wording for the name, per language; the rest is Google's (Hebrew names only). */
  businessNameOverrides?: unknown
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

// Edits what the admin can change after onboarding: the name (and its
// translations), category, address, logo and contact phone. Offers carry
// copies of all of it but the phone (plus the address's coordinates, city
// and lines in each language, for cards and "Near me"), so they're
// rewritten in the same batch. A replaced
// or removed uploaded logo is deleted once the batch has landed. Vouchers
// and orders keep the name and address they were bought under.
export async function PATCH(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const adminDb = getAdminDb()

  const { uid } = await params
  const body = (await request.json().catch(() => null)) as PatchBody | null
  const business = body?.business
  if (!business) return badRequest('Missing business data.')
  const isChain = business.isChain === true
  // A chain's location is its headquarters and may be empty.
  for (const field of ['businessName', 'category', ...(isChain ? [] : ['location' as const])] as const) {
    if (typeof business[field] !== 'string' || !business[field].trim()) return badRequest(`Missing business.${field}.`)
  }
  if (business.location !== undefined && typeof business.location !== 'string') return badRequest('business.location must be text.')
  const address = business.address === undefined || business.address === null ? null : parseGeoAddress(business.address)
  if (business.address && !address) return badRequest('business.address is not a valid place.')
  const logo = parseLogoUrl(business.logoUrl)
  if (!logo.ok) return badRequest(logo.error)
  const phone = parseBusinessPhone(business.phone)
  if (!phone.ok) return badRequest(phone.error)

  const businessRef = adminDb.collection('businesses').doc(uid)
  const businessSnap = await businessRef.get()
  if (!businessSnap.exists) {
    return NextResponse.json({ error: 'Business not found.' }, { status: 404 })
  }

  const fields = {
    businessName: business.businessName.trim(),
    category: business.category.trim(),
    location: (business.location ?? '').trim(),
  }
  // Only a chain's offers marked nationwide lose their address: a single-branch offer keeps the one it was saved with.
  const markExisting = isChain && body?.markExistingNationwide === true
  // An unchanged name costs nothing: only a changed (Hebrew) name goes to Google.
  const storedLogo = typeof businessSnap.data()?.logoUrl === 'string' ? (businessSnap.data()?.logoUrl as string) : ''
  const logoUrl = business.logoUrl === undefined ? storedLogo : logo.logoUrl
  const translated = await businessTranslationsForSave(fields.businessName, businessSnap.data()?.translations, body?.businessNameOverrides)
  if (!translated.ok) return badRequest(translated.error)
  const offersSnap = await adminDb.collection('offers').where('businessId', '==', uid).limit(500).get()
  // A batch holds 500 writes; one is the business itself.
  if (offersSnap.size > 499) return NextResponse.json({ error: 'Too many offers to update in one save.' }, { status: 500 })
  const batch = adminDb.batch()
  batch.update(businessRef, {
    ...fields,
    translations: translated.translations,
    address: address ?? FieldValue.delete(),
    isChain: isChain ? true : FieldValue.delete(),
    logoUrl: logoUrl || FieldValue.delete(),
    // The phone is the business's own: offers don't copy it.
    ...(business.phone === undefined ? {} : { phone: phone.phone || FieldValue.delete() }),
  })
  const place = offerPlaceFields({ location: fields.location, address })
  const chainPlace = offerPlaceFields({ isChain: true })
  let markedNationwide = 0
  for (const doc of offersSnap.docs) {
    const o = doc.data()
    const live = isOfferActive({
      totalQuantity: typeof o.totalQuantity === 'number' ? o.totalQuantity : null,
      claimedCount: Number(o.claimedCount) || 0,
      expiryDate: o.expiryDate instanceof Timestamp ? o.expiryDate.toDate() : null,
    })
    const mark = markExisting && live && o.isNationwide !== true
    if (mark) markedNationwide += 1
    const nationwide = o.isNationwide === true || mark
    batch.update(doc.ref, {
      businessName: fields.businessName,
      businessTranslations: translated.translations,
      businessLogoUrl: logoUrl,
      category: fields.category,
      ...(mark ? { isNationwide: true } : {}),
      // A chain's nationwide offers carry no address; its other offers, and every offer of an ordinary business, keep the business's.
      ...(isChain ? (nationwide ? chainPlace : {}) : place),
    })
  }
  await batch.commit()
  revalidateGuestHome()
  if (storedLogo !== logoUrl) await deleteLogoByUrl(storedLogo)

  return NextResponse.json({
    updated: true,
    updatedOfferCount: offersSnap.size,
    markedNationwideCount: markedNationwide,
    isChain,
    translations: translated.translations,
    logoUrl,
    phone: business.phone === undefined ? (typeof businessSnap.data()?.phone === 'string' ? businessSnap.data()?.phone : '') : phone.phone,
    translationWarning: translated.warning,
  })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const adminDb = getAdminDb()

  const { uid } = await params
  const businessRef = adminDb.collection('businesses').doc(uid)
  const businessSnap = await businessRef.get()
  if (!businessSnap.exists) {
    return NextResponse.json({ error: 'Business not found.' }, { status: 404 })
  }

  // Auth goes first: a login account left behind after Firestore cleanup
  // silently blocks its email from ever being reused (the orphan problem).
  // A leftover Firestore doc if the second step below fails is harmless by
  // comparison -- it's inert and doesn't block anything -- so that's the
  // direction this is allowed to fail in.
  try {
    await getAdminAuth().deleteUser(uid)
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code
    if (code !== 'auth/user-not-found') {
      return NextResponse.json({ error: 'Failed to remove the login account. Nothing was deleted; please retry.' }, { status: 500 })
    }
  }

  // Cascade: an offer left behind after its business is gone would break
  // claiming for it (claimOffer's transaction updates the business doc,
  // which would no longer exist) -- vouchers already claimed are untouched,
  // they're self-contained via denormalized fields.
  const offersSnap = await adminDb.collection('offers').where('businessId', '==', uid).get()
  try {
    // Deleted in batches of 400 (a batch holds 500 writes), the business last, so a business
    // with any number of offers cleans up and a failure part-way leaves the business to retry.
    for (const docs of chunked(offersSnap.docs, 400)) {
      const batch = adminDb.batch()
      for (const doc of docs) batch.delete(doc.ref)
      await batch.commit()
    }
    await businessRef.delete()
  } catch {
    return NextResponse.json({
      error: 'The login account was removed, but deleting the business and offer records failed. They need manual cleanup in Firestore -- the email is already freed for reuse.',
    }, { status: 500 })
  }
  revalidateGuestHome()
  await Promise.all([
    ...offersSnap.docs.map((doc) => deleteBannerByUrl(doc.data().imageUrl)),
    deleteLogoByUrl(businessSnap.data()?.logoUrl),
  ])

  return NextResponse.json({ deletedOfferCount: offersSnap.size })
}
