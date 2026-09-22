// One-time migration: marks existing email+password *customer* accounts as
// emailVerified so the new verification requirement (login block,
// getVerifiedUidFromRequest, firestore.rules) doesn't lock them out.
//
// A customer here means: has a password provider, is not yet verified, has a
// users/{uid} doc, has NO businesses/{uid} doc, and was created before
// --created-before. Business logins and orphans (no doc in either
// collection) are left untouched and only reported.
//
// Dry run by default -- pass --apply to write. Safe to re-run.
//
//   node --env-file=.env scripts/grandfather-email-verification.mjs --created-before=2026-09-22T12:00:00Z
//   node --env-file=.env scripts/grandfather-email-verification.mjs --created-before=2026-09-22T12:00:00Z --apply
//
// Must run BEFORE `firebase deploy --only firestore:rules`.

import { cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const cutoffArg = args.find((a) => a.startsWith('--created-before='))?.split('=')[1]
const cutoff = cutoffArg ? new Date(cutoffArg) : null
if (!cutoff || Number.isNaN(cutoff.getTime())) {
  console.error('Missing or invalid --created-before=<ISO timestamp> (e.g. 2026-09-22T12:00:00Z)')
  process.exit(1)
}

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
})
const auth = getAuth(app)
const db = getFirestore(app)

const [businessRefs, userRefs] = await Promise.all([
  db.collection('businesses').listDocuments(),
  db.collection('users').listDocuments(),
])
const businessUids = new Set(businessRefs.map((r) => r.id))
const customerUids = new Set(userRefs.map((r) => r.id))

const toVerify = []
const skipped = { business: [], orphan: [], createdAfterCutoff: [] }

let pageToken
do {
  const page = await auth.listUsers(1000, pageToken)
  for (const user of page.users) {
    if (user.emailVerified) continue
    if (!user.providerData.some((p) => p.providerId === 'password')) continue
    const label = `${user.uid}  ${user.email ?? '(no email)'}  created ${user.metadata.creationTime}`
    if (businessUids.has(user.uid)) skipped.business.push(label)
    else if (!customerUids.has(user.uid)) skipped.orphan.push(label)
    else if (new Date(user.metadata.creationTime) >= cutoff) skipped.createdAfterCutoff.push(label)
    else toVerify.push({ uid: user.uid, label })
  }
  pageToken = page.pageToken
} while (pageToken)

console.log(`Cutoff: accounts created before ${cutoff.toISOString()}`)
console.log(`\nWill mark verified (${toVerify.length}):`)
for (const u of toVerify) console.log(`  ${u.label}`)
for (const [reason, list] of Object.entries(skipped)) {
  console.log(`\nSkipped -- ${reason} (${list.length}):`)
  for (const label of list) console.log(`  ${label}`)
}

if (!apply) {
  console.log('\nDry run -- nothing written. Re-run with --apply to update.')
  process.exit(0)
}

let failed = 0
for (const u of toVerify) {
  try {
    await auth.updateUser(u.uid, { emailVerified: true })
  } catch (err) {
    failed += 1
    console.error(`  FAILED ${u.label}: ${err.message}`)
  }
}
console.log(`\nUpdated ${toVerify.length - failed}/${toVerify.length} accounts.`)
process.exit(failed ? 1 : 0)
