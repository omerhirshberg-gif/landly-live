import { normalizePersonName, splitDisplayName } from './names'

// Apple sends the member's name only on the very first authorization of
// Landly by that Apple ID, and never puts it in the ID token, so it has to be
// caught on that one sign-in (signInCustomer.ts finishCustomerOAuthSignIn
// stores it). Later sign-ins, and members who hid their name, give nothing,
// and the app greets them without a name. No dependencies, so the native app
// and the website share it.

export type PersonNames = { firstName: string; lastName: string }

/** Both parts normalised, or null when there's no name at all. */
function toNames(firstName: unknown, lastName: unknown): PersonNames | null {
  const names = { firstName: normalizePersonName(firstName), lastName: normalizePersonName(lastName) }
  // An email is not a name (some providers fill it in as one).
  if (names.firstName.includes('@')) names.firstName = ''
  if (names.lastName.includes('@')) names.lastName = ''
  return names.firstName || names.lastName ? names : null
}

/**
 * The name from a web popup or redirect result. Firebase leaves Apple's name
 * out of `user.displayName`; the sign-in response (`_tokenResponse`, which
 * the SDK attaches to the credential but doesn't type) carries it on the
 * first authorization as firstName/lastName, or only as a full name.
 */
export function appleNamesFromWebResult(cred: unknown): PersonNames | null {
  const response = (cred as { _tokenResponse?: Record<string, unknown> } | null)?._tokenResponse
  if (!response || typeof response !== 'object') return null
  const parts = toNames(response.firstName, response.lastName)
  if (parts) return parts
  for (const whole of [response.fullName, response.displayName]) {
    if (typeof whole !== 'string') continue
    const split = splitDisplayName(whole)
    const names = toNames(split.firstName, split.lastName)
    if (names) return names
  }
  return null
}

/** The name from expo-apple-authentication's `fullName` (null on every sign-in but the first). */
export function appleNamesFromNative(fullName: { givenName?: string | null; familyName?: string | null } | null | undefined): PersonNames | null {
  if (!fullName) return null
  return toNames(fullName.givenName, fullName.familyName)
}

// The app keeps the name Apple sent (expo-secure-store) until a sign-in has
// stored it: Apple sends it once, and a Firebase step that fails after the
// Apple sheet (a misconfigured project, a dropped network) would lose it
// for good. Keyed by Apple's stable user identifier.
export const appleNameCacheKey = (appleUser: string) => `apple.name.${appleUser.replace(/[^A-Za-z0-9._-]/g, '_')}`

export function appleNamesToCache(names: PersonNames): string {
  return JSON.stringify(names)
}

/** A cached name back, re-normalised; null for nothing or anything malformed. */
export function appleNamesFromCache(raw: string | null | undefined): PersonNames | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { firstName?: unknown; lastName?: unknown } | null
    return parsed && typeof parsed === 'object' ? toNames(parsed.firstName, parsed.lastName) : null
  } catch {
    return null
  }
}
