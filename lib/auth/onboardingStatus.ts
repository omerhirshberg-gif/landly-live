// Whether a member still owes the onboarding cards. Re-exported from
// ./onboarding; kept separate so the auth provider (on every page) doesn't
// pull in libphonenumber.

/**
 * True once the wizard has been finished (onboardingCompletedAt), or for
 * members from before it existed, whose persona and phone are already set.
 * The WhatsApp number may be skipped, so it can't be the marker on its own.
 * Accounts made since only ever get both fields from the wizard, which
 * stamps onboardingCompletedAt in the same write.
 */
export function isOnboardingComplete(
  doc: { phone: string; customerType: string; onboardingCompleted?: boolean } | null
): boolean {
  if (!doc) return false
  return !!doc.onboardingCompleted || (!!doc.phone && !!doc.customerType)
}

/** Sign-in providers whose accounts are always customers (businesses sign in with a password). */
export const OAUTH_PROVIDER_IDS: readonly string[] = ['google.com', 'apple.com']

export function hasOAuthProvider(providerIds: readonly string[]): boolean {
  return providerIds.some((id) => OAUTH_PROVIDER_IDS.includes(id))
}

/**
 * The gate the auth provider applies to a verified session. With a profile
 * doc, isOnboardingComplete decides. Without one, a password session stays
 * ungated (a business account, or an email sign-in still creating its doc,
 * which decides on its own); a Google or Apple session is a customer whose
 * doc never got written (a dropped connection right after sign-in, a lost
 * web redirect), so it owes onboarding, and the sign-in screen recreates the
 * doc before the wizard opens.
 */
export function sessionOnboardingStatus(
  doc: Parameters<typeof isOnboardingComplete>[0],
  providerIds: readonly string[]
): boolean {
  if (doc) return isOnboardingComplete(doc)
  return !hasOAuthProvider(providerIds)
}
