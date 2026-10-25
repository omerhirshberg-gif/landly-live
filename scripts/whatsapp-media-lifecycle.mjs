// Adds the Storage lifecycle rule that deletes the support line's media
// (whatsapp_media/, written by lib/whatsapp/mediaStore.ts) 180 days after
// upload: the same retention as the transcript it belongs to, whose
// Firestore TTL policy can't reach Storage. Rules already on the bucket are
// kept; running it again changes nothing once the rule is there.
//
// Dry run by default -- pass --apply to write. Bucket: --bucket <name>, else
// NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET; it must belong to the chosen project,
// so the dev env can never touch the production bucket.
//
// Credentials and project: scripts/lib/adminInit.mjs.
//
//   node --env-file=.env.local scripts/whatsapp-media-lifecycle.mjs
//   node --env-file=.env.local scripts/whatsapp-media-lifecycle.mjs --apply
//   node scripts/whatsapp-media-lifecycle.mjs --project landly-be752 --bucket landly-be752.firebasestorage.app --apply

import { getStorage } from 'firebase-admin/storage'
import { ADC_HINT, flagValue, initAdminForScript } from './lib/adminInit.mjs'

const PREFIX = 'whatsapp_media/'
const AGE_DAYS = 180

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const { app, projectId, usesAdc } = initAdminForScript(args)
const bucketName = flagValue(args, '--bucket') || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim()

if (!bucketName) {
  console.error('No bucket. Pass --bucket <name> or set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET.')
  process.exit(1)
}
if (bucketName !== `${projectId}.firebasestorage.app` && bucketName !== `${projectId}.appspot.com`) {
  console.error(`Bucket ${bucketName} isn't ${projectId}'s default bucket; refusing to change it.`)
  process.exit(1)
}
console.log(`Bucket: ${bucketName}`)

const bucket = getStorage(app).bucket(bucketName)

const isOurRule = (rule) =>
  rule?.action?.type === 'Delete' &&
  Number(rule?.condition?.age) === AGE_DAYS &&
  Array.isArray(rule?.condition?.matchesPrefix) &&
  rule.condition.matchesPrefix.length === 1 &&
  rule.condition.matchesPrefix[0] === PREFIX

let metadata
try {
  ;[metadata] = await bucket.getMetadata()
} catch (err) {
  console.error(`Could not read ${bucketName}: ${err?.message ?? err}`)
  if (usesAdc) console.error(ADC_HINT)
  process.exit(1)
}

const rules = metadata.lifecycle?.rule ?? []
console.log(`${rules.length} lifecycle rule(s) on the bucket now.`)
for (const rule of rules) console.log(`  ${JSON.stringify(rule)}`)

if (rules.some(isOurRule)) {
  console.log(`Already deletes ${PREFIX} after ${AGE_DAYS} days; nothing to do.`)
  process.exit(0)
}

const rule = { action: { type: 'Delete' }, condition: { age: AGE_DAYS, matchesPrefix: [PREFIX] } }
console.log(`To add: ${JSON.stringify(rule)}`)
if (!apply) {
  console.log('Dry run; pass --apply to write.')
  process.exit(0)
}

try {
  await bucket.addLifecycleRule(rule, { append: true })
} catch (err) {
  console.error(`Could not update ${bucketName}: ${err?.message ?? err}`)
  if (usesAdc) console.error(ADC_HINT)
  process.exit(1)
}
const [updated] = await bucket.getMetadata()
const added = (updated.lifecycle?.rule ?? []).some(isOurRule)
console.log(added ? `Added: ${bucketName} deletes ${PREFIX} objects ${AGE_DAYS} days after upload.` : 'The rule did not appear on the bucket; check it in the Cloud console.')
process.exit(added ? 0 : 1)
