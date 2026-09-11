import { NextResponse } from 'next/server'
import { isAdminPassword } from '@/lib/admin/checkAdminPassword'
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'

// An orphan is a Firebase Auth user with no matching doc in either
// businesses/{uid} (admin-panel-created logins) or users/{uid} (customer
// signups) -- every legitimately-created account has exactly one of those,
// so "neither" is the real signal, not a guess based on how the account
// looks. This also catches a customer signup that created its Auth user but
// failed to write its Firestore doc, not just business-deletion orphans.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization') ?? ''
  const password = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null
  if (!isAdminPassword(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminAuth = getAdminAuth()
  const adminDb = getAdminDb()

  const [businessRefs, userRefs] = await Promise.all([
    adminDb.collection('businesses').listDocuments(),
    adminDb.collection('users').listDocuments(),
  ])
  const knownUids = new Set<string>()
  for (const ref of businessRefs) knownUids.add(ref.id)
  for (const ref of userRefs) knownUids.add(ref.id)

  const authUsers: { uid: string; email: string; createdAt: string; providerIds: string[] }[] = []
  let pageToken: string | undefined
  do {
    const page = await adminAuth.listUsers(1000, pageToken)
    for (const user of page.users) {
      authUsers.push({
        uid: user.uid,
        email: user.email ?? '(no email)',
        createdAt: user.metadata.creationTime,
        providerIds: user.providerData.map((p) => p.providerId),
      })
    }
    pageToken = page.pageToken
  } while (pageToken)

  const orphans = authUsers.filter((user) => !knownUids.has(user.uid))

  return NextResponse.json({ orphans, totalAuthUsers: authUsers.length })
}
