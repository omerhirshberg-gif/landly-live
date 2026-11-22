import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { writeAudit } from '@/lib/admin/auditLog'
import { CipherConfigError } from '@/lib/crypto/fieldCipher'
import { getAdminDb } from '@/lib/firebase/admin'
import { safeErrorText } from '@/lib/inventory/ledger/codes'
import { activateProduct, copyPoolItems, startPoolMigration } from '@/lib/inventory/ledger/migratePools'
import { PaymentError } from '@/lib/payments/paymentValidation'

// Backfills a legacy couponPools stock into the ledger (runbook in lib/inventory/ledger/migratePools.ts).
// POST { poolId, step: 'start' | 'copy' | 'activate', cursor?, dry? }. `copy` returns a cursor: call again until `done`.
export const maxDuration = 120

export async function POST(request: Request) {
  const denied = requireAdminAuth(request)
  if (denied) return denied
  const body = await request.json().catch(() => null)
  if (typeof body?.poolId !== 'string') return NextResponse.json({ error: 'Missing poolId.' }, { status: 400 })
  const dry = body.dry === true
  try {
    const db = getAdminDb()
    let result: unknown
    if (body.step === 'start') result = await startPoolMigration(db, body.poolId, dry)
    else if (body.step === 'copy') result = await copyPoolItems(db, body.poolId, Number.isInteger(body.cursor) ? body.cursor : 0, dry)
    else if (body.step === 'activate' && !dry) { await activateProduct(db, body.poolId); result = { active: true } }
    else return NextResponse.json({ error: 'Unknown step.' }, { status: 400 })
    if (!dry) await writeAudit(db, request, { action: `inventory.migrate.${body.step}`, targetType: 'pool', targetId: body.poolId, after: result })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof PaymentError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof CipherConfigError) return NextResponse.json({ error: 'Code encryption key is not configured on the server.' }, { status: 503 })
    console.error('Pool migration failed', safeErrorText(error))
    return NextResponse.json({ error: 'The migration step failed.' }, { status: 500 })
  }
}
