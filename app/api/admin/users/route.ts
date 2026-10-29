import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'
import { CUSTOMER_TYPES } from '@/lib/customerTypes'
import { USER_FIELDS, countPasses, toAdminUserRow, type AdminUserRow, type AuthFields } from '@/lib/admin/userStats'

// The Users page's data: every member (users/{uid}; business logins live in
// businesses/ and aren't members) with what Auth knows about them (email
// verified, joined, last sign-in) and how many active passes they hold.
//
// Kept cheap on Firestore, the same way in every Firebase project:
//  - users are read with a field `select`, capped at MAX_USERS; past the
//    cap the per-type totals come from count() aggregations instead, so
//    the breakdown stays exact.
//  - active passes are ONE query (vouchers where status == 'active',
//    userId only), tallied here, not a query per member.
//  - only single-field filters, so no composite index is needed.
//  - the result is cached in this server instance for CACHE_MS; the page's
//    Refresh asks for ?fresh=1 to skip it.
// Auth lookups are free (getUsers, 100 uids a call).

const MAX_USERS = 5000
const CACHE_MS = 5 * 60 * 1000
const AUTH_BATCH = 100

interface UsersPayload {
  users: AdminUserRow[]
  /** Every member, even past the cap. */
  total: number
  /** Members per type ('' = not set), exact even when `truncated`. */
  typeCounts: Record<string, number>
  truncated: boolean
  generatedAt: string
}

let cache: { at: number; payload: UsersPayload } | null = null

export async function GET(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError

  const fresh = new URL(request.url).searchParams.get('fresh') === '1'
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) {
    return NextResponse.json({ ...cache.payload, cached: true })
  }

  try {
    const payload = await loadUsers()
    cache = { at: Date.now(), payload }
    return NextResponse.json({ ...payload, cached: false })
  } catch {
    return NextResponse.json({ error: 'Failed to load users.' }, { status: 500 })
  }
}

async function loadUsers(): Promise<UsersPayload> {
  const db = getAdminDb()
  const users = db.collection('users')
  const [usersSnap, passesSnap] = await Promise.all([
    users.select(...USER_FIELDS).limit(MAX_USERS + 1).get(),
    db.collection('vouchers').where('status', '==', 'active').select('userId').get(),
  ])
  const truncated = usersSnap.size > MAX_USERS
  const docs = usersSnap.docs.slice(0, MAX_USERS)
  const passes = countPasses(passesSnap.docs.map((doc) => doc.get('userId')))

  const authByUid = new Map<string, AuthFields>()
  const auth = getAdminAuth()
  const batches: string[][] = []
  for (let i = 0; i < docs.length; i += AUTH_BATCH) batches.push(docs.slice(i, i + AUTH_BATCH).map((doc) => doc.id))
  const results = await Promise.all(batches.map((uids) => auth.getUsers(uids.map((uid) => ({ uid })))))
  for (const result of results) {
    for (const user of result.users) {
      authByUid.set(user.uid, {
        email: user.email,
        emailVerified: user.emailVerified,
        creationTime: user.metadata.creationTime,
        lastSignInTime: user.metadata.lastSignInTime,
      })
    }
  }

  const rows = docs.map((doc) => toAdminUserRow(doc.id, doc.data(), authByUid.get(doc.id), passes.get(doc.id) ?? 0))

  let total = rows.length
  const typeCounts: Record<string, number> = {}
  if (truncated) {
    const [all, ...perType] = await Promise.all([
      users.count().get(),
      ...CUSTOMER_TYPES.map((type) => users.where('customerType', '==', type.value).count().get()),
    ])
    total = all.data().count
    CUSTOMER_TYPES.forEach((type, i) => (typeCounts[type.value] = perType[i]!.data().count))
    typeCounts[''] = Math.max(0, total - Object.values(typeCounts).reduce((sum, n) => sum + n, 0))
  } else {
    for (const row of rows) typeCounts[row.customerType] = (typeCounts[row.customerType] ?? 0) + 1
  }

  return { users: rows, total, typeCounts, truncated, generatedAt: new Date().toISOString() }
}
