import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { UserActionError, changeUserStatus } from '@/lib/account/adminUserActions'
import { USER_STATUSES, kycTierOf, parseUserStatus, passIdFor } from '@/lib/admin/userStatus'
import { getAdminAuth, getAdminBucket, getAdminDb } from '@/lib/firebase/admin'
import { deleteUserPermanently } from '@/lib/users/deleteUserPermanently.server'
import { loadDeletionPreview } from '@/lib/users/deletionPreview.server'

const iso = (value: unknown) => (value instanceof Timestamp ? value.toDate().toISOString() : null)

// One member for the admin's detail page: profile, sign-in devices, passes
// (read-only: never the redemption code or QR token), recent orders and every
// admin action taken on them.
// Each history list is capped; a member never has anywhere near this many.
const HISTORY_LIMIT = 200

export async function GET(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const { uid } = await params
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(uid)) return NextResponse.json({ error: 'Invalid member.' }, { status: 400 })
  const db = getAdminDb()
  // ?preview=1: what permanent deletion would do, for the confirmation dialog.
  if (new URL(request.url).searchParams.get('preview') === '1') {
    const preview = await loadDeletionPreview(db, getAdminAuth(), uid)
    if (!preview) return NextResponse.json({ error: 'Member not found.' }, { status: 404 })
    return NextResponse.json({ ...preview, isBusiness: (await db.collection('businesses').doc(uid).get()).exists }, { headers: { 'Cache-Control': 'no-store' } })
  }
  const userSnap = await db.collection('users').doc(uid).get()
  if (!userSnap.exists) return NextResponse.json({ error: 'Member not found.' }, { status: 404 })
  const user = userSnap.data()!
  const [authUser, sessions, vouchers, orders, audit] = await Promise.all([
    getAdminAuth().getUser(uid).catch(() => null),
    db.collection('users').doc(uid).collection('sessions').orderBy('lastActiveAt', 'desc').limit(20).get(),
    db.collection('vouchers').where('userId', '==', uid).limit(HISTORY_LIMIT).get(),
    db.collection('orders').where('userId', '==', uid).limit(HISTORY_LIMIT).get(),
    db.collection('adminAuditLog').where('targetId', '==', uid).limit(HISTORY_LIMIT).get(),
  ])
  const byDateDesc = <T extends { at: string | null }>(a: T, b: T) => (b.at ?? '').localeCompare(a.at ?? '')
  return NextResponse.json({
    uid, passId: passIdFor(uid), status: parseUserStatus(user.status), statusReason: user.statusReason ?? null,
    kycTier: kycTierOf(!!authUser?.emailVerified, user.phoneVerified === true),
    name: user.displayName || [user.firstName, user.lastName].filter(Boolean).join(' '),
    email: user.email ?? authUser?.email ?? '', phone: user.phone ?? '', phoneVerified: user.phoneVerified === true,
    emailVerified: !!authUser?.emailVerified, disabled: !!authUser?.disabled,
    createdAt: authUser?.metadata.creationTime ?? null, lastSignInAt: authUser?.metadata.lastSignInTime ?? null,
    sessions: sessions.docs.map((d) => ({ id: d.id, deviceName: d.get('deviceName') ?? '', platform: d.get('platform') ?? '', lastActiveAt: iso(d.get('lastActiveAt')), createdAt: iso(d.get('createdAt')) })),
    passes: vouchers.docs.map((d) => ({
      id: d.id, offerTitle: d.get('offerTitle') ?? '', businessName: d.get('businessName') ?? '', status: d.get('status') ?? 'active',
      displayOrderNumber: d.get('displayOrderNumber') ?? null, at: iso(d.get('takenAt')), expiresAt: iso(d.get('expiresAt')), redeemedAt: iso(d.get('redeemedAt')),
    })).sort(byDateDesc),
    orders: orders.docs.map((d) => ({ id: d.id, offerTitle: d.get('offerTitle') ?? '', status: d.get('status') ?? '', amount: d.get('amount') ?? 0, at: iso(d.get('createdAt')) })).sort(byDateDesc).slice(0, 20),
    audit: audit.docs.map((d) => ({ id: d.id, action: d.get('action'), note: d.get('note') ?? null, at: iso(d.get('at')) })).sort(byDateDesc),
  })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const { uid } = await params
  const body = await request.json().catch(() => null)
  if (!body || !(USER_STATUSES as readonly string[]).includes(body.status)) return NextResponse.json({ error: 'Invalid status.' }, { status: 400 })
  try {
    const result = await changeUserStatus(getAdminDb(), getAdminAuth(), request, uid, body.status, typeof body.reason === 'string' ? body.reason : '')
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof UserActionError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('User status change failed', err)
    return NextResponse.json({ error: 'Could not change the status.' }, { status: 500 })
  }
}

// DELETE {confirm: 'DELETE', refundAcknowledged}: permanent erasure of one member
// (lib/users/deleteUserPermanently.server.ts). The typed word is checked here as
// well as in the dialog, and a member with paid, unredeemed vouchers needs the
// admin's refund acknowledgment (409 otherwise).
export async function DELETE(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const { uid } = await params
  const body = await request.json().catch(() => null)
  if (!body || body.confirm !== 'DELETE') return NextResponse.json({ error: 'Type DELETE to confirm.' }, { status: 400 })
  try {
    const summary = await deleteUserPermanently(
      { db: getAdminDb(), auth: getAdminAuth(), bucket: getAdminBucket() }, request, uid, { refundAcknowledged: body.refundAcknowledged === true },
    )
    return NextResponse.json({ ok: true, summary }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof UserActionError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('Permanent user delete failed', err instanceof Error ? err.message : 'unknown error')
    return NextResponse.json({ error: 'Could not delete the member. Nothing further was removed; try again.' }, { status: 500 })
  }
}
