// Suspends (or restores) a member's account the way the app expects. There
// is no admin screen for this, and disabling in the Firebase Console alone
// leaves Firestore open: an ID token already issued keeps reading the
// member's vouchers and orders for up to an hour, because the rules only
// see users/{uid}.sessionsValidAfter (firestore.rules authFresh). This
// disables the Auth account, revokes every refresh token, and copies Auth's
// cutoff into that field, as lib/auth/sessionRevocation.ts does.
//
// Dry run by default -- pass --apply to write. --enable restores the
// account (the cutoff stays: sessions from before the suspension stay ended).
//
// Credentials and project: scripts/lib/adminInit.mjs (service-account key
// when FIREBASE_ADMIN_PRIVATE_KEY is set, else Application Default
// Credentials; --project, else FIREBASE_ADMIN_PROJECT_ID, else the active
// gcloud project -- never production on its own).
//
//   node scripts/disable-account.mjs --project landly-be752 --user=<uid or email>
//   node scripts/disable-account.mjs --project landly-be752 --user=<uid or email> --apply
//   node scripts/disable-account.mjs --project landly-be752 --user=<uid or email> --enable --apply

import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { ADC_HINT, flagValue, initAdminForScript } from './lib/adminInit.mjs'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const enable = args.includes('--enable')
const target = flagValue(args, '--user')
if (!target) {
  console.error('Missing --user=<uid or email>')
  process.exit(1)
}

const { app, projectId, usesAdc } = initAdminForScript(args)
const auth = getAuth(app)
const db = getFirestore(app)

let user
try {
  user = target.includes('@') ? await auth.getUserByEmail(target) : await auth.getUser(target)
} catch (err) {
  console.error(`Could not look up ${target} in ${projectId}: ${err?.message ?? err}`)
  if (usesAdc && err?.code !== 'auth/user-not-found') console.error(ADC_HINT)
  process.exit(1)
}
console.log(`${user.uid}  ${user.email ?? '(no email)'}  currently ${user.disabled ? 'disabled' : 'enabled'}`)

if (enable) {
  console.log(apply ? 'Enabling.' : 'Would enable (dry run; pass --apply).')
  if (apply) await auth.updateUser(user.uid, { disabled: false })
  process.exit(0)
}

if (!apply) {
  console.log('Would disable, revoke every session and stamp sessionsValidAfter (dry run; pass --apply).')
  process.exit(0)
}

await auth.updateUser(user.uid, { disabled: true })
await auth.revokeRefreshTokens(user.uid)
const { tokensValidAfterTime } = await auth.getUser(user.uid)
const parsed = tokensValidAfterTime ? Date.parse(tokensValidAfterTime) : NaN
const cutoffMs = Number.isNaN(parsed) ? Math.floor(Date.now() / 1000) * 1000 : parsed
const ref = db.collection('users').doc(user.uid)
const stamped = await db.runTransaction(async (tx) => {
  const snap = await tx.get(ref)
  if (!snap.exists) return false
  const current = snap.get('sessionsValidAfter')
  if (!(current instanceof Timestamp) || current.toMillis() < cutoffMs) tx.update(ref, { sessionsValidAfter: Timestamp.fromMillis(cutoffMs) })
  return true
})
console.log(`Disabled and revoked.${stamped ? ` Firestore cutoff: ${new Date(cutoffMs).toISOString()}.` : ' No profile document, so no Firestore cutoff was needed.'}`)
