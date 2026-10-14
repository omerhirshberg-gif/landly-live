import * as firebaseAuth from 'firebase/auth'
import type * as BrowserAuth from '@firebase/auth/dist/auth-public'
import { finishCustomerGoogleSignIn, type CustomerSignInResult } from '@shared/auth/signInCustomer'
import { auth, googleProvider } from '@shared/firebase/config'
import type { Lang } from '@shared/i18n/translations'

// tsconfig types firebase/auth as its React Native build, which has no
// popup; in the browser, Metro bundles the browser build, which does.
const { signInWithPopup } = firebaseAuth as unknown as typeof BrowserAuth

// Browser build (Metro picks this over googleSignIn.ts for web): the same
// Firebase popup the website's login page uses, then the shared customer rules.
export const GOOGLE_SIGN_IN_CONFIGURED = true

export async function signInWithGoogle(currentLang: Lang): Promise<CustomerSignInResult> {
  return finishCustomerGoogleSignIn(await signInWithPopup(auth, googleProvider), currentLang)
}
