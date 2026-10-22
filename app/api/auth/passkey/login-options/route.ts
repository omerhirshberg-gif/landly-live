import { NextResponse } from 'next/server'
import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { webAuthnConfig } from '@/lib/auth/webauthn/config'
import { saveChallenge } from '@/lib/auth/webauthn/challenges'
import { isPasskeyRateLimited } from '@/lib/auth/passkeyRateLimit'

// Step 1 of signing in with a passkey, from the button or the email field's
// autofill on /login. No account is named: the allow-list is empty, so the
// browser offers whichever Landly passkeys the device holds (discoverable
// credentials), and nothing here reveals whether an email has an account.
export async function POST(request: Request) {
  if (isPasskeyRateLimited('options', request)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  const config = webAuthnConfig()
  if (!config) return NextResponse.json({ error: 'passkeys_unavailable' }, { status: 503 })

  try {
    const optionsJSON = await generateAuthenticationOptions({ rpID: config.rpID, userVerification: 'required' })
    const challengeId = await saveChallenge(optionsJSON.challenge, 'login')
    return NextResponse.json({ challengeId, optionsJSON })
  } catch (err) {
    console.error('[passkey] login-options failed', err)
    return NextResponse.json({ error: 'passkey_failed' }, { status: 503 })
  }
}
