// One-time migration: gives every voucher issued before redeem tokens
// existed its own `redeemToken` (128 random bits, hex), the value its QR code
// carries from then on (lib/firebase/vouchers.ts redeemVoucherKey). Until it
// runs, those vouchers' QR codes still show the voucher id, which is
// predictable (`${uid}_${offerId}`).
//
// Must run BEFORE any redemption endpoint that accepts scanned codes ships:
// that endpoint should accept redeem tokens only, never a voucher id.
//
// Dry run by default -- pass --apply to write. Safe to re-run: a voucher that
// already has a token is never touched, and each write is a transaction
// that re-checks it.
//
// Credentials and project: scripts/lib/adminInit.mjs (service-account key
// when FIREBASE_ADMIN_PRIVATE_KEY is set, else Application Default
// Credentials; --project, else FIREBASE_ADMIN_PROJECT_ID, else the active
// gcloud project -- never production on its own).
//
//   node scripts/backfill-redeem-tokens.mjs --project landly-be752
//   node scripts/backfill-redeem-tokens.mjs --project landly-be752 --apply
//   node --env-file=.env scripts/backfill-redeem-tokens.mjs --apply   (service-account key)

import { randomBytes } from 'node:crypto'
import { getFirestore } from 'firebase-admin/firestore'
import { ADC_HINT, initAdminForScript } from './lib/adminInit.mjs'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const TOKEN_PATTERN = /^[0-9a-f]{32}$/

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

const missing = snap.docs.filter((d) => !TOKEN_PATTERN.test(String(d.get('redeemToken') ?? '')))
console.log(`${snap.size} vouchers, ${missing.length} without a redeem token${apply ? '' : ' (dry run; pass --apply to write)'}`)

let written = 0
if (apply) {
  for (const voucher of missing) {
    const changed = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(voucher.ref)
      if (!fresh.exists || TOKEN_PATTERN.test(String(fresh.get('redeemToken') ?? ''))) return false
      tx.update(voucher.ref, { redeemToken: randomBytes(16).toString('hex') })
      return true
    })
    if (changed) written++
  }
  console.log(`Wrote ${written} redeem tokens.`)
}
