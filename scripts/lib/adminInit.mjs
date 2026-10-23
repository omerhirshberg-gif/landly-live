// Firebase Admin setup shared by the maintenance scripts
// (backfill-redeem-tokens.mjs, disable-account.mjs). lib/firebase/admin.ts
// can't be reused here: it's server-only TypeScript behind the env guard.
//
// Credentials: the service-account key from FIREBASE_ADMIN_* when
// FIREBASE_ADMIN_PRIVATE_KEY is set; otherwise Application Default
// Credentials (`gcloud auth application-default login`, or
// GOOGLE_APPLICATION_CREDENTIALS) -- .env.local leaves the key empty on
// purpose. Against the emulators (FIRESTORE_EMULATOR_HOST /
// FIREBASE_AUTH_EMULATOR_HOST) neither is needed.
//
// Project: --project <id> (or --project=<id>), else FIREBASE_ADMIN_PROJECT_ID,
// else GOOGLE_CLOUD_PROJECT, else the active gcloud project. Never defaults
// to production on its own; the caller prints what was chosen before doing
// anything.

import { execFileSync } from 'node:child_process'
import { applicationDefault, cert, initializeApp } from 'firebase-admin/app'

export const ADC_HINT = 'Application Default Credentials are missing or lack access. Run `gcloud auth application-default login` with an account that can access this project, or set FIREBASE_ADMIN_PRIVATE_KEY.'

export function flagValue(args, name) {
  const inline = args.find((a) => a.startsWith(`${name}=`))
  if (inline) return inline.slice(name.length + 1)
  const at = args.indexOf(name)
  return at >= 0 && args[at + 1] && !args[at + 1].startsWith('--') ? args[at + 1] : undefined
}

function activeGcloudProject() {
  try {
    const out = execFileSync('gcloud', ['config', 'get-value', 'project'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    return out && out !== '(unset)' ? out : undefined
  } catch {
    return undefined
  }
}

/**
 * Initializes the Admin app, or prints why it can't and exits 1.
 * Returns { app, projectId, credentialLabel, usesAdc }.
 */
export function initAdminForScript(args) {
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.trim() ? process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim() || undefined
  const keyProject = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim() || undefined
  const projectId = flagValue(args, '--project') || keyProject || process.env.GOOGLE_CLOUD_PROJECT || activeGcloudProject()

  if (!projectId) {
    console.error('No project to run against. Pass --project <projectId> (e.g. --project landly-be752).')
    process.exit(1)
  }

  const emulators = [process.env.FIRESTORE_EMULATOR_HOST, process.env.FIREBASE_AUTH_EMULATOR_HOST].filter(Boolean)
  let credential
  let credentialLabel
  if (emulators.length) {
    credentialLabel = `none (emulator at ${emulators.join(', ')})`
  } else if (privateKey) {
    if (!clientEmail) {
      console.error('FIREBASE_ADMIN_PRIVATE_KEY is set but FIREBASE_ADMIN_CLIENT_EMAIL is not.')
      process.exit(1)
    }
    // A key belongs to one project; pointing it at another only fails later, less clearly.
    if (keyProject && keyProject !== projectId) {
      console.error(`--project ${projectId} doesn't match the service account's project (${keyProject}). Drop --project, or run without the key to use Application Default Credentials.`)
      process.exit(1)
    }
    credential = cert({ projectId, clientEmail, privateKey })
    credentialLabel = `service account ${clientEmail}`
  } else {
    credential = applicationDefault()
    credentialLabel = 'Application Default Credentials'
  }

  const app = initializeApp({ projectId, ...(credential ? { credential } : {}) })
  console.log(`Project: ${projectId}\nCredentials: ${credentialLabel}`)
  return { app, projectId, credentialLabel, usesAdc: credentialLabel === 'Application Default Credentials' }
}
