// One-time migration: moves the internal fields of orders created before the split (commissionRate, paymentTerms,
// reservedVoucherId, businessGeo) off the member-readable `orders/{id}` into the server-only
// `orders/{id}/internal/terms` (lib/payments/orderInternal.ts), then removes them from the order.
//
// Until it runs, those older orders still expose the fields to their owner. The code reads either place, so running
// it is safe at any time and in any order relative to a deploy. Run it on BOTH projects (landly-dev, landly-be752).
//
// Dry run by default -- pass --apply to write. Safe to re-run: an order without the fields is skipped, and each move is
// one transaction that re-checks the order. An existing internal document wins over the order's copy.
//
//   node scripts/migrate-order-internal.mjs --project landly-dev
//   node scripts/migrate-order-internal.mjs --project landly-dev --apply

import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { ADC_HINT, initAdminForScript } from './lib/adminInit.mjs'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const KEYS = ['commissionRate', 'paymentTerms', 'reservedVoucherId', 'businessGeo']

const { app } = initAdminForScript(args)
const db = getFirestore(app)

let scanned = 0
let moved = 0
let skipped = 0
try {
  let last
  for (;;) {
    let q = db.collection('orders').orderBy('__name__').limit(300)
    if (last) q = q.startAfter(last)
    const page = await q.get()
    if (page.empty) break
    for (const doc of page.docs) {
      scanned++
      if (!KEYS.some((k) => k in doc.data())) { skipped++; continue }
      moved++
      if (!apply) continue
      await db.runTransaction(async (tx) => {
        const ref = db.collection('orders').doc(doc.id)
        const internalRef = ref.collection('internal').doc('terms')
        const [order, internal] = await Promise.all([tx.get(ref), tx.get(internalRef)])
        const data = order.data() ?? {}
        const present = KEYS.filter((k) => k in data)
        if (present.length === 0) return
        const copy = Object.fromEntries(present.map((k) => [k, data[k]]))
        tx.set(internalRef, { ...copy, ...(internal.data() ?? {}) })
        tx.update(ref, Object.fromEntries(present.map((k) => [k, FieldValue.delete()])))
      })
    }
    last = page.docs.at(-1)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  console.error(ADC_HINT)
  process.exit(1)
}
console.log(`${apply ? 'Moved' : 'Would move'} ${moved} of ${scanned} orders (${skipped} already clean).${apply ? '' : ' Dry run: pass --apply to write.'}`)
