#!/usr/bin/env node
// Removes one /join lead and its phone and email keys, for an opt-out or a
// privacy request. Without the keys removed, the person couldn't sign up again.
//
//   node --env-file=.env.local scripts/delete-prelaunch-lead.mjs --project landly-dev --id abcdefghij        (preview)
//   node --env-file=.env.local scripts/delete-prelaunch-lead.mjs --project landly-dev --phone +972501234567 --yes
//
// Find the lead by exactly one of --id, --phone or --email. Nothing is deleted without --yes.
import { createHash } from 'node:crypto'
import { getFirestore } from 'firebase-admin/firestore'
import { flagValue, initAdminForScript } from './lib/adminInit.mjs'

const args = process.argv.slice(2)
const id = flagValue(args, '--id')
const phone = flagValue(args, '--phone')
const email = flagValue(args, '--email')?.trim().toLowerCase()
if (!flagValue(args, '--project') || [id, phone, email].filter(Boolean).length !== 1) {
  console.error('Usage: delete-prelaunch-lead.mjs --project <projectId> (--id <leadId> | --phone <e164> | --email <address>) [--yes]')
  process.exit(1)
}

// Same hash as leadKeyId() in lib/prelaunch/leads.server.ts.
const keyId = (kind, value) => createHash('sha256').update(`${kind}:${value}`).digest('hex')

const { app } = initAdminForScript(args)
const db = getFirestore(app)
const keys = db.collection('prelaunch_lead_keys')

let leadId = id
if (!leadId) {
  const key = await keys.doc(phone ? keyId('phone', phone) : keyId('email', email)).get()
  leadId = key.data()?.leadId
}
const leadRef = leadId ? db.collection('prelaunch_leads').doc(leadId) : null
const lead = leadRef ? await leadRef.get() : null
if (!lead?.exists) {
  console.log('No matching lead.')
  process.exit(0)
}

console.log(`Lead ${leadId}`)
if (!args.includes('--yes')) {
  console.log('Preview only. Add --yes to delete it.')
  process.exit(0)
}
const { phone: leadPhone, email: leadEmail } = lead.data()
const batch = db.batch()
batch.delete(leadRef)
batch.delete(keys.doc(keyId('phone', leadPhone)))
batch.delete(keys.doc(keyId('email', leadEmail)))
await batch.commit()
console.log('Deleted the lead and its keys.')
