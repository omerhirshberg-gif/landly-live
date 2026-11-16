import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { getAdminProjectId } from '@/lib/firebase/admin'
import { jsonError, NO_STORE, readJson } from '@/lib/newsletter/adminRequest'
import { isSuppressionHash, listSuppressions, restoreSuppression, suppressEmail } from '@/lib/newsletter/suppressions.server'
import { usageEnvOf } from '@/lib/usage/usageTypes'

// /admin/newsletter's suppression list. Read through getAdminDb, so
// Production sees PROD and local and Preview see DEV.
//   GET                     the suppressed addresses (admin ones and recorded opt-outs)
//   POST   {email}          keep this address out of every campaign
//   DELETE ?hash=<40 hex>   lift an admin suppression; a recipient's own opt-out is never lifted
export async function GET(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  try {
    return NextResponse.json({ suppressions: await listSuppressions(), env: usageEnvOf(getAdminProjectId()) }, { headers: NO_STORE })
  } catch (err) {
    console.error('[newsletter] suppressions list failed', err instanceof Error ? err.message : err)
    return jsonError('suppressions_failed', 500)
  }
}

export async function POST(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const body = await readJson(request)
  if (!body) return jsonError('invalid_body', 400)
  try {
    const result = await suppressEmail(body.email)
    if (result === 'invalid_email') return jsonError('invalid_email', 400)
    if (result === 'unsubscribed') return jsonError('already_unsubscribed', 409)
    return NextResponse.json({ ok: true }, { headers: NO_STORE })
  } catch (err) {
    console.error('[newsletter] suppress failed', err instanceof Error ? err.message : err)
    return jsonError('suppress_failed', 500)
  }
}

export async function DELETE(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const hash = new URL(request.url).searchParams.get('hash')
  if (!isSuppressionHash(hash)) return jsonError('invalid_hash', 400)
  try {
    const result = await restoreSuppression(hash)
    if (result === 'not_found') return jsonError('not_found', 404)
    if (result === 'unsubscribed') return jsonError('already_unsubscribed', 409)
    return NextResponse.json({ ok: true }, { headers: NO_STORE })
  } catch (err) {
    console.error('[newsletter] restore failed', err instanceof Error ? err.message : err)
    return jsonError('restore_failed', 500)
  }
}
