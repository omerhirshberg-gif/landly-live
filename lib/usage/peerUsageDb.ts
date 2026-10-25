import 'server-only'
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { currentFirebaseDeployTarget } from '@/lib/firebase/envGuard'
import { assertDevReader } from './peerGuard'
import { isMonthKey, USAGE_COLLECTION, USAGE_PROJECTS } from './usageTypes'

// Vercel Production's read of the DEV project's usage counters (lib/usage/peerGuard.ts):
// a separate, named Admin app on a dedicated service account whose IAM role
// only reads documents ("Usage Reader": datastore.entities.get/list,
// datastore.databases.getMetadata), set up per
// docs/google-cloud-configuration.md. USAGE_DEV_READER_CLIENT_EMAIL and
// USAGE_DEV_READER_PRIVATE_KEY live in Vercel Production only. The app is
// named, so it never becomes getAdminDb()'s (lib/firebase/admin.ts looks
// its own up by name), and only the two reads below are exported: this file
// writes nothing, anywhere.

export const DEV_READER_APP_NAME = `usage-reader:${USAGE_PROJECTS.dev}`

export function isDevReaderConfigured(): boolean {
  return !!process.env.USAGE_DEV_READER_CLIENT_EMAIL?.trim() && !!process.env.USAGE_DEV_READER_PRIVATE_KEY?.trim()
}

function readerApp(): App {
  if (currentFirebaseDeployTarget() !== 'production') throw new Error('The DEV usage reader runs on Vercel Production only.')
  const existing = getApps().find((app) => app.name === DEV_READER_APP_NAME)
  if (existing) return existing
  const clientEmail = process.env.USAGE_DEV_READER_CLIENT_EMAIL?.trim()
  // Env files can't hold real newlines, so the key is stored with literal "\n" escapes.
  const privateKey = process.env.USAGE_DEV_READER_PRIVATE_KEY?.replace(/\\n/g, '\n')
  assertDevReader(clientEmail, privateKey)
  const projectId = USAGE_PROJECTS.dev
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId }, DEV_READER_APP_NAME)
}

const usage = () => getFirestore(readerApp()).collection(USAGE_COLLECTION)

/** The DEV project's stored month (raw), or undefined when it has none. */
export async function readDevUsageMonth(month: string): Promise<Record<string, unknown> | undefined> {
  const snap = await usage().doc(month).get()
  return snap.exists ? snap.data() : undefined
}

/** The months the DEV project has counters for. */
export async function listDevUsageMonths(): Promise<string[]> {
  const snap = await usage().select().get()
  return snap.docs.map((doc) => doc.id).filter(isMonthKey)
}
