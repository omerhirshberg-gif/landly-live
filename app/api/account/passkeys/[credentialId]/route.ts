import { NextResponse } from 'next/server'
import { requireVerifiedCustomerUid, RequestAuthError } from '@/lib/firebase/verifyRequestUser'
import { deletePasskey, isCredentialId } from '@/lib/auth/webauthn/passkeys'
import { checkUidRateLimit } from '@/lib/auth/uidRateLimit'

// Removes one of the member's passkeys (Settings > Passkeys > Remove). The
// copy on the member's device stays in their password manager until they
// delete it there; this server just stops accepting it.
export async function DELETE(request: Request, ctx: RouteContext<'/api/account/passkeys/[credentialId]'>) {
  let uid: string
  try {
    uid = await requireVerifiedCustomerUid(request)
  } catch (err) {
    if (err instanceof RequestAuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    throw err
  }
  if (checkUidRateLimit('passkeys', uid)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

  const { credentialId } = await ctx.params
  if (!isCredentialId(credentialId)) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  try {
    if (!(await deletePasskey(uid, credentialId))) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[passkey] delete failed', err)
    return NextResponse.json({ error: 'passkey_failed' }, { status: 503 })
  }
}
