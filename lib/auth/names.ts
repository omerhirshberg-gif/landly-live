// Member names: how a typed first/last name is stored, joined into the
// display name, recovered from a single display name, and picked for a
// greeting. Shared by the sign-up form, the send-verification route, the
// profile doc helpers and both home screens (web and Expo). No dependencies,
// so pages that only greet don't pull in the phone-number library.

export const MAX_NAME_LENGTH = 50

/**
 * A first or last name as stored: control characters dropped, whitespace
 * collapsed, trimmed and capped. Also run by the server on whatever the
 * sign-up request sends.
 */
export function normalizePersonName(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH)
    .trim()
}

/**
 * First and last name are both required wherever a member types them (the
 * Sign Up form, the profile editors on the website and in the app): a blank
 * one, or one that's only spaces, gets "This field is required".
 */
export type NameFieldErrors = Partial<Record<'firstName' | 'lastName', 'form_fieldRequired'>>

export function nameFieldErrors(fields: { firstName: string; lastName: string }): NameFieldErrors {
  const errors: NameFieldErrors = {}
  if (!normalizePersonName(fields.firstName)) errors.firstName = 'form_fieldRequired'
  if (!normalizePersonName(fields.lastName)) errors.lastName = 'form_fieldRequired'
  return errors
}

/**
 * The profile editors' name check (website /profile, the app's Profile tab):
 * both parts required, except that a member who has no name yet (Apple's
 * hidden name, or a first authorization that was lost) may leave both blank
 * and still save the rest of their details.
 */
export function profileNameErrors(fields: { firstName: string; lastName: string }, { hadName }: { hadName: boolean }): NameFieldErrors {
  if (!hadName && !normalizePersonName(fields.firstName) && !normalizePersonName(fields.lastName)) return {}
  return nameFieldErrors(fields)
}

/** "First Last", as written to users/{uid}.displayName and the Auth record. */
export function fullName(firstName: string, lastName: string): string {
  return `${normalizePersonName(firstName)} ${normalizePersonName(lastName)}`.trim()
}

/** Best guess at first/last from a single display name (Google accounts, older profiles). */
export function splitDisplayName(displayName: string | null | undefined): { firstName: string; lastName: string } {
  const words = normalizePersonName(displayName ?? '').split(' ').filter(Boolean)
  return { firstName: words[0] ?? '', lastName: words.slice(1).join(' ') }
}

/**
 * The name to greet a member by: their first name, else the first word of a
 * display name (profile, then Auth). Never derived from the email address —
 * null means "greet without a name".
 */
export function greetingName(
  doc: { firstName?: string; displayName?: string } | null | undefined,
  authDisplayName?: string | null
): string | null {
  const candidates = [doc?.firstName, splitDisplayName(doc?.displayName).firstName, splitDisplayName(authDisplayName).firstName]
  for (const candidate of candidates) {
    const name = normalizePersonName(candidate)
    // A display name that is really an email (some providers do this) isn't a name.
    if (name && !name.includes('@')) return name
  }
  return null
}
