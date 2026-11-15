#!/usr/bin/env node
// One-off import of addresses that already unsubscribed elsewhere (the old
// Rav Meser list), so the new newsletter never mails them. For every address
// in the file it (1) writes newsletter_suppressions/{hash}, the list every
// campaign checks for leads, and (2) sets marketingOptIn: false (and
// unsubscribedAt) on the matching users, and marketingOptIn: false plus
// unsubscribed: true on the matching pre-launch leads. Documents that are
// already opted out are left alone, so it can be rerun.
//
// The file is any CSV or text export: every email address found in it is used,
// whatever the columns. Dry run unless --yes. Only totals are printed, never an
// address.
//
//   node scripts/import-newsletter-suppressions.mjs --project landly-dev --file unsubscribed.csv          (preview)
//   node scripts/import-newsletter-suppressions.mjs --project landly-be752 --file unsubscribed.csv --yes   (Application Default Credentials)
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { flagValue, initAdminForScript } from './lib/adminInit.mjs'

const args = process.argv.slice(2)
const file = flagValue(args, '--file')
if (!flagValue(args, '--project') || !file) {
  console.error('Usage: import-newsletter-suppressions.mjs --project <projectId> --file <csv> [--yes]')
  process.exit(1)
}

// Same hash as emailHash() in lib/newsletter/audience.server.ts.
const emailHash = (email) => createHash('sha256').update(`newsletter:${email}`).digest('hex').slice(0, 40)

const found = readFileSync(file, 'utf8').match(/[^\s@<>"',;:()[\]\\]+@[^\s@<>"',;:()[\]\\]+\.[^\s@<>"',;:()[\]\\.]{2,}/g) ?? []
const emails = [...new Set(found.map((e) => e.toLowerCase()))]
if (!emails.length) {
  console.error('No email addresses found in the file.')
  process.exit(1)
}

const { app } = initAdminForScript(args)
const db = getFirestore(app)
const apply = args.includes('--yes')

const chunks = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size))
const stats = { addresses: emails.length, newSuppressions: 0, usersMatched: 0, usersUpdated: 0, leadsMatched: 0, leadsUpdated: 0 }
let ops = []
const flush = async () => {
  if (!apply || !ops.length) return
  const batch = db.batch()
  for (const op of ops) op(batch)
  await batch.commit()
  ops = []
}
const queue = async (op) => {
  ops.push(op)
  if (ops.length >= 400) await flush()
}

for (const group of chunks(emails, 30)) {
  const [existing, users, leads] = await Promise.all([
    db.getAll(...group.map((e) => db.collection('newsletter_suppressions').doc(emailHash(e)))),
    db.collection('users').where('email', 'in', group).get(),
    db.collection('prelaunch_leads').where('email', 'in', group).get(),
  ])
  for (const snap of existing) {
    if (snap.exists) continue
    stats.newSuppressions++
    await queue((b) => b.set(snap.ref, { unsubscribedAt: FieldValue.serverTimestamp(), source: 'import' }))
  }
  for (const doc of users.docs) {
    stats.usersMatched++
    if (doc.get('marketingOptIn') === false) continue
    stats.usersUpdated++
    await queue((b) => b.set(doc.ref, { marketingOptIn: false, unsubscribedAt: FieldValue.serverTimestamp() }, { merge: true }))
  }
  for (const doc of leads.docs) {
    stats.leadsMatched++
    if (doc.get('unsubscribed') === true) continue
    stats.leadsUpdated++
    await queue((b) => b.set(doc.ref, { marketingOptIn: false, unsubscribed: true, unsubscribedAt: FieldValue.serverTimestamp() }, { merge: true }))
  }
}
await flush()

console.log(`${apply ? 'Imported' : 'Preview (nothing written; add --yes)'}:`)
console.log(`  addresses in file:        ${stats.addresses}`)
console.log(`  new suppression entries:  ${stats.newSuppressions}`)
console.log(`  members matched/updated:  ${stats.usersMatched} / ${stats.usersUpdated}`)
console.log(`  leads matched/updated:    ${stats.leadsMatched} / ${stats.leadsUpdated}`)
