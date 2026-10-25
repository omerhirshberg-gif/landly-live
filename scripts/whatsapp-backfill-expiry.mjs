// Gives each whatsappConversations doc written before expiresAt existed one:
// 180 days after its latest message (lastInboundAt or lastOutboundAt), the
// same rule the bot now applies on every message (lib/whatsapp/
// supportBotHandler.ts), so the Firestore TTL policy can delete it. Messages
// already carry their own expiresAt. Docs that have one are left alone.
//
// Run once per project after deploying the TTL policy
// (firebase deploy --only firestore:indexes --project <projectId>).
// Dry run by default -- pass --apply to write.
//
// Credentials and project: scripts/lib/adminInit.mjs.
//
//   node scripts/whatsapp-backfill-expiry.mjs --project landly-dev
//   node scripts/whatsapp-backfill-expiry.mjs --project landly-dev --apply

import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { ADC_HINT, initAdminForScript } from './lib/adminInit.mjs'

const RETENTION_MS = 180 * 24 * 60 * 60 * 1000
const args = process.argv.slice(2)
const apply = args.includes('--apply')
const { app, projectId, usesAdc } = initAdminForScript(args)
const db = getFirestore(app)

let snapshot
try {
  snapshot = await db.collection('whatsappConversations').get()
} catch (err) {
  console.error(`Could not read whatsappConversations in ${projectId}: ${err?.message ?? err}`)
  if (usesAdc) console.error(ADC_HINT)
  process.exit(1)
}

const millis = (value) => (value instanceof Timestamp ? value.toMillis() : 0)
const missing = snapshot.docs.filter((doc) => !(doc.get('expiresAt') instanceof Timestamp))
console.log(`${snapshot.size} conversations, ${missing.length} without expiresAt.`)

const now = Date.now()
let writer = db.batch()
let pending = 0
for (const doc of missing) {
  const last = Math.max(millis(doc.get('lastInboundAt')), millis(doc.get('lastOutboundAt'))) || now
  const expiresAt = Timestamp.fromMillis(last + RETENTION_MS)
  console.log(`  ${doc.id.slice(0, 3)}…${doc.id.slice(-4)}  expiresAt ${expiresAt.toDate().toISOString()}`)
  if (!apply) continue
  writer.set(doc.ref, { expiresAt }, { merge: true })
  if (++pending === 400) {
    await writer.commit()
    writer = db.batch()
    pending = 0
  }
}
if (!apply) {
  console.log('Dry run; pass --apply to write.')
  process.exit(0)
}
if (pending) await writer.commit()
console.log(`Set expiresAt on ${missing.length} conversations in ${projectId}.`)
