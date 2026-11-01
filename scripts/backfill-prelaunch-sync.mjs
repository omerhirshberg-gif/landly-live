#!/usr/bin/env node
// Queues the /join leads from before the Rav Messer sync: it gives each one the
// pending record that /api/cron/prelaunch-sync looks for, and the cron sends
// them, 25 a run. Leads that already have a record are left alone, so it can be
// rerun. Nothing is written without --yes.
//
//   node --env-file=.env.local scripts/backfill-prelaunch-sync.mjs --project landly-dev        (dry run)
//   node scripts/backfill-prelaunch-sync.mjs --project landly-be752 --yes       (Application Default Credentials)
//
// Totals only are printed: a lead's details never reach the terminal.
import { getFirestore } from 'firebase-admin/firestore'
import { flagValue, initAdminForScript } from './lib/adminInit.mjs'

const args = process.argv.slice(2)
if (!flagValue(args, '--project')) {
  console.error('Usage: backfill-prelaunch-sync.mjs --project <projectId> [--yes]')
  process.exit(1)
}

const { app, projectId } = initAdminForScript(args)
const db = getFirestore(app)
const BATCH_SIZE = 400

const snapshot = await db.collection('prelaunch_leads').select('ravMesserSync').get()
const unqueued = snapshot.docs.filter((doc) => doc.get('ravMesserSync') === undefined)
console.log(`${projectId}: ${snapshot.size} leads, ${unqueued.length} to queue.`)

if (!args.includes('--yes')) {
  console.log('Dry run. Add --yes to queue them.')
  process.exit(0)
}
for (let i = 0; i < unqueued.length; i += BATCH_SIZE) {
  const batch = db.batch()
  for (const doc of unqueued.slice(i, i + BATCH_SIZE)) {
    batch.update(doc.ref, { ravMesserSync: { synced: false, syncedAt: null, error: null }, ravMesserSyncAttempts: 0 })
  }
  await batch.commit()
}
console.log(`Queued ${unqueued.length} leads.`)
