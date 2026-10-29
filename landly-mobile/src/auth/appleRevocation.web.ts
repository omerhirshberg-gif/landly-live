import * as firebaseAuth from 'firebase/auth'
import type * as BrowserAuth from '@firebase/auth/dist/auth-public'
import type { User } from 'firebase/auth'
import { confirmAndRevokeWithPopup, type AppleDeletionConfirmation } from '@shared/account/appleRevocation'
import { appleProvider, auth } from '@shared/firebase/config'
import type { Lang } from '@shared/i18n/translations'

// tsconfig types firebase/auth as its React Native build, which has no
// popup or revokeAccessToken; in the browser, Metro bundles the browser build, which does.
const { OAuthProvider, reauthenticateWithPopup, revokeAccessToken } = firebaseAuth as unknown as typeof BrowserAuth

// Browser build (Metro picks this over appleRevocation.ts for web): the same
// Apple popup and Firebase revocation as the website's deletion form.
export function confirmAndRevokeApple(user: User, _lang: Lang): Promise<AppleDeletionConfirmation> {
  return confirmAndRevokeWithPopup({
    reauthenticate: () => reauthenticateWithPopup(user, appleProvider),
    accessTokenOf: (result) => OAuthProvider.credentialFromResult(result)?.accessToken,
    revoke: (accessToken) => revokeAccessToken(auth, accessToken),
  })
}
