// A short, non-secret fingerprint of the Google OAuth client ID baked into a native build, shown inside the sign-in
// error detail. Testers on TestFlight / Play Internal Testing have no debugger, so one screenshot has to say which
// client the binary actually uses (e.g. "8400...b3l6"). Client IDs are public (they sit in every OAuth URL), but only
// the project-number prefix and the last four characters of the ID are shown.

/** "840081012057-15s0...b3l6.apps.googleusercontent.com" -> "8400...b3l6"; null when there is no ID. */
export function maskGoogleClientId(id: string | null | undefined): string | null {
  const bare = (id ?? '').trim().replace(/\.apps\.googleusercontent\.com$/i, '')
  if (bare.length < 9) return bare ? '(malformed)' : null
  return `${bare.slice(0, 4)}...${bare.slice(-4)}`
}

/** Reads the hint attached to a sign-in error by the native Google flows. */
export function googleClientHintOf(err: unknown): string | null {
  const hint = (err as { googleClient?: unknown } | null)?.googleClient
  return typeof hint === 'string' && /^[\w(). -]{1,24}$/.test(hint) ? hint : null
}

/** What the running binary and its OTA bundle are (landly-mobile/src/auth/nativeBuildInfo.ts). All fields optional. */
export type GoogleBuildInfo = {
  platform?: string
  applicationId?: string
  versionCode?: string
  updateId?: string
  channel?: string
  runtimeVersion?: string
  embedded?: boolean
  /** Signing certificate SHA-1 of this install, "AA:BB:..." (Android binaries with the signing module). */
  signingSha1?: string
  /** Where it was installed from: the Play Store, no installer, or another store. */
  installer?: string
}

const SAFE_TOKEN = /^[A-Za-z0-9._-]{1,64}$/
const SHA1 = /^(?:[0-9A-Fa-f]{2}:){19}[0-9A-Fa-f]{2}$/
const INSTALLERS = ['play', 'sideload', 'other']

// "8A:62:09:...:E7:01" -> "8A62…E701": the first and last four hex characters tell any registered key apart.
function abbreviateSha1(sha1: string | undefined): string | null {
  if (!sha1 || !SHA1.test(sha1)) return null
  const hex = sha1.replace(/:/g, '').toUpperCase()
  return `${hex.slice(0, 4)}…${hex.slice(-4)}`
}

/**
 * "pkg com.amitbd.landlyapp · v12 · rt 1.0.0 · testflight · ota 3fa91c2d · sha 8A62…E701 · play" (or "embedded" for the bundle shipped in
 * the binary). Only short, plain tokens are kept, so a corrupt value can't put free text on screen; null when empty.
 */
export function formatGoogleBuildInfo(info: GoogleBuildInfo | null | undefined): string | null {
  if (!info) return null
  const token = (value: string | undefined) => (value && SAFE_TOKEN.test(value) ? value : null)
  const parts = [
    token(info.applicationId) && `pkg ${info.applicationId}`,
    token(info.versionCode) && `v${info.versionCode}`,
    token(info.runtimeVersion) && `rt ${info.runtimeVersion}`,
    token(info.channel),
    info.embedded === true ? 'embedded' : token(info.updateId) && `ota ${info.updateId!.slice(0, 8)}`,
    abbreviateSha1(info.signingSha1) && `sha ${abbreviateSha1(info.signingSha1)}`,
    info.installer && INSTALLERS.includes(info.installer) ? info.installer : null,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

/** Reads the build detail attached to a sign-in error by the native Google flows. */
export function googleBuildInfoOf(err: unknown): string | null {
  const text = (err as { googleBuild?: unknown } | null)?.googleBuild
  return typeof text === 'string' && /^[\w .·+…-]{1,160}$/.test(text) ? text : null
}

/** Attaches the masked client ID (and, when given, the build detail) to an error (returns the same error). */
export function withGoogleClientHint<T extends Error>(err: T, clientId: string | null | undefined, build?: GoogleBuildInfo | null): T {
  const hint = maskGoogleClientId(clientId)
  const tagged = err as T & { googleClient?: string; googleBuild?: string }
  if (hint) tagged.googleClient = hint
  const detail = formatGoogleBuildInfo(build)
  if (detail) tagged.googleBuild = detail
  return err
}
