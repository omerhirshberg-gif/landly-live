import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { writeAudit } from '@/lib/admin/auditLog'
import { revalidateGuestHome } from '@/lib/admin/revalidateHome'
import { getAdminDb } from '@/lib/firebase/admin'
import { BATCH_COMMIT_CHUNK } from '@/lib/admin/offersBatch'
import { hasOrdersOrVouchers, isSuperseded, publishFields, restoreFields } from '@/lib/inventory/raayonitCardActions'
import { ARCHIVED_REASON, tabOf } from '@/lib/inventory/raayonitCardTabs'

// The generated Raayonit cards and what an admin can do to them. A card is live while offers.published !== false.
//   GET   every card with its tab fields (live, pending review, archived by the sync, hidden) and, for an archived card, whether it can be deleted.
//   POST  { published, ids | all }          publish (an archived card is restored through the same code) or remove from the site
//         { action: 'restore', ids }         bring archived partners back
//         { action: 'delete', ids }          delete archived partners for good, only those no order or voucher points at
const validIds = (ids: unknown): ids is string[] => Array.isArray(ids) && ids.length > 0 && ids.length <= 1000 && ids.every((id) => typeof id === 'string' && /^[\w-]{1,128}$/.test(id))
const iso = (v: unknown) => (v instanceof Timestamp ? v.toDate().toISOString() : null)

export async function GET(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const db = getAdminDb()
  const snap = await db.collection('offers').where('fulfillmentType', '==', 'raayonit_pool').get()
  const offers = await Promise.all(snap.docs.map(async (d) => {
    const o = d.data()
    const published = o.published !== false
    const pending = o.raayonitSyncPending === true
    const archivedReason = typeof o.archivedReason === 'string' ? o.archivedReason : null
    const tab = tabOf({ published, pending, archivedReason })
    return {
      id: d.id, title: String(o.title ?? ''), brandName: String(o.brandName ?? ''), perkScope: o.perkScope === 'multi_chain' ? 'multi_chain' : 'single_business',
      poolId: typeof o.poolId === 'string' ? o.poolId : '', published, pending, tab, archivedReason, archivedAt: iso(o.archivedAt),
      rejected: o.reviewRejectedAt instanceof Timestamp, superseded: isSuperseded(o), category: String(o.category ?? ''), chainsCount: Number(o.chainsCount) || 0,
      originalPrice: Number(o.originalPrice) || 0, offerPrice: Number(o.offerPrice) || 0, generated: o.source === 'raayonit-sync',
      deletable: tab === 'archive' ? !(await hasOrdersOrVouchers(db, d.id)) : false,
    }
  }))
  offers.sort((a, b) => Number(b.perkScope === 'multi_chain') - Number(a.perkScope === 'multi_chain') || a.originalPrice - b.originalPrice || a.brandName.localeCompare(b.brandName))
  return NextResponse.json({ offers })
}

export async function POST(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const body = await request.json().catch(() => null)
  const db = getAdminDb()
  // Only Raayonit cards can be changed here, whichever ids were sent.
  const raayonit = await db.collection('offers').where('fulfillmentType', '==', 'raayonit_pool').get()
  const byId = new Map(raayonit.docs.map((d) => [d.id, d]))
  const commit = async (writes: { ref: FirebaseFirestore.DocumentReference; data?: Record<string, unknown> }[]) => {
    for (let start = 0; start < writes.length; start += BATCH_COMMIT_CHUNK) {
      const batch = db.batch()
      for (const w of writes.slice(start, start + BATCH_COMMIT_CHUNK)) w.data ? batch.update(w.ref, w.data) : batch.delete(w.ref)
      await batch.commit()
    }
  }

  if (body?.action === 'restore' || body?.action === 'delete') {
    if (!validIds(body.ids)) return NextResponse.json({ error: 'Send the ids.' }, { status: 400 })
    const ids: string[] = body.ids
    const archived: FirebaseFirestore.QueryDocumentSnapshot[] = ids.map((id) => byId.get(id)).filter((d): d is FirebaseFirestore.QueryDocumentSnapshot => !!d && tabOf({ published: d.data().published !== false, pending: d.data().raayonitSyncPending === true, archivedReason: d.data().archivedReason ?? null }) === 'archive')
    if (body.action === 'restore') {
      const writes = archived.flatMap((d) => { const data = restoreFields(d.data()); return data ? [{ ref: d.ref, data }] : [] })
      await commit(writes)
      if (writes.length > 0) {
        revalidateGuestHome()
        await writeAudit(db, request, { action: 'raayonit.restore', targetType: 'batch', targetId: 'raayonit', after: { changed: writes.length, ids: writes.map((w) => w.ref.id) } })
      }
      return NextResponse.json({ changed: writes.length })
    }
    // Permanent delete: never a card an order or voucher points at (it is the record of what was sold).
    const deletable: FirebaseFirestore.QueryDocumentSnapshot[] = []
    for (const d of archived) if (!(await hasOrdersOrVouchers(db, d.id))) deletable.push(d)
    await commit(deletable.map((d) => ({ ref: d.ref })))
    if (deletable.length > 0) {
      revalidateGuestHome()
      await writeAudit(db, request, { action: 'raayonit.delete', targetType: 'batch', targetId: 'raayonit', before: deletable.map((d) => ({ id: d.id, brandName: d.data().brandName })), after: { deleted: deletable.length } })
    }
    return NextResponse.json({ deleted: deletable.length, refused: ids.length - deletable.length })
  }

  if (typeof body?.published !== 'boolean') return NextResponse.json({ error: 'Send published: true or false.' }, { status: 400 })
  const all = body.all === true
  if (!all && !validIds(body.ids)) return NextResponse.json({ error: 'Send ids, or all: true.' }, { status: 400 })
  const wanted = all ? new Set(byId.keys()) : new Set(body.ids as string[])
  // "Publish all" never brings back a partner awaiting review, one archived because Raayonit dropped it, or one rejected in review: those have their own actions.
  const held = (o: Record<string, unknown>) => all && body.published === true && (o.raayonitSyncPending === true || o.archivedReason === ARCHIVED_REASON || o.reviewRejectedAt instanceof Timestamp)
  const writes: { ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }[] = []
  for (const d of raayonit.docs) {
    const o = d.data()
    if (!wanted.has(d.id) || held(o) || (o.published !== false) === body.published) continue
    const data = body.published ? publishFields(o) : { published: false }
    if (data) writes.push({ ref: d.ref, data })
  }
  await commit(writes)
  if (writes.length > 0) {
    revalidateGuestHome()
    await writeAudit(db, request, { action: body.published ? 'raayonit.publish' : 'raayonit.unpublish', targetType: 'batch', targetId: 'raayonit', after: { changed: writes.length, all } })
  }
  return NextResponse.json({ changed: writes.length })
}
