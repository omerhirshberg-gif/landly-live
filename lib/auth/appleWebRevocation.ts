import { OAuthProvider, reauthenticateWithPopup, revokeAccessToken, type User } from 'firebase/auth'
import { confirmAndRevokeWithPopup, type AppleDeletionConfirmation } from '@/lib/account/appleRevocation'
import { appleProviderIn } from '@/lib/auth/oauthWebSignIn'
import { auth } from '@/lib/firebase/config'
import type { Lang } from '@/lib/i18n/translations'

/**
 * The website's Apple confirmation on the deletion form: Apple's popup (in
 * the member's language) for the signed-in account, then Firebase revokes
 * the fresh access token. Called first thing in the submit handler, so the
 * popup opens on the member's tap. A different Apple ID fails as
 * auth/user-mismatch and nothing is revoked.
 */
export function confirmAndRevokeAppleOnWeb(user: User, lang: Lang): Promise<AppleDeletionConfirmation> {
  return confirmAndRevokeWithPopup({
    reauthenticate: () => reauthenticateWithPopup(user, appleProviderIn(lang)),
    accessTokenOf: (result) => OAuthProvider.credentialFromResult(result)?.accessToken,
    revoke: (accessToken) => revokeAccessToken(auth, accessToken),
  })
}
