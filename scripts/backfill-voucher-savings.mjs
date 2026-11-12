// One-time migration for the member's "Total Saved" tile. New vouchers carry
// `savingsAgorot` (set by the payment webhook, lib/payments/claimOfferForOrder.ts),
// so the wallet adds them up with no reads. Vouchers issued before that have no
// such field and fall back to reading each voucher's order. For every voucher
// without a numeric `savingsAgorot` this stores it, computed from its order
// (orders/{same id}: original price minus price paid; 0 for an unpaid order or
// one with no original price, exactly as the app has always counted it).
//
// Idempotent and safe to re-run: a voucher that already has the field is never
// touched, and each write re-checks that inside a transaction, so a purchase
// settling meanwhile is never overwritten. Reads vouchers in pages of 300 by
// document id and their orders in one getAll per page, so it never loads a
// whole collection or reads an order twice.
//
// Dry run by default -- pass --apply to write.
//
// Credentials and project: scripts/lib/adminInit.mjs (--project, else
// FIREBASE_ADMIN_PROJECT_ID, else the active gcloud project -- never production
// on its own). Run it on DEV first, check the counts, then on PROD:
//
//   node scripts/backfill-voucher-savings.mjs --project landly-dev
//   node scripts/backfill-voucher-savings.mjs --project landly-dev --apply
//   node scripts/backfill-voucher-savings.mjs --project landly-be752
//   node scripts/backfill-voucher-savings.mjs --project landly-be752 --apply

import { FieldPath, getFirestore } from 'firebase-admin/firestore'
import { ADC_HINT, initAdminForScript } from './lib/adminInit.mjs'
import { savingsFromOrder } from './lib/voucherSavings.mjs'

const PAGE = 300

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const { app, projectId, usesAdc } = initAdminForScript(args)
const db = getFirestore(app)
console.log(`Project ${projectId}${apply ? '' : ' (dry run; pass --apply to write)'}`)

let scanned = 0
let missing = 0
let written = 0
let total = 0
let after = null
try {
  for (;;) {
    let query = db.collection('vouchers').orderBy(FieldPath.documentId()).limit(PAGE)
    if (after) query = query.startAfter(after)
    const page = await query.get()
    if (page.empty) break
    after = page.docs.at(-1).id
    scanned += page.size

    const todo = page.docs.filter((d) => typeof d.get('savingsAgorot') !== 'number')
    missing += todo.length
    if (todo.length === 0) continue
    // A voucher's id is its order's id: one batched read for the page's orders.
    const orders = await db.getAll(...todo.map((d) => db.collection('orders').doc(d.id)))
    for (let i = 0; i < todo.length; i++) {
      const savings = savingsFromOrder(orders[i].exists ? orders[i].data() : null)
      total += savings
      if (!apply) continue
      const changed = await db.runTransaction(async (tx) => {
        const fresh = await tx.get(todo[i].ref)
        if (!fresh.exists || typeof fresh.get('savingsAgorot') === 'number') return false
        tx.update(todo[i].ref, { savingsAgorot: savings })
        return true
      })
      if (changed) written++
    }
  }
} catch (err) {
  console.error(`Could not backfill vouchers in ${projectId}: ${err?.message ?? err}`)
  if (usesAdc) console.error(ADC_HINT)
  process.exit(1)
}

console.log(`${scanned} vouchers scanned, ${missing} without savingsAgorot (worth ₪${(total / 100).toFixed(2)} in total).`)
console.log(apply ? `Updated ${written} vouchers.` : 'Dry run: nothing written.')
