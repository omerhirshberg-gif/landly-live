// Dry run: which Firebase project, bucket and Admin service account would
// each build use? Resolves the env files the way Next.js does and runs them
// through lib/firebase/envGuard.ts. Never connects to Firebase, never prints
// a secret. Exits 1 if any guard would refuse.
//
//   node scripts/check-firebase-env.mjs
//     local `next dev` and local `next start` (both must be landly-dev)
//
//   vercel env pull .env.vercel.preview --environment=preview
//   node scripts/check-firebase-env.mjs --target=preview --env-file=.env.vercel.preview
//     a Vercel environment's values (preview: landly-dev, production: landly-be752)
//
// Needs Node 22.18+ (imports the TypeScript guard directly).

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseEnv } from 'node:util'

// envGuard.ts is ESM in a package without "type": "module", which Node
// reports on every run; that warning is the only one this script triggers.
process.removeAllListeners('warning')
const { assertAdminCredentials, assertFirebaseConfigConsistent, assertFirebaseProjectForTarget } = await import(
  '../lib/firebase/envGuard.ts'
)

const root = join(import.meta.dirname, '..')
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value = ''] = arg.replace(/^--/, '').split('=')
    return [key, value]
  }),
)

// Next.js precedence: the shell environment, then the first file that sets a key.
function resolveEnv(files) {
  const env = {}
  for (const name of [...files].reverse()) {
    const path = join(root, name)
    if (existsSync(path)) Object.assign(env, parseEnv(readFileSync(path, 'utf8')))
  }
  for (const [key, value] of Object.entries(process.env)) {
    if (/^(NEXT_PUBLIC_FIREBASE_|FIREBASE_ADMIN_)/.test(key)) env[key] = value
  }
  return env
}

function check(label, target, env) {
  const projectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const adminProjectId = env.FIREBASE_ADMIN_PROJECT_ID
  const clientEmail = env.FIREBASE_ADMIN_CLIENT_EMAIL
  const steps = [
    () => assertFirebaseProjectForTarget(projectId, target),
    () =>
      assertFirebaseConfigConsistent(
        { projectId, storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN },
        target,
      ),
    () =>
      assertAdminCredentials({
        projectId: adminProjectId,
        clientEmail,
        privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY,
        clientProjectId: projectId,
        target,
      }),
  ]
  const errors = []
  for (const step of steps) {
    try {
      step()
    } catch (err) {
      errors.push(err.message)
    }
  }
  console.log(`\n${errors.length ? 'FAIL' : 'OK  '} ${label} (target: ${target})`)
  console.log(`     client project   ${projectId ?? '(unset)'}`)
  console.log(`     storage bucket   ${env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '(unset)'}`)
  console.log(`     auth domain      ${env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '(unset)'}`)
  console.log(`     admin project    ${adminProjectId ?? '(unset)'}`)
  console.log(`     admin account    ${clientEmail ?? '(unset)'}`)
  console.log(`     admin key        ${env.FIREBASE_ADMIN_PRIVATE_KEY ? 'present' : '(unset)'}`)
  for (const message of errors) console.log(`     ✗ ${message}`)
  return errors.length === 0
}

let ok
if (args.target) {
  if (!['production', 'preview', 'local'].includes(args.target)) {
    console.error('--target must be production, preview or local')
    process.exit(1)
  }
  if (!args['env-file']) {
    console.error('--target needs --env-file=<file from `vercel env pull`>')
    process.exit(1)
  }
  ok = check(args['env-file'], args.target, resolveEnv([args['env-file']]))
} else {
  ok = [
    check('localhost `next dev`', 'local', resolveEnv(['.env.development.local', '.env.local', '.env.development', '.env'])),
    check('localhost `next start`', 'local', resolveEnv(['.env.production.local', '.env.local', '.env.production', '.env'])),
  ].every(Boolean)
}
console.log(ok ? '\nAll checks passed. Nothing was written.' : '\nSome checks failed. Nothing was written.')
process.exit(ok ? 0 : 1)
