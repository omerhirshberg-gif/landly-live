// Feature flags that must read the same on the dev and production projects, resolved in one pure place.
// Stored in `system_config/feature_flags` of each Firebase project (Admin SDK only, like every system_config doc),
// with an env var that wins when set. Pure so the server helper, the tests and the docs agree.

export const FEATURE_FLAGS_DOC = 'system_config/feature_flags'

export interface FlagInputs {
  /** RAAYONIT_DISPLAY_ENABLED: '1'/'true' or '0'/'false'. Wins over the document. */
  env: string | undefined
  /** system_config/feature_flags.raayonitDisplay, when the document exists. */
  doc: unknown
  /** The Firebase project this deployment reads. */
  projectId: string | undefined
}

const parseBool = (v: unknown): boolean | null => {
  if (typeof v === 'boolean') return v
  if (typeof v !== 'string') return null
  const t = v.trim().toLowerCase()
  if (t === '1' || t === 'true' || t === 'on') return true
  if (t === '0' || t === 'false' || t === 'off') return false
  return null
}

/**
 * Whether Raayonit's name, logo, business list and business images are shown (the kill switch).
 * Order: env var, then the Firestore flag, then the default: ON on every project, production included, so the dev and production
 * projects behave identically. Set RAAYONIT_DISPLAY_ENABLED=0 or system_config/feature_flags.raayonitDisplay=false to hide it at once.
 */
export function resolveRaayonitDisplay({ env, doc, projectId }: FlagInputs): boolean {
  const fromEnv = parseBool(env)
  if (fromEnv !== null) return fromEnv
  const fromDoc = parseBool(doc)
  if (fromDoc !== null) return fromDoc
  void projectId
  return true
}
