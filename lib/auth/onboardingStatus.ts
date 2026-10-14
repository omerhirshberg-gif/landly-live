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
