import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { writeAudit } from '@/lib/admin/auditLog'
import { getAdminDb } from '@/lib/firebase/admin'
import { safeErrorText } from '@/lib/inventory/ledger/codes'
import { cancelVoucher, confirmSupplierVoid, voidVoucher } from '@/lib/inventory/ledger/operations'
import { PaymentError } from '@/lib/payments/paymentValidation'

// POST { action: 'cancel' | 'void' | 'restock', reason }: the admin-only manual transitions. Every one needs a reason, which is
// stored with the actor on its ledger event. `cancel` is open for 14 days from the purchase and only for an untouched voucher, after
// the supplier balance was checked; the voucher does NOT return to stock until `restock` records that the supplier confirmed the void.
// The voucher is named by its ledger id (a code hash); no response or log ever carries the code.
export async function POST(request: Request, { params }: { params: Promise<{ voucherId: string }> }) {
  const denied = requireAdminAuth(request)
  if (denied) return denied
  const { voucherId } = await params
  const body = await request.json().catch(() => null)
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
  if (!reason) return NextResponse.json({ error: 'Give a reason.' }, { status: 400 })
  try {
    const db = getAdminDb()
    if (body.action === 'cancel') await cancelVoucher(db, voucherId, 'admin', reason)
    else if (body.action === 'void') await voidVoucher(db, voucherId, 'admin', reason)
    else if (body.action === 'restock') await confirmSupplierVoid(db, voucherId, 'admin', reason)
    else return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
    await writeAudit(db, request, { action: `inventory.voucher.${body.action}`, targetType: 'inventoryVoucher', targetId: voucherId, note: reason })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof PaymentError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Voucher action failed', safeErrorText(error))
    return NextResponse.json({ error: 'Could not complete the action.' }, { status: 500 })
  }
}
