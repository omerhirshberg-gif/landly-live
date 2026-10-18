// Keeps each deployment on its own Firebase project.
//
//  - local (anything not on Vercel: `next dev`, a local `next start`, Expo
//    with __DEV__) must not use production. Its landly-dev values live in the
//    repo-root .env.local; if they're missing or malformed, the production
//    values in .env take over silently -- which is how local sign-ups once
//    ended up in production.
//  - Vercel Preview must use landly-dev.
//  - Vercel Production must use landly-be752.
//
// These checks turn a mismatch into an error at Firebase initialization.
// Next.js only inlines declared env vars into the browser bundle, so
// next.config.js passes VERCEL/VERCEL_ENV through as LANDLY_VERCEL(_ENV).
// Shared by client code, so nothing here may be server-only.

export const PRODUCTION_FIREBASE_PROJECT_ID = 'landly-be752'
export const STAGING_FIREBASE_PROJECT_ID = 'landly-dev'

/** 'unchecked': unit tests, and Expo release builds (EAS supplies their config). */
export type FirebaseDeployTarget = 'production' | 'preview' | 'local' | 'unchecked'

export function firebaseDeployTarget(env: {
  vercel: string | undefined
  vercelEnv: string | undefined
  nodeEnv: string | undefined
}): FirebaseDeployTarget {
  if (env.nodeEnv === 'test') return 'unchecked'
  if (env.vercel !== '1') return 'local'
  if (env.vercelEnv === 'production') return 'production'
  if (env.vercelEnv === 'preview') return 'preview'
  // `vercel dev` runs on a developer's machine.
  return 'local'
}

/** The target of the running Next.js build -- the same answer on the server and in the browser. */
export function currentFirebaseDeployTarget(): FirebaseDeployTarget {
  return firebaseDeployTarget({
    // Literal process.env reads, so Next.js inlines them into the browser bundle.
    vercel: process.env.LANDLY_VERCEL,
    vercelEnv: process.env.LANDLY_VERCEL_ENV,
    nodeEnv: process.env.NODE_ENV,
  })
}

/** Throws when a development build is about to use the production project (or none). */
export function assertDevFirebaseProject(projectId: string | undefined, isDevelopment: boolean, sdk = 'Firebase'): void {
  if (!isDevelopment) return
  if (!projectId) {
    throw new Error(`${sdk}: no Firebase project ID in development. Add the landly-dev NEXT_PUBLIC_FIREBASE_* values to .env.local.`)
  }
  if (projectId === PRODUCTION_FIREBASE_PROJECT_ID) {
    throw new Error(
      `${sdk}: development is configured for the production project (${PRODUCTION_FIREBASE_PROJECT_ID}). ` +
        'Put the landly-dev values in .env.local as KEY=VALUE lines and restart the dev server.',
    )
  }
}

/** Throws when the project ID is wrong for where this build runs. */
export function assertFirebaseProjectForTarget(projectId: string | undefined, target: FirebaseDeployTarget, sdk = 'Firebase'): void {
  if (target === 'unchecked') return
  if (target === 'local') return assertDevFirebaseProject(projectId, true, sdk)
  const expected = target === 'production' ? PRODUCTION_FIREBASE_PROJECT_ID : STAGING_FIREBASE_PROJECT_ID
  if (projectId !== expected) {
    throw new Error(
      `${sdk}: the Vercel ${target} deployment must use ${expected}, not ${projectId ?? 'no project'}. ` +
        `Fix the NEXT_PUBLIC_FIREBASE_* / FIREBASE_ADMIN_* values in Vercel's ${target === 'production' ? 'Production' : 'Preview'} environment.`,
    )
  }
}

/**
 * Next.js and app.config.js merge .env and .env.local key by key, so a line
 * missing from .env.local falls back to its production value while the
 * project ID still reads landly-dev -- e.g. avatar uploads landing in the
 * production bucket. The bucket and a firebaseapp.com/web.app authDomain
 * both name their project; a custom authDomain (our own host) is left alone.
 */
export function assertFirebaseConfigConsistent(
  config: { projectId?: string; storageBucket?: string; authDomain?: string },
  target: FirebaseDeployTarget,
  sdk = 'Firebase',
): void {
  if (target === 'unchecked') return
  const { projectId, storageBucket, authDomain } = config
  if (!projectId) return
  if (storageBucket && !storageBucket.startsWith(`${projectId}.`)) {
    throw new Error(`${sdk}: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET (${storageBucket}) doesn't belong to ${projectId}.`)
  }
  const host = authDomain?.toLowerCase()
  if (host && /\.(firebaseapp\.com|web\.app)$/.test(host) && !host.startsWith(`${projectId}.`)) {
    throw new Error(`${sdk}: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN (${authDomain}) doesn't belong to ${projectId}.`)
  }
}

/**
 * The Admin SDK bypasses every Security Rule, so its service account must
 * belong to the same project as the client, and that project must be the
 * right one for where this build runs.
 */
export function assertAdminCredentials(params: {
  projectId: string | undefined
  clientEmail: string | undefined
  privateKey: string | undefined
  clientProjectId: string | undefined
  target: FirebaseDeployTarget
}): void {
  const { projectId, clientEmail, privateKey, clientProjectId, target } = params
  if (target === 'unchecked') return
  assertFirebaseProjectForTarget(projectId, target, 'Firebase Admin')
  if (projectId !== clientProjectId) {
    throw new Error(
      `Firebase Admin: FIREBASE_ADMIN_PROJECT_ID (${projectId}) doesn't match NEXT_PUBLIC_FIREBASE_PROJECT_ID (${clientProjectId ?? 'unset'}).`,
    )
  }
  if (!clientEmail || !privateKey) {
    throw new Error(
      `Firebase Admin: no service account for ${projectId}. ` +
        'Set FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY from a key of that project (.env.local when local).',
    )
  }
  // Service-account emails name their project; a production key paired with
  // the landly-dev project ID would otherwise slip through.
  if (!clientEmail.toLowerCase().endsWith(`@${projectId}.iam.gserviceaccount.com`)) {
    throw new Error(`Firebase Admin: FIREBASE_ADMIN_CLIENT_EMAIL isn't a ${projectId} service account.`)
  }
}
