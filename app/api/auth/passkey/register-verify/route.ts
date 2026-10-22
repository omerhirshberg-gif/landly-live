import { after, NextResponse } from 'next/server'
import { verifyRegistrationResponse, type RegistrationResponseJSON } from '@simplewebauthn/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'
import { requireVerifiedCustomer, RequestAuthError } from '@/lib/firebase/verifyRequestUser'
import { webAuthnConfig } from '@/lib/auth/webauthn/config'
import { consumeChallenge } from '@/lib/auth/webauthn/challenges'
import { createPasskey, ensureWebAuthnUserId, summarize } from '@/lib/auth/webauthn/passkeys'
import { passkeyName } from '@/lib/auth/webauthn/passkeyNames'
import { isRecentSignIn } from '@/lib/auth/webauthn/recentSignIn'
import { checkUidRateLimit } from '@/lib/auth/uidRateLimit'
import { applicationOrigin, isValidLang } from '@/lib/auth/requestContext'
import { sendPasskeyAddedEmail } from '@/lib/email/sendPasskeyAddedEmail'

// Step 2 of adding a passkey: checks the authenticator's answer against the
// challenge issued to this member in step 1 (consumed here, so it verifies
// once), then saves the credential (passkeys/{id}). The member gets a
// "passkey added" email after the response is sent; a failed email is
// logged and never undoes the passkey.
export async function POST(request: Request) {
  const config = webAuthnConfig()
  if (!config) return NextResponse.json({ error: 'passkeys_unavailable' }, { status: 503 })

  let decoded
  try {
    decoded = await requireVerifiedCustomer(request)
  } catch (err) {
    if (err instanceof RequestAuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    throw err
  }
  const uid = decoded.uid
  if (checkUidRateLimit('passkeys', uid)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  if (!isRecentSignIn(decoded.auth_time)) return NextResponse.json({ error: 'reauth_required' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const response = body?.response as RegistrationResponseJSON | undefined
  if (!response || typeof response !== 'object' || typeof response.id !== 'string') {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  try {
    const expectedChallenge = await consumeChallenge(body.challengeId, 'register', uid)
    if (!expectedChallenge) return NextResponse.json({ error: 'challenge_expired' }, { status: 400 })

    let verification
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: config.origins,
        expectedRPID: config.rpID,
        requireUserVerification: true,
      })
    } catch (err) {
      console.warn('[passkey] registration rejected', { uid, message: (err as Error)?.message })
      return NextResponse.json({ error: 'verification_failed' }, { status: 400 })
    }
    if (!verification.verified) return NextResponse.json({ error: 'verification_failed' }, { status: 400 })

    const { credential, credentialDeviceType, credentialBackedUp, aaguid } = verification.registrationInfo
    const webauthnUserId = await ensureWebAuthnUserId(uid)
    if (!webauthnUserId) return NextResponse.json({ error: 'profile_missing' }, { status: 409 })
    const name = passkeyName(aaguid, request.headers.get('user-agent'))
    const record = {
      uid,
      webauthnUserId,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: credential.transports ?? response.response.transports ?? [],
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      aaguid,
      name,
    }
    let createdAt
    try {
      ;({ createdAt } = await createPasskey(credential.id, record))
    } catch (err) {
      if ((err as { code?: unknown })?.code === 6) return NextResponse.json({ error: 'already_registered' }, { status: 409 })
      throw err
    }

    after(async () => {
      try {
        const [user, profile] = await Promise.all([
          getAdminAuth().getUser(uid),
          getAdminDb().collection('users').doc(uid).get(),
        ])
        if (!user.email) return
        const preferred = profile.get('preferredLanguage')
        await sendPasskeyAddedEmail({
          to: user.email,
          lang: isValidLang(preferred) ? preferred : 'en',
          origin: applicationOrigin(),
          passkeyName: name,
        })
      } catch (err) {
        console.error('[passkey] added-email failed', { uid, message: (err as Error)?.message })
      }
    })

    return NextResponse.json({ passkey: summarize(credential.id, { ...record, createdAt, lastUsedAt: null }) })
  } catch (err) {
    console.error('[passkey] register-verify failed', err)
    return NextResponse.json({ error: 'passkey_failed' }, { status: 503 })
  }
}
