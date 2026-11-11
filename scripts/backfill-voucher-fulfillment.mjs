// One-time migration for merchant settlement. Vouchers issued before payouts
// existed have none of the fields the settlement reads, so the query
// (status redeemed, fulfillmentType direct_merchant, payoutBatchId null) would
// never see them. For every voucher missing `fulfillmentType` this sets:
//
//   fulfillmentType  'direct_merchant'   (every sale before Multipass pools was honoured by the merchant)
//   payoutBatchId    null
//   amountAgorot     the price paid, from its order (orders/{same id}.amountAgorot)
//   commissionRate   the merchant's CURRENT commissionRate  } snapshots, as a purchase
//   paymentTerms     the merchant's CURRENT paymentTerms    } made today would freeze them
//
// A merchant with no terms yet gets nulls there: the payout preview holds that
// merchant back ("no commission or payment terms") until terms are set (invite
// them under Admin > Merchant Invites). Nothing already set is ever overwritten.
//
// Dry run by default -- pass --apply to write. Safe to re-run.
//
// Credentials and project: scripts/lib/adminInit.mjs (--project, else
// FIREBASE_ADMIN_PROJECT_ID, else the active gcloud project -- never
// production on its own). Run it once for each project (landly-dev, then landly-be752).
//
//   node scripts/backfill-voucher-fulfillment.mjs --project landly-dev
//   node scripts/backfill-voucher-fulfillment.mjs --project landly-dev --apply

import { getFirestore } from 'firebase-admin/firestore'
import { ADC_HINT, initAdminForScript } from './lib/adminInit.mjs'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const PAYMENT_TERMS = ['net_0', 'net_15', 'net_30', 'net_45', 'net_60']

const { app, projectId, usesAdc } = initAdminForScript(args)
const db = getFirestore(app)

let snap
try {
  snap = await db.collection('vouchers').get()
} catch (err) {
  console.error(`Could not read vouchers in ${projectId}: ${err?.message ?? err}`)
  if (usesAdc) console.error(ADC_HINT)
  process.exit(1)
}

const missing = snap.docs.filter((d) => d.get('fulfillmentType') === undefined)
console.log(`${snap.size} vouchers in ${projectId}, ${missing.length} without fulfillmentType${apply ? '' : ' (dry run; pass --apply to write)'}`)

const terms = new Map()
async function termsOf(businessId) {
  if (!terms.has(businessId)) {
    const b = await db.collection('businesses').doc(businessId).get()
    const rate = b.get('commissionRate')
    const t = b.get('paymentTerms')
    terms.set(businessId, typeof rate === 'number' && PAYMENT_TERMS.includes(t) ? { commissionRate: rate, paymentTerms: t } : null)
  }
  return terms.get(businessId)
}

let written = 0
let noAmount = 0
const noTerms = new Set()
for (const voucher of missing) {
  const order = await db.collection('orders').doc(voucher.id).get()
  const amountAgorot = Number.isSafeInteger(order.get('amountAgorot')) ? order.get('amountAgorot') : null
  const t = await termsOf(String(voucher.get('businessId') ?? ''))
  if (amountAgorot === null) noAmount++
  if (!t) noTerms.add(String(voucher.get('businessId')))
  if (!apply) continue
  const changed = await db.runTransaction(async (tx) => {
    const fresh = await tx.get(voucher.ref)
    if (!fresh.exists || fresh.get('fulfillmentType') !== undefined) return false
    tx.update(voucher.ref, {
      fulfillmentType: 'direct_merchant', payoutBatchId: null, amountAgorot,
      commissionRate: t?.commissionRate ?? null, paymentTerms: t?.paymentTerms ?? null,
    })
    return true
  })
  if (changed) written++
}
if (apply) console.log(`Updated ${written} vouchers.`)
if (noAmount) console.log(`${noAmount} had no matching order amount (stored as null; they will be held back from payouts).`)
if (noTerms.size) console.log(`${noTerms.size} merchants have no commission/payment terms yet: ${[...noTerms].join(', ')}`)
