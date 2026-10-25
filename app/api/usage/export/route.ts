import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getAdminDb, getAdminProjectId } from '@/lib/firebase/admin'
import { currentFirebaseDeployTarget } from '@/lib/firebase/envGuard'
import { createIpRateLimiter } from '@/lib/maps/reverseGeocodeLimit'
import { usageExportToken } from '@/lib/usage/peerGuard'
import { countersOf, isMonthKey, USAGE_COLLECTION, type UsageExport } from '@/lib/usage/usageTypes'

// PROD's usage counters for the DEV dashboards (local, Vercel Preview), so
// they never need a PROD credential (lib/usage/peerUsageExport.ts calls
// this). Server to server: Authorization: Bearer USAGE_EXPORT_TOKEN, the
// same value set on both sides. Only on Vercel Production with the token
// set (404 anywhere else), read-only, and only the month's counters -- no
// prices, no daily maps, nothing from any other collection.
// GET ?month=YYYY-MM.

const isRateLimited = createIpRateLimiter(120)
const NO_STORE = { 'Cache-Control': 'no-store' }

const digest = (value: string) => createHash('sha256').update(value).digest()

function tokenMatches(header: string | null, token: string): boolean {
  const presented = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : ''
  // Hashed first, so the comparison is constant-time whatever the lengths.
  return !!presented && timingSafeEqual(digest(presented), digest(token))
}

export async function GET(request: Request) {
  const token = usageExportToken()
  if (!token || currentFirebaseDeployTarget() !== 'production') return NextResponse.json({ error: 'Not found.' }, { status: 404, headers: NO_STORE })
  if (isRateLimited(request)) return NextResponse.json({ error: 'Too many requests.' }, { status: 429, headers: NO_STORE })
  if (!tokenMatches(request.headers.get('authorization'), token)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })

  const month = new URL(request.url).searchParams.get('month')
  if (!isMonthKey(month)) return NextResponse.json({ error: 'Invalid month.' }, { status: 400, headers: NO_STORE })

  try {
    const db = getAdminDb()
    const projectId = getAdminProjectId()
    const [snap, list] = await Promise.all([db.collection(USAGE_COLLECTION).doc(month).get(), db.collection(USAGE_COLLECTION).select().get()])
    const data = snap.exists ? snap.data() : undefined
    if (data?.projectId && data.projectId !== projectId) {
      console.error(`[usage-export] ${USAGE_COLLECTION}/${month} names project ${data.projectId}, not ${projectId}`)
      return NextResponse.json({ error: 'Counters belong to another project.' }, { status: 409, headers: NO_STORE })
    }
    const body: UsageExport = { projectId, month, months: list.docs.map((doc) => doc.id).filter(isMonthKey), counters: countersOf(data) }
    return NextResponse.json(body, { headers: NO_STORE })
  } catch (error) {
    console.error('Usage export failed', error)
    return NextResponse.json({ error: 'Usage data is unavailable right now.' }, { status: 502, headers: NO_STORE })
  }
}
