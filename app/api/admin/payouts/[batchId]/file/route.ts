import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { writeAudit } from '@/lib/admin/auditLog'
import { masavConfig } from '@/lib/finance/masavGenerator'
import { payoutFileStore } from '@/lib/finance/payoutStorage'
import { PAYOUTS } from '@/lib/finance/settlement'
import { getAdminDb } from '@/lib/firebase/admin'
import { isDocumentId } from '@/lib/payments/paymentValidation'

// Streams the stored MASAV file; never regenerated, so what's downloaded is what was locked.
// Air-gap guard: a batch built with the fictitious institution code is always
// downloaded under a MASAV_MOCK_TEST_ name. That name is also stamped when the
// batch is created; it is enforced here again in case the deployment's code was
// removed or a mock file's name was ever stored differently.
export async function GET(request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const { batchId } = await params
  if (!isDocumentId(batchId)) return NextResponse.json({ error: 'Invalid batch.' }, { status: 400 })
  const db = getAdminDb()
  const b = (await db.collection(PAYOUTS).doc(batchId).get()).data()
  if (!b || !b.filePath || (b.status !== 'file_generated' && b.status !== 'paid')) return NextResponse.json({ error: 'No file for this batch.' }, { status: 404 })
  const bytes = await payoutFileStore.read(b.filePath)
  let mock = !!b.mock
  try { mock = mock || masavConfig().isMock } catch { /* an invalid config is shown on the page */ }
  const name = mock && !String(b.fileName).startsWith('MASAV_MOCK_TEST_') ? `MASAV_MOCK_TEST_${String(b.fileName)}` : String(b.fileName)
  await writeAudit(db, request, { action: 'payout.download', targetType: 'payoutBatch', targetId: batchId, note: name })
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'text/plain; charset=windows-1255',
      'Content-Disposition': `attachment; filename="${name.replace(/[^A-Za-z0-9._-]/g, '_')}"`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    },
  })
}
