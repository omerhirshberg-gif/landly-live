import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { writeAudit } from '@/lib/admin/auditLog'
import { revalidateGuestHome } from '@/lib/admin/revalidateHome'
import { getAdminDb } from '@/lib/firebase/admin'
import { revalidatePublicOffers } from '@/lib/firebase/offersCache.server'
import { isRaayonitDisplayEnabled } from '@/lib/flags/featureFlags.server'
import { approveBusinessChange, dismissBusinessChange } from '@/lib/inventory/ledger/businessChangeApproval'
import { safeErrorText } from '@/lib/inventory/ledger/codes'
import { isTranslationEnabled, cloudTranslator } from '@/lib/translate/cloudTranslate'
import { PaymentError } from '@/lib/payments/paymentValidation'

// POST { action: 'approve' | 'dismiss', id }: the manual step between the 04:00 sync's recorded changes and the live storefront.
// Approving is refused while the Raayonit display flag is off.
export async function POST(request: Request) {
  const denied = requireAdminAuth(request)
  if (denied) return denied
  const body = await request.json().catch(() => null)
  if (typeof body?.id !== 'string' || !body.id) return NextResponse.json({ error: 'Missing change.' }, { status: 400 })
  try {
    const db = getAdminDb()
    if (body.action === 'dismiss') {
      await dismissBusinessChange(db, body.id, 'admin')
      await writeAudit(db, request, { action: 'inventory.change.dismiss', targetType: 'businessChange', targetId: body.id })
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'approve') {
      const translateBatch = isTranslationEnabled() ? async (texts: string[], lang: string) => cloudTranslator.translate(texts, lang, 'he') : undefined
      const result = await approveBusinessChange(db, body.id, 'admin', await isRaayonitDisplayEnabled(), { origin: new URL(request.url).origin, translateBatch })
      await writeAudit(db, request, { action: 'inventory.change.approve', targetType: 'businessChange', targetId: body.id, after: result })
      revalidatePublicOffers()
      revalidateGuestHome()
      return NextResponse.json(result)
    }
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (error) {
    if (error instanceof PaymentError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Business change failed', safeErrorText(error))
    return NextResponse.json({ error: 'Could not apply the change.' }, { status: 500 })
  }
}
