import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { writeAudit } from '@/lib/admin/auditLog'
import { revalidateGuestHome } from '@/lib/admin/revalidateHome'
import { getAdminDb } from '@/lib/firebase/admin'
import { CipherConfigError } from '@/lib/crypto/fieldCipher'
import { commitSmartImport, loadMultipassPerks, matchPerks, type PerkDecision } from '@/lib/inventory/smartImport'
import { parseSmartSheet } from '@/lib/inventory/smartSheet'

const MAX_MATRIX_ROWS = 3000

// One endpoint for a Multipass vendor sheet (perks and codes together), in two steps so nothing is
// written by surprise:
//   mode "plan":   re-reads the sheet and says which perks are new, which restock an existing one
//                  and which are ambiguous. Nothing is written.
//   mode "commit": applies the admin's decisions, perk by perk. Each perk is all-or-nothing; one failing
//                  never undoes another. Only counts reach the audit log, never a code.
// The browser sends the sheet's cells and every rule is re-checked here.
export async function POST(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const body = await request.json().catch(() => null)
  const matrix: unknown = body?.matrix
  if (!Array.isArray(matrix) || matrix.length === 0 || matrix.length > MAX_MATRIX_ROWS || matrix.some((r) => !Array.isArray(r))) {
    return NextResponse.json({ error: 'Send the sheet as a list of rows.' }, { status: 400 })
  }
  const sheet = parseSmartSheet(matrix as unknown[][])
  if (!sheet.headerFound) return NextResponse.json({ error: 'No code column was found in the file.' }, { status: 400 })

  const db = getAdminDb()
  const existing = await loadMultipassPerks(db)
  if (body.mode !== 'commit') {
    return NextResponse.json({
      perks: sheet.perks.map((p) => ({ key: p.key, title: p.title, brand: p.brand, category: p.category, retailPrice: p.retailPrice, memberPrice: p.memberPrice, unitCost: p.unitCost, codes: p.entries.length, expiresFirst: p.entries.map((e) => e.expiresAt).filter(Boolean).sort()[0] ?? null })),
      plan: matchPerks(sheet.perks, existing),
      problems: sheet.problems, duplicates: sheet.duplicates, badDates: sheet.badDates, hasPerkColumns: sheet.hasPerkColumns, tooMany: sheet.tooMany,
      existing,
    })
  }

  const decisions: PerkDecision[] = Array.isArray(body.decisions)
    ? body.decisions.flatMap((d: Record<string, unknown>) => (typeof d?.key === 'string' && (d.action === 'create' || d.action === 'restock')
      ? [{ key: d.key, action: d.action, offerId: typeof d.offerId === 'string' ? d.offerId : undefined, retailPrice: Number(d.retailPrice) || undefined, memberPrice: Number(d.memberPrice) || undefined, unitCost: d.unitCost === '' || d.unitCost == null ? undefined : Number(d.unitCost), category: typeof d.category === 'string' ? d.category : undefined } as PerkDecision]
      : []))
    : []
  if (decisions.length === 0) return NextResponse.json({ error: 'Nothing to import.' }, { status: 400 })
  try {
    const results = await commitSmartImport(db, sheet.perks, decisions, existing)
    let created = 0, restocked = 0, failed = 0, added = 0
    let firstOffer = ''
    for (const r of results) {
      if (r.status === 'failed') { failed++; continue }
      if (r.status === 'created') created++
      else restocked++
      added += r.counts.added
      firstOffer ||= r.offerId
    }
    if (created + restocked > 0) {
      revalidateGuestHome()
      await writeAudit(db, request, { action: 'multipass.smartImport', targetType: 'batch', targetId: firstOffer, after: { created, restocked, failed, added, source: 'sheet' } })
    }
    return NextResponse.json({ results, created, restocked, failed, added })
  } catch (err) {
    if (err instanceof CipherConfigError) return NextResponse.json({ error: 'Code encryption key is not configured on the server.' }, { status: 503 })
    console.error('Smart import failed', err)
    return NextResponse.json({ error: 'The import failed.' }, { status: 500 })
  }
}
