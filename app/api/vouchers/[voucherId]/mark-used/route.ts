import { NextResponse } from 'next/server'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { corsHeaders } from '@/lib/auth/cors'
import { checkUidRateLimit } from '@/lib/auth/uidRateLimit'
import { getAdminDb } from '@/lib/firebase/admin'
import { RequestAuthError, requireVerifiedCustomerUid } from '@/lib/firebase/verifyRequestUser'
import { parseVoucherStatus } from '@/lib/vouchers/status'
import { isVoucherId } from '@/lib/wallet/passVoucher'
import { selfReportRedeemed } from '@/lib/inventory/ledger/operations'

// POST (Bearer ID token): the member says they have used a code-only voucher (Raayonit), which no
// merchant scans, so nothing else can tell. Self-reported: the voucher becomes 'redeemed' (and
// leaves the active list) but is never settled, because only direct-merchant vouchers are paid out
// (lib/finance/settlement.ts). Anything that isn't the caller's own active code-only voucher is a 404/409.
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
  const ref = getAdminDb().collection('vouchers').doc(voucherId)
  try {
    let inventoryVoucherId: string | null = null
    const outcome = await getAdminDb().runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const data = snap.data()
      // Missing and foreign read alike.
      if (!data || data.userId !== uid) return 'notFound' as const
      if (data.redemptionKind !== 'code_only') return 'notEligible' as const
      if (parseVoucherStatus(data.status) !== 'active') return 'notEligible' as const
      inventoryVoucherId = typeof data.inventoryVoucherId === 'string' ? data.inventoryVoucherId : null
      tx.update(ref, { status: 'redeemed', redeemedAt: Timestamp.now(), selfReportedUse: true, updatedAt: FieldValue.serverTimestamp() })
      return 'ok' as const
    })
    if (outcome === 'notFound') return reply({ error: 'Voucher not found.' }, 404)
    if (outcome === 'notEligible') return reply({ error: 'This voucher can\'t be marked as used.' }, 409)
    // The ledger copy of the code is redeemed through the same single transition function (a no-op for a voucher from before the ledger).
    if (inventoryVoucherId) await selfReportRedeemed(getAdminDb(), inventoryVoucherId, voucherId).catch(() => undefined)
    return reply({ ok: true })
  } catch (error) {
    console.error('Mark voucher used failed', error instanceof Error ? error.message : 'unknown error')
    return reply({ error: 'Service unavailable.' }, 503)
  }
}
