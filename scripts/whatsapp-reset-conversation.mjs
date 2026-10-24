// Lets the WhatsApp support bot answer a number again right away, for
// testing: clears whatsappConversations/{waId}.lastMenuAt (the 10-minute
// menu throttle) and .escalatedAt (the 24-hour silence after "Talk to
// Team"), as decided in lib/whatsapp/supportBot.ts. The rest of the
// conversation (member, language, last text) is kept. Seen message ids in
// whatsappInbound are left alone: a message is still answered only once.
//
// Dry run by default -- pass --apply to write. Prints what's stored either way.
//
// Credentials and project: scripts/lib/adminInit.mjs (service-account key
// when FIREBASE_ADMIN_PRIVATE_KEY is set, else Application Default
// Credentials; --project, else FIREBASE_ADMIN_PROJECT_ID, else the active
// gcloud project -- never production on its own).
//
//   node scripts/whatsapp-reset-conversation.mjs --project <projectId> --number=+972552889033
//   node scripts/whatsapp-reset-conversation.mjs --project <projectId> --number=+972552889033 --apply

import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'
import { ADC_HINT, flagValue, initAdminForScript } from './lib/adminInit.mjs'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const number = flagValue(args, '--number')
// The WhatsApp ID is the number's digits without "+" (lib/whatsapp/webhookPayload.ts).
const waId = number?.replace(/\D/g, '')
if (!waId || !/^\d{6,15}$/.test(waId)) {
  console.error('Missing or malformed --number=<E.164 number, e.g. +972552889033>')
  process.exit(1)
}

const { app, projectId, usesAdc } = initAdminForScript(args)
const ref = getFirestore(app).collection('whatsappConversations').doc(waId)

let snap
try {
  snap = await ref.get()
} catch (err) {
  console.error(`Could not read whatsappConversations/${waId} in ${projectId}: ${err?.message ?? err}`)
  if (usesAdc) console.error(ADC_HINT)
  process.exit(1)
}
if (!snap.exists) {
  console.log(`whatsappConversations/${waId}: no conversation stored, so nothing holds the bot back.`)
  process.exit(0)
}

const when = (value) => (value instanceof Timestamp ? value.toDate().toISOString() : '(none)')
console.log(`whatsappConversations/${waId}`)
for (const field of ['lastInboundAt', 'lastMenuAt', 'escalatedAt']) console.log(`  ${field.padEnd(14)} ${when(snap.get(field))}`)
console.log(`  uid            ${snap.get('uid') ?? '(no member)'}`)
console.log(`  lang           ${snap.get('lang') ?? '(none)'}`)

if (!apply) {
  console.log('Would clear lastMenuAt and escalatedAt (dry run; pass --apply).')
  process.exit(0)
}
await ref.update({ lastMenuAt: FieldValue.delete(), escalatedAt: FieldValue.delete() })
console.log('Cleared lastMenuAt and escalatedAt; the next message gets the menu.')
