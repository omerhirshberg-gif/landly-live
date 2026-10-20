import { createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase/config'
import { requestVerificationEmail, type SignUpNames, type VerificationSendResult } from '@/lib/auth/requestVerificationEmail'
import { normalizePersonName } from '@/lib/auth/names'
import type { Lang } from '@/lib/i18n/translations'

export interface CustomerSignUpResult {
  email: string
  /** Kept only to authorize a resend from the "check your inbox" card. */
  idToken: string
  /** The first verification email, still in flight: the caller shows the card without waiting for it. */
  send: Promise<VerificationSendResult>
}

// Email+password sign-up, shared by the web /signup tab and the mobile app.
// The account stays locked until the emailed link is clicked, so the session
// Firebase opens here is dropped right away; the ID token taken just before
// authorizes the verification email (signing out doesn't revoke it).
// Nothing slow is awaited: the email request is handed back as a promise, and
// the users/{uid} doc is written server-side by that same request (with
// signInCustomerWithEmail as the fallback on the first verified sign-in), so
// the UI can switch to the verify card as soon as Firebase has created the account.
// The first and last name ride along on that request: the route writes them
// to the new profile and to the Auth display name.
export async function signUpCustomer(
  names: SignUpNames,
  email: string,
  password: string,
  lang: Lang,
  apiBaseUrl = ''
): Promise<CustomerSignUpResult> {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  try {
    const idToken = await cred.user.getIdToken()
    const send = requestVerificationEmail(idToken, lang, apiBaseUrl, {
      firstName: normalizePersonName(names.firstName),
      lastName: normalizePersonName(names.lastName),
      agreedToTerms: names.agreedToTerms,
      marketingOptIn: names.marketingOptIn,
    })
    return { email: cred.user.email ?? email, idToken, send }
  } finally {
    await signOut(auth)
  }
}
