import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { writeAudit } from '@/lib/admin/auditLog'
import { getAdminDb } from '@/lib/firebase/admin'
import { createInvite, emailInvite } from '@/lib/merchants/invites'
import { MAX_BATCH_ROWS, parseInviteInput, type InviteInput } from '@/lib/merchants/inviteInput'

// Batch onboarding in two steps so nothing is created by surprise:
//   mode "validate": per-row problems, nothing written.
//   mode "create":   every valid row gets an invite (invalid rows are returned, not created);
//                    the response carries each link once, as the database keeps only hashes.
export async function POST(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const body = await request.json().catch(() => null)
  if (!body || !Array.isArray(body.rows) || body.rows.length === 0 || body.rows.length > MAX_BATCH_ROWS) {
    return NextResponse.json({ error: `Send between 1 and ${MAX_BATCH_ROWS} rows.` }, { status: 400 })
  }
  type Result = { ok: true; value: InviteInput } | { ok: false; errors: string[] }
  const parsed: { row: number; result: Result }[] = (body.rows as unknown[]).map((row, i) => ({
    row: i + 1,
    result: row && typeof row === 'object' && !Array.isArray(row) ? parseInviteInput(row as Record<string, unknown>) : { ok: false, errors: ['Not a merchant record.'] },
  }))
  const seen = new Map<string, number>()
  for (const p of parsed) {
    if (!p.result.ok) continue
    const key = p.result.value.contactEmail
    if (seen.has(key)) p.result = { ok: false, errors: [`Duplicate of row ${seen.get(key)} (same contact email).`] }
    else seen.set(key, p.row)
  }
  type Row = { row: number; ok: true; businessName: string; contactEmail: string } | { row: number; ok: false; errors: string[] }
  const rows: Row[] = parsed.map((p) => (p.result.ok ? { row: p.row, ok: true, businessName: p.result.value.businessName, contactEmail: p.result.value.contactEmail } : { row: p.row, ok: false, errors: p.result.errors }))
  if (body.mode !== 'create') return NextResponse.json({ rows, valid: rows.filter((r) => r.ok).length, invalid: rows.filter((r) => !r.ok).length })

  const db = getAdminDb()
  const batchRef = db.collection('merchantInviteBatches').doc()
  const created: { row: number; businessName: string; contactEmail: string; link: string; whatsappHref: string | null; emailed: boolean | null; error?: string }[] = []
  for (const p of parsed) {
    if (!p.result.ok) continue
    try {
      const invite = await createInvite(db, request, p.result.value, batchRef.id)
      const email = body.sendEmail === true ? await emailInvite(p.result.value, invite.link) : null
      created.push({ row: p.row, businessName: p.result.value.businessName, contactEmail: p.result.value.contactEmail, link: invite.link, whatsappHref: invite.whatsappHref, emailed: email ? email.sent : null })
    } catch (err) {
      console.error('Batch invite failed', err)
      rows[p.row - 1] = { row: p.row, ok: false, errors: [err instanceof Error && err.message.includes('does not exist') ? err.message : 'Could not create this invite.'] }
    }
  }
  await batchRef.set({ total: parsed.length, created: created.length, createdAt: Timestamp.now() })
  await writeAudit(db, request, { action: 'merchantInvite.batch', targetType: 'batch', targetId: batchRef.id, after: { total: parsed.length, created: created.length } })
  return NextResponse.json({ batchId: batchRef.id, created, failed: rows.filter((r) => !r.ok) })
}
