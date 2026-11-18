import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { writeAudit } from '@/lib/admin/auditLog'
import { getAdminDb } from '@/lib/firebase/admin'
import { CipherConfigError } from '@/lib/crypto/fieldCipher'
import { addPoolEntries } from '@/lib/inventory/poolAdmin'
import { validateSheetEntry } from '@/lib/inventory/parseCodeSheet'
import { POOL_COLLECTION } from '@/lib/inventory/types'
import { PaymentError, isDocumentId } from '@/lib/payments/paymentValidation'

const MAX_CODES_PER_REQUEST = 2000

// Adds Raayonit voucher codes to a stock: `rows` read from Raayonit's two-column sheet in the admin's
// browser (code and amount), re-checked here: the browser's parse is never trusted. A row whose
// amount is not the stock's face value is refused, so a 150 voucher can never be sold as a 100.
// The codes are encrypted before they are stored, and only counts go to the audit log.
export async function POST(request: Request, { params }: { params: Promise<{ poolId: string }> }) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const { poolId } = await params
  if (!isDocumentId(poolId)) return NextResponse.json({ error: 'Invalid stock.' }, { status: 400 })
  const body = await request.json().catch(() => null)
  if (!Array.isArray(body?.rows)) return NextResponse.json({ error: 'Send the sheet rows.' }, { status: 400 })
  if (body.rows.length > MAX_CODES_PER_REQUEST) return NextResponse.json({ error: `At most ${MAX_CODES_PER_REQUEST} codes per upload.` }, { status: 400 })
  try {
    const db = getAdminDb()
    const poolSnap = await db.collection(POOL_COLLECTION).doc(poolId).get()
    if (!poolSnap.exists) return NextResponse.json({ error: 'Voucher stock not found.' }, { status: 404 })
    const faceValue = poolSnap.get('faceValueAgorot')
    const checked = body.rows.map(validateSheetEntry)
    const valid = checked.flatMap((row: ReturnType<typeof validateSheetEntry>) => (row ? [row] : []))
    const matching = valid.filter((row: { amount: number }) => !Number.isInteger(faceValue) || row.amount * 100 === faceValue)
    const result = await addPoolEntries(db, poolId, matching.map((row: { code: string }) => ({ code: row.code })))
    const wrongAmount = valid.length - matching.length
    result.invalid += checked.length - valid.length
    await writeAudit(db, request, { action: 'pool.addCodes', targetType: 'pool', targetId: poolId, after: { ...result, wrongAmount, source: 'sheet' } })
    return NextResponse.json({ ...result, wrongAmount })
  } catch (err) {
    if (err instanceof PaymentError) return NextResponse.json({ error: err.message }, { status: err.status })
    if (err instanceof CipherConfigError) return NextResponse.json({ error: 'Code encryption key is not configured on the server.' }, { status: 503 })
    console.error('Voucher code upload failed', err)
    return NextResponse.json({ error: 'Could not store the codes.' }, { status: 500 })
  }
}
