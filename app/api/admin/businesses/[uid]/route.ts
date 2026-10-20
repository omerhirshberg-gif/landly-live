import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { revalidateGuestHome } from '@/lib/admin/revalidateHome'
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'
import { offerPlaceFields, parseGeoAddress } from '@/lib/geo'
import { deleteBannerByUrl } from '@/lib/storage/banners'
import { businessTranslationsForSave } from '@/lib/translate/translateBusinessOnSave'

interface PatchBody {
  business: {
    businessName: string
    category: string
    location: string
    /** Picked from Places autocomplete; null clears a stale one when the admin types free text. */
    address?: unknown
  }
  /** The admin's own wording for the name, per language; the rest is Google's (Hebrew names only). */
  businessNameOverrides?: unknown
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

// Edits what the admin can change after onboarding: the name (and its
// translations), category and address. Offers carry copies of all of it
// (plus the address's coordinates, city and lines in each language, for
// cards and "Near me"), so they're rewritten in the same batch. Vouchers and
// orders keep the name and address they were bought under.
export async function PATCH(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const adminDb = getAdminDb()

  const { uid } = await params
  const body = (await request.json().catch(() => null)) as PatchBody | null
  const business = body?.business
  if (!business) return badRequest('Missing business data.')
  for (const field of ['businessName', 'category', 'location'] as const) {
    if (typeof business[field] !== 'string' || !business[field].trim()) return badRequest(`Missing business.${field}.`)
  }
  const address = business.address === undefined || business.address === null ? null : parseGeoAddress(business.address)
  if (business.address && !address) return badRequest('business.address is not a valid place.')

  const businessRef = adminDb.collection('businesses').doc(uid)
  const businessSnap = await businessRef.get()
  if (!businessSnap.exists) {
    return NextResponse.json({ error: 'Business not found.' }, { status: 404 })
  }

  const fields = {
    businessName: business.businessName.trim(),
    category: business.category.trim(),
    location: business.location.trim(),
  }
  // An unchanged name costs nothing: only a changed (Hebrew) name goes to Google.
  const translated = await businessTranslationsForSave(fields.businessName, businessSnap.data()?.translations, body?.businessNameOverrides)
  if (!translated.ok) return badRequest(translated.error)
  const offersSnap = await adminDb.collection('offers').where('businessId', '==', uid).get()
  // A batch holds 500 writes; one is the business itself.
  if (offersSnap.size > 499) return NextResponse.json({ error: 'Too many offers to update in one save.' }, { status: 500 })
  const batch = adminDb.batch()
  batch.update(businessRef, { ...fields, translations: translated.translations, address: address ?? FieldValue.delete() })
  const place = offerPlaceFields({ location: fields.location, address })
  for (const doc of offersSnap.docs) {
    batch.update(doc.ref, { businessName: fields.businessName, businessTranslations: translated.translations, category: fields.category, ...place })
  }
  await batch.commit()
  revalidateGuestHome()

  return NextResponse.json({
    updated: true,
    updatedOfferCount: offersSnap.size,
    translations: translated.translations,
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
    const batch = adminDb.batch()
    for (const doc of offersSnap.docs) batch.delete(doc.ref)
    batch.delete(businessRef)
    await batch.commit()
  } catch {
    return NextResponse.json({
      error: 'The login account was removed, but deleting the business and offer records failed. They need manual cleanup in Firestore -- the email is already freed for reuse.',
    }, { status: 500 })
  }
  revalidateGuestHome()
  await Promise.all(offersSnap.docs.map((doc) => deleteBannerByUrl(doc.data().imageUrl)))

  return NextResponse.json({ deletedOfferCount: offersSnap.size })
}
