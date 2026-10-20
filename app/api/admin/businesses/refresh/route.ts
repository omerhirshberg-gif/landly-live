import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { getAdminDb } from '@/lib/firebase/admin'
import { isAddressStale, offerPlaceFields, parseGeoAddress, type GeoAddress } from '@/lib/geo'
import { businessNameOverridesOf, parseBusinessTranslations } from '@/lib/business/businessText'
import { isMapsConfigured, placeAddress } from '@/lib/maps/googleMaps'
import { activeTranslator } from '@/lib/translate/cloudTranslate'
import { buildBusinessTranslations } from '@/lib/translate/businessTranslations'

export const maxDuration = 60

// "Refresh addresses and translate names" on /admin/businesses. For each
// business: translates a Hebrew name that has no (or a stale) translation,
// and fetches the address again by its place id when a language is missing
// or it's older than ADDRESS_REFRESH_DAYS (Google's terms limit how long
// Places content may be kept; the place id itself may be kept). Changes are
// copied onto the business's offers, like an edit. Businesses already up to
// date cost nothing, so the page calls again while `remaining` > 0 and each
// call gets further, staying inside the function time limit.
const TIME_BUDGET_MS = 40_000

export async function POST(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError

  const adminDb = getAdminDb()
  const translator = activeTranslator()
  const maps = isMapsConfigured()
  const startedAt = Date.now()
  const snap = await adminDb.collection('businesses').get()
  let checked = 0
  let updated = 0
  let failed = 0
  for (const doc of snap.docs) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break
    checked += 1
    const data = doc.data()

    const existing = parseBusinessTranslations(data.translations)
    const name = typeof data.businessName === 'string' ? data.businessName : ''
    const named = await buildBusinessTranslations(name, existing, businessNameOverridesOf(existing), translator)
    if (named.warning) failed += 1
    const nameChanged = named.translatedCount > 0 || !existing

    const stored = parseGeoAddress(data.address)
    let address: GeoAddress | null = stored
    if (maps && stored && isAddressStale(stored)) {
      try {
        address = (await placeAddress(stored.placeId)) ?? stored
      } catch (error) {
        console.error(`Address refresh failed for business ${doc.id}`, error)
        failed += 1
      }
    }
    const addressChanged = address !== stored

    if (!nameChanged && !addressChanged) continue
    const offersSnap = await adminDb.collection('offers').where('businessId', '==', doc.id).get()
    if (offersSnap.size > 499) {
      failed += 1
      continue
    }
    const batch = adminDb.batch()
    batch.update(doc.ref, { translations: named.translations, ...(address ? { address } : {}) })
    const place = offerPlaceFields({ location: data.location, address })
    for (const offer of offersSnap.docs) {
      batch.update(offer.ref, { businessTranslations: named.translations, ...place })
    }
    await batch.commit()
    updated += 1
  }
  return NextResponse.json({
    checked,
    updated,
    failed,
    remaining: snap.size - checked,
    translationEnabled: !!translator,
    mapsConfigured: maps,
  })
}
