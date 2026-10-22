import { NextResponse } from 'next/server'
import { verifyAuthenticationResponse, type AuthenticationResponseJSON } from '@simplewebauthn/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'
import { webAuthnConfig } from '@/lib/auth/webauthn/config'
import { consumeChallenge } from '@/lib/auth/webauthn/challenges'
import { getPasskey, isCredentialId, recordPasskeyUse } from '@/lib/auth/webauthn/passkeys'
import { isPasskeyRateLimited } from '@/lib/auth/passkeyRateLimit'

// Step 2 of signing in with a passkey: verifies the signed challenge with the
// saved public key and answers with a Firebase custom token for that member,
// which the website exchanges with signInWithCustomToken. The same customer
// rules as every other sign-in apply before a token is minted: no business
// accounts, no disabled or unverified ones. `unknown_credential` lets the
// browser drop a passkey this server no longer has (signalUnknownCredential).
export async function POST(request: Request) {
  if (isPasskeyRateLimited('verify', request)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  const config = webAuthnConfig()
  if (!config) return NextResponse.json({ error: 'passkeys_unavailable' }, { status: 503 })

  const body = await request.json().catch(() => null)
  const response = body?.response as AuthenticationResponseJSON | undefined
  if (!response || typeof response !== 'object' || !isCredentialId(response.id)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  try {
    const expectedChallenge = await consumeChallenge(body.challengeId, 'login')
    if (!expectedChallenge) return NextResponse.json({ error: 'challenge_expired' }, { status: 400 })

    const passkey = await getPasskey(response.id)
    if (!passkey) return NextResponse.json({ error: 'unknown_credential', rpId: config.rpID }, { status: 404 })
    // A discoverable credential always returns the handle it was created under.
    const userHandle = response.response?.userHandle
    if (userHandle && userHandle !== passkey.webauthnUserId) {
      return NextResponse.json({ error: 'verification_failed' }, { status: 400 })
    }

    let verification
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: config.origins,
        expectedRPID: config.rpID,
        credential: { id: response.id, publicKey: passkey.publicKey, counter: passkey.counter, transports: passkey.transports },
        requireUserVerification: true,
      })
    } catch (err) {
      console.warn('[passkey] sign-in rejected', { uid: passkey.uid, message: (err as Error)?.message })
      return NextResponse.json({ error: 'verification_failed' }, { status: 400 })
    }
    if (!verification.verified) return NextResponse.json({ error: 'verification_failed' }, { status: 400 })

    const { uid } = passkey
    let user
    try {
      user = await getAdminAuth().getUser(uid)
    } catch (err) {
      if ((err as { code?: string })?.code === 'auth/user-not-found') {
        return NextResponse.json({ error: 'unknown_credential', rpId: config.rpID }, { status: 404 })
      }
      throw err
    }
    if (user.disabled) return NextResponse.json({ error: 'account_disabled' }, { status: 403 })
    if ((await getAdminDb().collection('businesses').doc(uid).get()).exists) {
      return NextResponse.json({ error: 'business_account' }, { status: 403 })
    }
    if (!user.emailVerified) return NextResponse.json({ error: 'unverified' }, { status: 403 })

    await recordPasskeyUse(response.id, verification.authenticationInfo.newCounter)
    const customToken = await getAdminAuth().createCustomToken(uid)
    return NextResponse.json({ customToken })
  } catch (err) {
    console.error('[passkey] login-verify failed', err)
    return NextResponse.json({ error: 'passkey_failed' }, { status: 503 })
  }
}
