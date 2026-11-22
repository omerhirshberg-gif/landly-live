import { NextResponse } from 'next/server'
import { corsHeaders } from '@/lib/auth/cors'
import { clientIp } from '@/lib/auth/clientIp'
import { isDurablyLimited } from '@/lib/auth/durableRateLimit.server'
import { checkUidRateLimit } from '@/lib/auth/uidRateLimit'
import { getAdminDb } from '@/lib/firebase/admin'
import { RequestAuthError, requireVerifiedCustomerUid } from '@/lib/firebase/verifyRequestUser'
import { trackSupplierCall } from '@/lib/inventory/ledger/alerts'
import { decryptVoucherCode, safeErrorText } from '@/lib/inventory/ledger/codes'
import { VOUCHERS_COLLECTION } from '@/lib/inventory/ledger/types'
import { getSupplierAdapter } from '@/lib/inventory/suppliers'
import { SupplierNotConfiguredError, SupplierUnsupportedError } from '@/lib/inventory/suppliers/SupplierAdapter'
import { isVoucherId } from '@/lib/wallet/passVoucher'

// POST (Bearer ID token): the balance left on the member's OWN voucher. It takes the wallet voucher id, never a code, so a stranger
// cannot probe codes through it; a missing and a foreign voucher both answer 404. Two durable budgets guard it: per member and per IP
// (the IP one stops one address cycling through many accounts). Raayonit has no balance API, so its answer is our own ledger;
// Multipass is asked live. The response never contains the code.
type Params = { params: Promise<{ voucherId: string }> }
const METHODS = 'POST, OPTIONS'
const IP_BUDGET = { scope: 'balance_ip', max: 30, windowMs: 60_000 } as const

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request, METHODS) })
}

export async function POST(request: Request, { params }: Params) {
  const headers = corsHeaders(request, METHODS)
  const reply = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers })
  if (await isDurablyLimited({ ...IP_BUDGET, key: clientIp(request) })) return reply({ error: 'Too many requests. Try again later.' }, 429)
  let uid: string
  try {
    uid = await requireVerifiedCustomerUid(request)
  } catch (error) {
    if (error instanceof RequestAuthError) return reply({ error: error.message }, error.status)
    return reply({ error: 'Authorization service unavailable.' }, 503)
  }
  const limited = await checkUidRateLimit('balance', uid)
  if (limited) {
    for (const [name, value] of Object.entries(headers)) limited.headers.set(name, value)
    return limited
  }
  const { voucherId } = await params
  if (!isVoucherId(voucherId)) return reply({ error: 'Voucher not found.' }, 404)
  const db = getAdminDb()
  try {
    const wallet = (await db.collection('vouchers').doc(voucherId).get()).data()
    if (!wallet || wallet.userId !== uid || typeof wallet.inventoryVoucherId !== 'string') return reply({ error: 'Voucher not found.' }, 404)
    const snap = await db.collection(VOUCHERS_COLLECTION).doc(wallet.inventoryVoucherId).get()
    const v = snap.data()
    if (!v) return reply({ error: 'Voucher not found.' }, 404)
    let balanceAgorot: number = v.balanceAgorot
    let source: 'ledger' | 'supplier' = 'ledger'
    if (v.supplierId === 'multipass' && v.status !== 'REDEEMED') {
      try {
        const adapter = getSupplierAdapter('multipass')
        const out = await trackSupplierCall(db, 'multipass', () => adapter.checkBalance({ supplierRef: v.supplierRef ?? undefined, code: decryptVoucherCode(v.codeEncrypted, snap.id) }))
        if (out.balanceAgorot !== null) { balanceAgorot = out.balanceAgorot; source = out.source }
      } catch (error) {
        // Not switched on (or down): the ledger's figure still answers.
        if (!(error instanceof SupplierNotConfiguredError || error instanceof SupplierUnsupportedError)) console.error('Balance check failed', safeErrorText(error))
      }
    }
    return reply({ balanceAgorot, faceValueAgorot: v.faceValueAgorot, status: v.status, source })
  } catch (error) {
    console.error('Voucher balance failed', safeErrorText(error))
    return reply({ error: 'Service unavailable.' }, 503)
  }
}
