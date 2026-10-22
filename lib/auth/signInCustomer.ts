import { signInWithCustomToken, signInWithEmailAndPassword, signOut, type User, type UserCredential } from 'firebase/auth'
import { auth } from '@/lib/firebase/config'
import { signOutIfBusinessAccount } from '@/lib/firebase/businesses'
import { ensureUserDocument } from '@/lib/firebase/users'
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
 * Runs after any Google sign-in (web popup or native ID-token credential).
 * Only the user is read, so a web redirect whose result was lost can pass
 * the restored session's `{ user: auth.currentUser }` instead.
 */
export async function finishCustomerGoogleSignIn(cred: Pick<UserCredential, 'user'>, currentLang: Lang): Promise<CustomerSignInResult> {
  // Before ensureUserDocument, so a business never gets a customer doc.
  if (await signOutIfBusinessAccount(cred.user.uid)) return { status: 'businessAccount' }
  // Google skips the sign-up checkbox: consent is the disclosure under the
  // "Continue with Google" button, recorded when the account's doc is created.
  await ensureUserDocument(cred.user, { preferredLanguage: currentLang, agreedToTerms: true })
  return {
    status: 'signedIn',
    user: cred.user,
    preferredLanguage: await resolvePreferredLanguage(cred.user.uid, currentLang),
  }
}
