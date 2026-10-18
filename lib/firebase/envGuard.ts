// Keeps development builds off the production Firebase project.
//
// Local development (`next dev`, Expo with __DEV__) must use landly-dev, set
// in the repo-root .env.local. If those values are missing or malformed, the
// production values in .env take over silently -- which is how local sign-ups
// once ended up in production. These checks turn that into an error at
// Firebase initialization. Production builds (NODE_ENV=production, Vercel,
// expo export) skip them and use whatever their environment provides.
// Shared by client code, so nothing here may be server-only.

export const PRODUCTION_FIREBASE_PROJECT_ID = 'landly-be752'

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

/**
 * The Admin SDK bypasses every Security Rule, so in development its service
 * account must belong to the same non-production project as the client.
 */
export function assertDevAdminCredentials(params: {
  projectId: string | undefined
  clientEmail: string | undefined
  privateKey: string | undefined
  clientProjectId: string | undefined
  isDevelopment: boolean
}): void {
  const { projectId, clientEmail, privateKey, clientProjectId, isDevelopment } = params
  if (!isDevelopment) return
  assertDevFirebaseProject(projectId, true, 'Firebase Admin')
  if (projectId !== clientProjectId) {
    throw new Error(
      `Firebase Admin: FIREBASE_ADMIN_PROJECT_ID (${projectId}) doesn't match NEXT_PUBLIC_FIREBASE_PROJECT_ID (${clientProjectId ?? 'unset'}).`,
    )
  }
  if (!clientEmail || !privateKey) {
    throw new Error(
      `Firebase Admin: no service account for ${projectId} in development. ` +
        'Set FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY in .env.local from a landly-dev key.',
    )
  }
  // Service-account emails name their project; a production key paired with
  // the landly-dev project ID would otherwise slip through.
  if (!clientEmail.toLowerCase().endsWith(`@${projectId}.iam.gserviceaccount.com`)) {
    throw new Error(`Firebase Admin: FIREBASE_ADMIN_CLIENT_EMAIL isn't a ${projectId} service account.`)
  }
}
