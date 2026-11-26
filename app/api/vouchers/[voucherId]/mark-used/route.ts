import { NextResponse } from 'next/server'
import { corsHeaders } from '@/lib/auth/cors'
import { checkUidRateLimit } from '@/lib/auth/uidRateLimit'
import { getAdminDb } from '@/lib/firebase/admin'
import { RequestAuthError, requireVerifiedCustomerUid } from '@/lib/firebase/verifyRequestUser'
import { isVoucherId } from '@/lib/wallet/passVoucher'
import { markWalletVoucherUsed } from '@/lib/inventory/ledger/operations'

// POST (Bearer ID token): the member says they have used a code-only voucher (Raayonit), which no
// merchant scans, so nothing else can tell. Self-reported: the voucher becomes 'redeemed' (and
// leaves the active list) but is never settled, because only direct-merchant vouchers are paid out
// (lib/finance/settlement.ts). Anything that isn't the caller's own active code-only voucher is a 404/409; one past its expiry is a 410.
type Params = { params: Promise<{ voucherId: string }> }
const METHODS = 'POST, OPTIONS'

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request, METHODS) })
}

export async function POST(request: Request, { params }: Params) {
  const headers = corsHeaders(request, METHODS)
  const reply = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers })
  let uid: string
  try {
    uid = await requireVerifiedCustomerUid(request)
  } catch (error) {
    if (error instanceof RequestAuthError) return reply({ error: error.message }, error.status)
    return reply({ error: 'Authorization service unavailable.' }, 503)
  }
  if (await checkUidRateLimit('wallet', uid)) return reply({ error: 'Too many requests.' }, 429)

  const { voucherId } = await params
  if (!isVoucherId(voucherId)) return reply({ error: 'Voucher not found.' }, 404)
  try {
    // One transaction: the wallet voucher and its ledger copy change together or not at all (lib/inventory/ledger/operations.ts).
    const outcome = await markWalletVoucherUsed(getAdminDb(), uid, voucherId)
    if (outcome === 'notFound') return reply({ error: 'Voucher not found.' }, 404)
    if (outcome === 'expired') return reply({ error: 'This voucher has expired.' }, 410)
    if (outcome === 'notEligible') return reply({ error: 'This voucher can\'t be marked as used.' }, 409)
    return reply({ ok: true })
  } catch (error) {
    console.error('Mark voucher used failed', error instanceof Error ? error.message : 'unknown error')
    return reply({ error: 'Service unavailable.' }, 503)
  }
}
