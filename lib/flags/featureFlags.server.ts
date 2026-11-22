import 'server-only'
import { getAdminDb, getAdminProjectId } from '@/lib/firebase/admin'
import { FEATURE_FLAGS_DOC, resolveRaayonitDisplay } from './featureFlags'

// isRaayonitDisplayEnabled(): the display gate for everything Raayonit-branded (name, logo, business list, business images).
// Stock, sync and storage keep working whatever it says. A short in-process cache keeps it off the hot path; a flag flip
// is visible within TTL on each instance (and immediately after `resetFeatureFlagCache`).
const TTL_MS = 30_000
let cached: { at: number; value: boolean } | null = null

export function resetFeatureFlagCache() { cached = null }

export async function isRaayonitDisplayEnabled(): Promise<boolean> {
  const now = Date.now()
  if (cached && now - cached.at < TTL_MS) return cached.value
  let doc: unknown
  try {
    const [collection, id] = FEATURE_FLAGS_DOC.split('/') as [string, string]
    doc = (await getAdminDb().collection(collection).doc(id).get()).data()?.raayonitDisplay
  } catch {
    doc = undefined
  }
  const value = resolveRaayonitDisplay({ env: process.env.RAAYONIT_DISPLAY_ENABLED, doc, projectId: safeProjectId() })
  cached = { at: now, value }
  return value
}

function safeProjectId(): string | undefined {
  try { return getAdminProjectId() } catch { return undefined }
}
