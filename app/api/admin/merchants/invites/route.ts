import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { getAdminDb } from '@/lib/firebase/admin'
import { createInvite, emailInvite, INVITE_COLLECTION } from '@/lib/merchants/invites'
import { parseInviteInput } from '@/lib/merchants/inviteInput'

const iso = (v: unknown) => (v instanceof Timestamp ? v.toDate().toISOString() : null)

export async function GET(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const db = getAdminDb()
  const [invites, businesses] = await Promise.all([db.collection(INVITE_COLLECTION).get(), db.collection('businesses').select('businessName', 'commissionRate', 'paymentTerms', 'onboardingStatus').get()])
  const now = Date.now()
  return NextResponse.json({
    invites: invites.docs.map((d) => {
      const x = d.data()
      const expired = (x.status === 'pending' || x.status === 'opened') && x.expiresAt instanceof Timestamp && x.expiresAt.toMillis() < now
      return {
        id: d.id, businessName: x.businessName, contactEmail: x.contactEmail, commissionRate: x.commissionRate, paymentTerms: x.paymentTerms,
        status: expired ? 'expired' : x.status, createdAt: iso(x.createdAt), expiresAt: iso(x.expiresAt), completedAt: iso(x.completedAt), batchId: x.batchId ?? null,
      }
    }).sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
    businesses: businesses.docs.map((d) => ({
      id: d.id, name: d.get('businessName') ?? '', hasTerms: d.get('commissionRate') != null && !!d.get('paymentTerms'), onboarded: d.get('onboardingStatus') === 'active',
    })).sort((a, b) => a.name.localeCompare(b.name)),
  })
}

export async function POST(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  const parsed = parseInviteInput(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.errors[0], errors: parsed.errors }, { status: 400 })
  try {
    const created = await createInvite(getAdminDb(), request, parsed.value)
    // The link exists only in this response (the database keeps just its hash).
    const email = body.sendEmail === true ? await emailInvite(parsed.value, created.link) : null
    return NextResponse.json({ link: created.link, message: created.message, whatsappHref: created.whatsappHref, expiresAt: created.expiresAt.toISOString(), email })
  } catch (err) {
    console.error('Invite creation failed', err)
    return NextResponse.json({ error: err instanceof Error && err.message.includes('does not exist') ? err.message : 'Could not create the invite.' }, { status: 500 })
  }
}
