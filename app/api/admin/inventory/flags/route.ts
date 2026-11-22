import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { writeAudit } from '@/lib/admin/auditLog'
import { revalidateGuestHome } from '@/lib/admin/revalidateHome'
import { getAdminDb } from '@/lib/firebase/admin'
import { revalidatePublicOffers } from '@/lib/firebase/offersCache.server'
import { FEATURE_FLAGS_DOC } from '@/lib/flags/featureFlags'
import { isRaayonitDisplayEnabled, resetFeatureFlagCache } from '@/lib/flags/featureFlags.server'

// POST { raayonitDisplay: boolean }: the display gate, stored in system_config/feature_flags of THIS project (each Firebase project
// has its own; the env var RAAYONIT_DISPLAY_ENABLED, when set, still wins). Switch it on only after Raayonit approved in writing.
export async function POST(request: Request) {
  const denied = requireAdminAuth(request)
  if (denied) return denied
  const body = await request.json().catch(() => null)
  if (typeof body?.raayonitDisplay !== 'boolean') return NextResponse.json({ error: 'raayonitDisplay must be true or false.' }, { status: 400 })
  const db = getAdminDb()
  const [collection, id] = FEATURE_FLAGS_DOC.split('/') as [string, string]
  await db.collection(collection).doc(id).set({ raayonitDisplay: body.raayonitDisplay, updatedAt: Timestamp.now() }, { merge: true })
  resetFeatureFlagCache()
  revalidatePublicOffers()
  revalidateGuestHome()
  await writeAudit(db, request, { action: 'flag.raayonitDisplay', targetType: 'featureFlag', targetId: 'raayonitDisplay', after: { enabled: body.raayonitDisplay } })
  return NextResponse.json({ raayonitDisplay: await isRaayonitDisplayEnabled(), envOverride: process.env.RAAYONIT_DISPLAY_ENABLED ?? null })
}
