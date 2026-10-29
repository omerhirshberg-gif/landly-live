import { Platform } from 'react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import * as Crypto from 'expo-crypto'
import { OAuthProvider, reauthenticateWithCredential, type User } from 'firebase/auth'
import { confirmationFailure, revokeAppleAuthorizationCode, type AppleDeletionConfirmation } from '@shared/account/appleRevocation'
import { auth } from '@shared/firebase/config'
import type { Lang } from '@shared/i18n/translations'

// The app's Apple confirmation on the deletion form (the browser build,
// appleRevocation.web.ts, uses the popup). iOS: Apple's system sheet once
// more, the result confirmed as this same account (a different Apple ID
// fails as auth/user-mismatch and nothing is revoked), then its
// authorization code is revoked through Firebase
// (lib/account/appleRevocation.ts). Android has no Apple sheet: the request
// goes out marked 'unavailable', and the member is told how to remove
// Landly in their Apple ID settings.

function randomNonce(): string {
  return Array.from(Crypto.getRandomBytes(32), (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function confirmAndRevokeApple(user: User, _lang: Lang): Promise<AppleDeletionConfirmation> {
  if (Platform.OS !== 'ios' || !(await AppleAuthentication.isAvailableAsync().catch(() => false))) {
    return { status: 'done', appleRevocation: 'unavailable' }
  }
  const rawNonce = randomNonce()
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce)
  let apple: AppleAuthentication.AppleAuthenticationCredential
  try {
    // No scopes: only the account is confirmed, nothing is asked for again.
    apple = await AppleAuthentication.signInAsync({ requestedScopes: [], nonce: hashedNonce })
  } catch (err) {
    if ((err as { code?: unknown } | null)?.code === 'ERR_REQUEST_CANCELED') return { status: 'cancelled' }
    return { status: 'done', appleRevocation: 'failed' }
  }
  if (!apple.identityToken || !apple.authorizationCode) return { status: 'done', appleRevocation: 'failed' }
  try {
    // Only a code from this member's own Apple ID is revoked.
    await reauthenticateWithCredential(user, new OAuthProvider('apple.com').credential({ idToken: apple.identityToken, rawNonce }))
  } catch (err) {
    return confirmationFailure(err)
  }
  const apiKey = auth.app.options.apiKey
  if (!apiKey) return { status: 'done', appleRevocation: 'failed' }
  const revoked = await revokeAppleAuthorizationCode({
    apiKey,
    idToken: await user.getIdToken(),
    authorizationCode: apple.authorizationCode,
  })
  return { status: 'done', appleRevocation: revoked ? 'revoked' : 'failed' }
}
