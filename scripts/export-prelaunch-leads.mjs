#!/usr/bin/env node
// Writes the /join signups to a CSV, oldest first, for the launch update, and
// prints the demand totals (lib/prelaunch/demand.mjs). Read-only. The file
// holds names, phone numbers and emails: keep it out of the repository.
//
//   node --env-file=.env.local scripts/export-prelaunch-leads.mjs --project landly-dev --out ~/leads-dev.csv
//
// --project is required here, unlike other scripts: it decides whose personal
// data lands in the file.
import { writeFileSync } from 'node:fs'
import { getFirestore } from 'firebase-admin/firestore'
import { flagValue, initAdminForScript } from './lib/adminInit.mjs'
import { demandSummary, leadsCsv, withReferrals } from '../lib/prelaunch/demand.mjs'

const args = process.argv.slice(2)
const out = flagValue(args, '--out')
if (!flagValue(args, '--project') || !out) {
  console.error('Usage: export-prelaunch-leads.mjs --project <projectId> --out <file.csv>')
  process.exit(1)
}

const { app } = initAdminForScript(args)
const snapshot = await getFirestore(app).collection('prelaunch_leads').get()
const leads = withReferrals(snapshot.docs.map((doc) => {
  const lead = doc.data()
  return { ...lead, id: doc.id, createdAtMs: lead.createdAt?.toMillis?.() ?? 0 }
}))

writeFileSync(out, leadsCsv(leads), { mode: 0o600 })
console.log(`Wrote ${leads.length} leads to ${out}`)
console.log(JSON.stringify(demandSummary(leads), null, 2))
