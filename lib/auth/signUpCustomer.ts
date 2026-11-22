import { createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase/config'
import { requestSignupOtp, type ContactChangeResult, type SignupOtpStart } from '@/lib/account/contactChange'
import { normalizePersonName } from '@/lib/auth/names'
import type { Lang } from '@/lib/i18n/translations'

/** What the sign-up form sends along with the first code: the profile is created from it server-side. */
export interface SignUpNames {
  firstName: string
  lastName: string
  /** The sign-up form's Terms of Service / Privacy Policy checkbox. */
  agreedToTerms?: boolean
  /** The sign-up form's optional marketing email checkbox (unticked by default). */
  marketingOptIn?: boolean
}

/** The outcome of a send (or of a cooldown lookup) for an unverified account's code. */
export type SignupOtpSend = Promise<ContactChangeResult<SignupOtpStart>>

export interface CustomerSignUpResult {
  email: string
  /** Kept to authorize the code check and a resend: the member is signed out until the code is right. */
  idToken: string
  /** The first code, still in flight: the caller opens the code dialog without waiting for it. */
  send: SignupOtpSend
}

/**
 * The code dialog's subject: an email+password account that isn't verified
 * yet, from the sign-up form ('signup') or a later sign-in ('login').
 */
export interface PendingVerification {
  variant: 'signup' | 'login'
  email: string
  idToken: string
  send: SignupOtpSend
}

// Email+password sign-up, shared by the web /signup tab and the mobile app.
// The account stays locked until the emailed 6-digit code is typed back, so the
// session Firebase opens here is dropped right away; the ID token taken just
// before authorizes the code (signing out doesn't revoke it).
// Nothing slow is awaited: the code request is handed back as a promise, and
// the users/{uid} doc is written server-side by that same request (with
// signInCustomerWithEmail as the fallback on the first verified sign-in), so
// the UI can open the code dialog as soon as Firebase has created the account.
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
    const send = requestSignupOtp(
      idToken,
      {
        lang,
        firstName: normalizePersonName(names.firstName),
        lastName: normalizePersonName(names.lastName),
        agreedToTerms: names.agreedToTerms === true,
        marketingOptIn: names.marketingOptIn === true,
      },
      apiBaseUrl
    )
    return { email: cred.user.email ?? email, idToken, send }
  } finally {
    await signOut(auth)
  }
}
