import { NextResponse } from 'next/server'
import { requireVerifiedCustomerUid, RequestAuthError } from '@/lib/firebase/verifyRequestUser'
import { listPasskeys, summarize } from '@/lib/auth/webauthn/passkeys'
import { webAuthnConfig } from '@/lib/auth/webauthn/config'
import { checkUidRateLimit } from '@/lib/auth/uidRateLimit'

// The member's passkeys for Settings > Privacy & Security (names and dates
// only, never the keys). `available: false` when this deployment has no
// WebAuthn relying party configured, so the card hides itself.
export async function GET(request: Request) {
  let uid: string
  try {
    uid = await requireVerifiedCustomerUid(request)
  } catch (err) {
    if (err instanceof RequestAuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    throw err
  }
  if (checkUidRateLimit('passkeys', uid)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  if (!webAuthnConfig()) return NextResponse.json({ available: false, passkeys: [] })

  try {
    const passkeys = (await listPasskeys(uid)).map(({ id, record }) => summarize(id, record))
    return NextResponse.json({ available: true, passkeys })
  } catch (err) {
    console.error('[passkey] list failed', err)
    return NextResponse.json({ error: 'passkey_failed' }, { status: 503 })
  }
}
