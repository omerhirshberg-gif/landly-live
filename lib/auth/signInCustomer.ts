import { FirebaseError } from 'firebase/app'
import { signInWithCustomToken, signInWithEmailAndPassword, signOut, updateProfile, type User, type UserCredential } from 'firebase/auth'
import type { PersonNames } from '@/lib/auth/appleName'
import { fullName } from '@/lib/auth/names'
import { auth } from '@/lib/firebase/config'
import { signOutIfBusinessAccount } from '@/lib/firebase/businesses'
import { hasOAuthProvider } from '@/lib/auth/onboardingStatus'
import { ensureUserDocument, getUserDocument, type UserDocument } from '@/lib/firebase/users'
import { resolvePreferredLanguage } from '@/lib/i18n/preferredLanguage'
import type { Lang } from '@/lib/i18n/translations'

// The customer sign-in rules, shared by the web /login page and the mobile
// app so both enforce the same role separation and verification gate.
// Platform-specific steps (web persistence, popup vs. native Google SDK)
// stay with the caller; everything after Firebase returns a credential is here.
export type CustomerSignInResult =
  | { status: 'signedIn'; user: User; preferredLanguage: Lang | null }
  | { status: 'businessAccount' }
  | { status: 'unverified'; email: string; idToken: string }

export async function signInCustomerWithEmail(
  email: string,
  password: string,
  currentLang: Lang
): Promise<CustomerSignInResult> {
  const cred = await signInWithEmailAndPassword(auth, email, password)
  if (await signOutIfBusinessAccount(cred.user.uid)) return { status: 'businessAccount' }
  // Firebase lets unverified accounts sign in, so the block is ours: sign
  // straight back out and offer a resend. The server enforces the same
  // rule independently (requireVerifiedCustomerUid, firestore.rules).
  if (!cred.user.emailVerified) {
    const idToken = await cred.user.getIdToken()
    await signOut(auth)
    return { status: 'unverified', email: cred.user.email ?? email, idToken }
  }
  // Sign-up doesn't wait on Firestore (see signUpCustomer), so the first
  // verified sign-in is where the profile doc is created.
  await ensureUserDocument(cred.user, { preferredLanguage: currentLang })
  return {
    status: 'signedIn',
    user: cred.user,
    preferredLanguage: await resolvePreferredLanguage(cred.user.uid, currentLang),
  }
}

/**
 * A passkey sign-in on the website: /api/auth/passkey/login-verify already
 * refused business, disabled and unverified accounts before minting the
 * custom token; the business check runs again here like every other path.
 */
export async function signInCustomerWithCustomToken(customToken: string, currentLang: Lang): Promise<CustomerSignInResult> {
  const cred = await signInWithCustomToken(auth, customToken)
  if (await signOutIfBusinessAccount(cred.user.uid)) return { status: 'businessAccount' }
  await ensureUserDocument(cred.user, { preferredLanguage: currentLang })
  return {
    status: 'signedIn',
    user: cred.user,
    preferredLanguage: await resolvePreferredLanguage(cred.user.uid, currentLang),
  }
}

/**
 * Runs after any Google or Apple sign-in (web popup or redirect, native
 * credential). Only the user is read, so a web redirect whose result was lost
 * can pass the restored session's `{ user: auth.currentUser }` instead.
 * `names` is Apple's first-authorization-only name (lib/auth/appleName.ts).
 */
export async function finishCustomerOAuthSignIn(
  cred: Pick<UserCredential, 'user'>,
  currentLang: Lang,
  { names = null }: { names?: PersonNames | null } = {}
): Promise<CustomerSignInResult> {
  // Google and Apple vouch for the email, so Firebase marks these sessions
  // verified. Should one ever come back unverified, the rules would refuse
  // its profile and every onboarding answer: sign it straight back out with
  // a clear error rather than leave the member in a wizard that can't save.
  if (!cred.user.emailVerified) {
    await signOut(auth)
    throw new FirebaseError('auth/unverified-provider-email', 'The sign-in provider did not verify this email')
  }
  // Before ensureUserDocument, so a business never gets a customer doc.
  if (await signOutIfBusinessAccount(cred.user.uid)) return { status: 'businessAccount' }
  // Apple never sends the name again, so it goes on the Auth record first:
  // that survives even if the profile write below fails.
  if (names && !cred.user.displayName) {
    await updateProfile(cred.user, { displayName: fullName(names.firstName, names.lastName) }).catch(() => undefined)
  }
  // Google and Apple skip the sign-up checkbox: consent is the disclosure under
  // the "Continue with" buttons, recorded when the account's doc is created.
  await ensureUserDocument(cred.user, { preferredLanguage: currentLang, agreedToTerms: true, names })
  return {
    status: 'signedIn',
    user: cred.user,
    preferredLanguage: await resolvePreferredLanguage(cred.user.uid, currentLang),
  }
}

/**
 * The profile for a session the sign-in screen reopens mid-onboarding (a
 * reload, a relaunch, a web redirect whose result was lost). A Google or
 * Apple session whose doc was never written (sessionOnboardingStatus) runs
 * the customer rules again first, which reject a business and create the doc,
 * so the wizard has a profile to save into. A doc that can't be read is null
 * and the wizard opens anyway, as before.
 */
export async function resumeCustomerSession(
  user: User,
  currentLang: Lang
): Promise<{ status: 'businessAccount' } | { status: 'resume'; doc: UserDocument | null }> {
  let doc: UserDocument | null
  try {
    doc = await getUserDocument(user.uid)
  } catch {
    return { status: 'resume', doc: null }
  }
  if (doc || !hasOAuthProvider(user.providerData.map((p) => p.providerId))) return { status: 'resume', doc }
  const result = await finishCustomerOAuthSignIn({ user }, currentLang)
  if (result.status === 'businessAccount') return result
  return { status: 'resume', doc: await getUserDocument(user.uid).catch(() => null) }
}

/** finishCustomerOAuthSignIn for Google, which sends no separate name. */
export const finishCustomerGoogleSignIn = (cred: Pick<UserCredential, 'user'>, currentLang: Lang) =>
  finishCustomerOAuthSignIn(cred, currentLang)
