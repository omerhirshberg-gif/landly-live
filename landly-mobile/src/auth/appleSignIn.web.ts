import * as firebaseAuth from 'firebase/auth'
import type * as BrowserAuth from '@firebase/auth/dist/auth-public'
import { appleNamesFromWebResult } from '@shared/auth/appleName'
import { finishCustomerOAuthSignIn, type CustomerSignInResult } from '@shared/auth/signInCustomer'
import { appleProvider, auth } from '@shared/firebase/config'
import type { Lang } from '@shared/i18n/translations'

// tsconfig types firebase/auth as its React Native build, which has no
// popup; in the browser, Metro bundles the browser build, which does.
const { signInWithPopup } = firebaseAuth as unknown as typeof BrowserAuth

// Browser build (Metro picks this over appleSignIn.ts for web): the same
// Firebase popup the website's login page uses, then the shared customer rules.
export async function isAppleSignInAvailable(): Promise<boolean> {
  return true
}

export async function signInWithApple(currentLang: Lang): Promise<CustomerSignInResult> {
  const cred = await signInWithPopup(auth, appleProvider)
  return finishCustomerOAuthSignIn(cred, currentLang, { names: appleNamesFromWebResult(cred) })
}
