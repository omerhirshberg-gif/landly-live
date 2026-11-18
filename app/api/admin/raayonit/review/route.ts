import { NextResponse } from 'next/server'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { writeAudit } from '@/lib/admin/auditLog'
import { revalidateGuestHome } from '@/lib/admin/revalidateHome'
import { BUSINESS_CATEGORIES } from '@/lib/categories'
import { getAdminDb } from '@/lib/firebase/admin'
import { LOG_COLLECTION } from '@/lib/inventory/raayonitDailySync'

// The Raayonit review queue: partners the daily sync found that no rule knows yet. They sit as drafts (published:false,
// raayonitSyncPending:true) and reach no member until approved here.
//   GET   the latest sync run and the pending partners.
//   POST  { action: 'approve' | 'reject', ids, category? }  approve publishes (the optional category replaces the sync's guess);
//         reject keeps the draft hidden (never deletes it) and the daily sync leaves that brand alone.
export async function GET(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const db = getAdminDb()
  const [logs, pending] = await Promise.all([
    db.collection(LOG_COLLECTION).orderBy('at', 'desc').limit(1).get(),
    db.collection('offers').where('raayonitSyncPending', '==', true).get(),
  ])
  const last = logs.docs[0]?.data()
  const lastRun = last
    ? { date: String(last.date ?? logs.docs[0]!.id), status: String(last.status ?? ''), dry: last.dry === true, abortReason: typeof last.abortReason === 'string' ? last.abortReason : null, finishedAt: typeof last.finishedAt === 'string' ? last.finishedAt : null, counts: last.counts ?? null, added: Array.isArray(last.added) ? last.added : [], archived: Array.isArray(last.archived) ? last.archived : [] }
    : null
  const items = pending.docs.map((d) => {
    const o = d.data()
    return { id: d.id, title: String(o.title ?? ''), brandName: String(o.brandName ?? ''), category: String(o.category ?? ''), branches: Number(o.chainsCount) || 0, pendingSince: o.pendingSince instanceof Timestamp ? o.pendingSince.toDate().toISOString() : null }
  })
  items.sort((a, b) => a.brandName.localeCompare(b.brandName, 'he'))
  return NextResponse.json({ lastRun, pending: items, categories: BUSINESS_CATEGORIES })
}

export async function POST(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const body = await request.json().catch(() => null)
  const action = body?.action
  const ids: unknown = body?.ids
  if ((action !== 'approve' && action !== 'reject') || !Array.isArray(ids) || ids.length === 0 || ids.length > 200 || ids.some((id) => typeof id !== 'string' || !/^[\w-]{1,128}$/.test(id))) {
    return NextResponse.json({ error: 'Send action approve or reject, and the ids.' }, { status: 400 })
  }
  const category: unknown = body?.category
  if (category !== undefined && !(BUSINESS_CATEGORIES as readonly string[]).includes(category as string)) return NextResponse.json({ error: 'Unknown category.' }, { status: 400 })

  const db = getAdminDb()
  const refs = (ids as string[]).map((id) => db.collection('offers').doc(id))
  const docs = await db.getAll(...refs)
  // Only a card still waiting for review can be changed here, whatever ids were sent.
  const targets = docs.filter((d) => d.exists && d.data()?.raayonitSyncPending === true && d.data()?.fulfillmentType === 'raayonit_pool')
  if (targets.length > 0) {
    const batch = db.batch()
    for (const doc of targets) {
      if (action === 'approve') {
        batch.update(doc.ref, { published: true, raayonitSyncPending: false, pendingSince: FieldValue.delete(), approvedBy: 'admin', approvedAt: Timestamp.now(), ...(category ? { category } : {}) })
      } else {
        // The card keeps its raayonit:{key}, so the daily diff still sees the brand as known and never stages it again.
        batch.update(doc.ref, { published: false, raayonitSyncPending: false, pendingSince: FieldValue.delete(), reviewRejectedAt: Timestamp.now() })
      }
    }
    await batch.commit()
    revalidateGuestHome()
    await writeAudit(db, request, { action: action === 'approve' ? 'raayonit.review.approve' : 'raayonit.review.reject', targetType: 'batch', targetId: 'raayonit', after: { changed: targets.length, category: category ?? null } })
  }
  return NextResponse.json({ changed: targets.length })
}
