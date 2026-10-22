import { NextResponse } from 'next/server'
import { generateRegistrationOptions } from '@simplewebauthn/server'
import { getAdminAuth } from '@/lib/firebase/admin'
import { requireVerifiedCustomer, RequestAuthError } from '@/lib/firebase/verifyRequestUser'
import { webAuthnConfig } from '@/lib/auth/webauthn/config'
import { saveChallenge } from '@/lib/auth/webauthn/challenges'
import { ensureWebAuthnUserId, listPasskeys } from '@/lib/auth/webauthn/passkeys'
import { isRecentSignIn } from '@/lib/auth/webauthn/recentSignIn'
import { checkUidRateLimit } from '@/lib/auth/uidRateLimit'

// Step 1 of adding a passkey (Settings > Privacy & Security > Passkeys): the
// creation options for a discoverable, user-verified credential, with the
// member's existing passkeys excluded so a device that already holds one
// says so instead of making a second. Needs a verified customer who signed
// in within the last 10 minutes; older sessions get `reauth_required` and
// the website asks for the password (or Google) again first.
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
  if (checkUidRateLimit('passkeys', decoded.uid)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  if (!isRecentSignIn(decoded.auth_time)) return NextResponse.json({ error: 'reauth_required' }, { status: 403 })

  try {
    const webauthnUserId = await ensureWebAuthnUserId(decoded.uid)
    if (!webauthnUserId) return NextResponse.json({ error: 'profile_missing' }, { status: 409 })
    const [user, existing] = await Promise.all([getAdminAuth().getUser(decoded.uid), listPasskeys(decoded.uid)])
    const optionsJSON = await generateRegistrationOptions({
      rpName: config.rpName,
      rpID: config.rpID,
      userName: user.email ?? decoded.uid,
      userID: new Uint8Array(Buffer.from(webauthnUserId, 'base64url')),
      userDisplayName: user.displayName ?? user.email ?? '',
      attestationType: 'none',
      excludeCredentials: existing.map(({ id, record }) => ({ id, transports: record.transports })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    })
    const challengeId = await saveChallenge(optionsJSON.challenge, 'register', decoded.uid)
    return NextResponse.json({ challengeId, optionsJSON })
  } catch (err) {
    console.error('[passkey] register-options failed', err)
    return NextResponse.json({ error: 'passkey_failed' }, { status: 503 })
  }
}
