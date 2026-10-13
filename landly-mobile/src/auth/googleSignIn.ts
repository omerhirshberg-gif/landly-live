import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth'
import { finishCustomerGoogleSignIn, type CustomerSignInResult } from '@shared/auth/signInCustomer'
import { auth } from '@shared/firebase/config'
import type { Lang } from '@shared/i18n/translations'

// Prepared, not yet wired to a button. The web's signInWithPopup has no
// React Native equivalent, and Google sign-in can't run inside Expo Go. To
// enable it:
//   1. npx expo install @react-native-google-signin/google-signin, and add
//      its config plugin to app.json with the iOS URL scheme.
//   2. Create iOS + Android OAuth clients in the same Firebase/Google Cloud
//      project as the web app.
//   3. Build a development client (npx expo run:ios / eas build --profile development).
//   4. Get an ID token from GoogleSignin.signIn() and pass it here.
// Everything after the credential (business rejection, customer doc,
// preferred language) is the same shared code the web /login page runs.
export async function signInWithGoogleIdToken(idToken: string, currentLang: Lang): Promise<CustomerSignInResult> {
  const cred = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken))
  return finishCustomerGoogleSignIn(cred, currentLang)
}
