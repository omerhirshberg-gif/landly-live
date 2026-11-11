import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { writeAudit } from '@/lib/admin/auditLog'
import { getAdminDb } from '@/lib/firebase/admin'
import { CipherConfigError } from '@/lib/crypto/fieldCipher'
import { endOfIsraelDay } from '@/lib/admin/expiryDate'
import { addPoolCodes, addPoolEntries } from '@/lib/inventory/poolAdmin'
import { validateSheetEntry } from '@/lib/inventory/parseCodeSheet'
import { PaymentError } from '@/lib/payments/paymentValidation'

const MAX_CODES_PER_REQUEST = 2000

// Upload purchased Multipass codes: one per line, a JSON array, or `rows` read from
// a supplier spreadsheet in the admin's browser (each with its own expiry and PIN, and
// re-checked here: the browser's parse is never trusted). The codes
// are encrypted before they are stored, and only counts go to the audit log.
export async function POST(request: Request, { params }: { params: Promise<{ poolId: string }> }) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const { poolId } = await params
  const body = await request.json().catch(() => null)
  if (Array.isArray(body?.rows)) {
    if (body.rows.length > MAX_CODES_PER_REQUEST) return NextResponse.json({ error: `At most ${MAX_CODES_PER_REQUEST} codes per upload.` }, { status: 400 })
    const checked = body.rows.map(validateSheetEntry)
    const entries = checked.flatMap((row: ReturnType<typeof validateSheetEntry>) => (row ? [{ code: row.code, pin: row.pin, expiresAt: row.expiresAt ? endOfIsraelDay(row.expiresAt) : null }] : []))
    try {
      const db = getAdminDb()
      const result = await addPoolEntries(db, poolId, entries)
      result.invalid += checked.length - entries.length
      await writeAudit(db, request, { action: 'pool.addCodes', targetType: 'pool', targetId: poolId, after: { ...result, source: 'sheet' } })
      return NextResponse.json(result)
    } catch (err) {
      if (err instanceof PaymentError) return NextResponse.json({ error: err.message }, { status: err.status })
      if (err instanceof CipherConfigError) return NextResponse.json({ error: 'Code encryption key is not configured on the server.' }, { status: 503 })
      console.error('Pool sheet upload failed', err)
      return NextResponse.json({ error: 'Could not store the codes.' }, { status: 500 })
    }
  }
  const codes: unknown = Array.isArray(body?.codes) ? body.codes : typeof body?.text === 'string' ? body.text.split(/\r?\n/) : null
  if (!Array.isArray(codes) || codes.some((c) => typeof c !== 'string')) return NextResponse.json({ error: 'Send codes as a list of strings.' }, { status: 400 })
  if (codes.length > MAX_CODES_PER_REQUEST) return NextResponse.json({ error: `At most ${MAX_CODES_PER_REQUEST} codes per upload.` }, { status: 400 })
  let expiresAt: Date | null = null
  if (typeof body.expiresAt === 'string' && body.expiresAt) {
    expiresAt = new Date(`${body.expiresAt}T23:59:59+02:00`)
    if (Number.isNaN(expiresAt.getTime())) return NextResponse.json({ error: 'Invalid expiry date.' }, { status: 400 })
  }
  try {
    const db = getAdminDb()
    const result = await addPoolCodes(db, poolId, codes as string[], expiresAt)
    await writeAudit(db, request, { action: 'pool.addCodes', targetType: 'pool', targetId: poolId, after: result })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof PaymentError) return NextResponse.json({ error: err.message }, { status: err.status })
    if (err instanceof CipherConfigError) return NextResponse.json({ error: 'Code encryption key is not configured on the server.' }, { status: 503 })
    console.error('Pool code upload failed', err)
    return NextResponse.json({ error: 'Could not store the codes.' }, { status: 500 })
  }
}
