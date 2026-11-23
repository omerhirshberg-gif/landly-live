import 'server-only'
import { getAdminDb, getAdminProjectId } from '@/lib/firebase/admin'
import { FEATURE_FLAGS_DOC, resolveRaayonitComingSoon, resolveRaayonitDisplay } from './featureFlags'

// isRaayonitDisplayEnabled(): the display gate for everything Raayonit-branded (name, logo, business list, business images).
// isRaayonitComingSoonEnabled(): launch-pending mode (cards listed, "not available yet" notice, no purchase).
// Stock, sync and storage keep working whatever they say. A short in-process cache keeps them off the hot path; a flag flip
// is visible within TTL on each instance (and immediately after `resetFeatureFlagCache`).
const TTL_MS = 30_000
let cached: { at: number; display: boolean; comingSoon: boolean } | null = null

export function resetFeatureFlagCache() { cached = null }

async function readFlags(): Promise<{ display: boolean; comingSoon: boolean }> {
  const now = Date.now()
  if (cached && now - cached.at < TTL_MS) return cached
  let data: Record<string, unknown> | undefined
  try {
    const [collection, id] = FEATURE_FLAGS_DOC.split('/') as [string, string]
    data = (await getAdminDb().collection(collection).doc(id).get()).data()
  } catch {
    data = undefined
  }
  cached = {
    at: now,
    display: resolveRaayonitDisplay({ env: process.env.RAAYONIT_DISPLAY_ENABLED, doc: data?.raayonitDisplay, projectId: safeProjectId() }),
    comingSoon: resolveRaayonitComingSoon({ env: process.env.RAAYONIT_COMING_SOON, doc: data?.raayonitComingSoon }),
  }
  return cached
}

export async function isRaayonitDisplayEnabled(): Promise<boolean> {
  return (await readFlags()).display
}

export async function isRaayonitComingSoonEnabled(): Promise<boolean> {
  return (await readFlags()).comingSoon
}

function safeProjectId(): string | undefined {
  try { return getAdminProjectId() } catch { return undefined }
}
