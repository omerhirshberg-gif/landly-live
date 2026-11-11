import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { cipherKeyConfigured } from '@/lib/crypto/fieldCipher'
import { masavConfig } from '@/lib/finance/masavGenerator'
import { payoutFileStore } from '@/lib/finance/payoutStorage'
import { PAYOUTS, SettlementError, assertValueDate, createPayoutBatch, previewSettlement } from '@/lib/finance/settlement'
import { getAdminDb } from '@/lib/firebase/admin'

const iso = (v: unknown) => (v instanceof Timestamp ? v.toDate().toISOString() : null)

function configOrError() {
  try { return { config: masavConfig() } } catch (err) { return { error: err instanceof Error ? err.message : 'Invalid MASAV configuration.' } }
}

export async function GET(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const { config, error } = configOrError()
  const snap = await getAdminDb().collection(PAYOUTS).get()
  return NextResponse.json({
    // The mock flag drives the page's test-mode badge; the code is shown so the admin sees exactly what the file will carry.
    masav: config ? { institutionCode: config.institutionCode, sendingCode: config.sendingCode, isMock: config.isMock } : null,
    masavError: error ?? null,
    encryptionConfigured: cipherKeyConfigured('BUSINESS_FINANCIALS_KEY'),
    batches: snap.docs.map((d) => ({
      id: d.id, status: d.get('status'), valueDate: d.get('valueDate'), voucherCount: d.get('voucherCount'), merchantCount: d.get('merchantCount'),
      totalAgorot: d.get('totalAgorot'), mock: !!d.get('mock'), fileName: d.get('fileName') ?? null, createdAt: iso(d.get('createdAt')),
    })).sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
  })
}

// {action: 'preview', valueDate} writes nothing; {action: 'create', valueDate} locks the vouchers and generates the file.
export async function POST(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const body = await request.json().catch(() => null)
  try {
    assertValueDate(body?.valueDate)
    const db = getAdminDb()
    if (body.action === 'preview') return NextResponse.json(await previewSettlement(db, body.valueDate))
    if (body.action === 'create') return NextResponse.json(await createPayoutBatch(db, payoutFileStore, request, body.valueDate))
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (err) {
    if (err instanceof SettlementError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('Payout request failed', err)
    return NextResponse.json({ error: 'The payout could not be completed. Nothing was paid.' }, { status: 500 })
  }
}
