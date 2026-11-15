import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { getAdminDb, getAdminProjectId } from '@/lib/firebase/admin'
import { isQuotaChannel } from '@/lib/usage/quota'
import { topUpQuota } from '@/lib/usage/quota.server'

// POST /api/admin/usage/topup { channel: 'sms' | 'whatsapp', from }: the
// admin bought another package at 019, so that channel's quota grows by
// 1,000 (the amount is fixed here, never taken from the request). `from` is
// the quota the page showed: if the stored one differs (a double click,
// another admin) nothing is added and the answer is 409 with the current
// quota. Same session and same-origin checks as every /api/admin/* route.
export async function POST(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError

  const body = await request.json().catch(() => null)
  if (!isQuotaChannel(body?.channel) || !Number.isInteger(body?.from) || body.from < 1) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  try {
    const projectId = getAdminProjectId()
    const result = await topUpQuota(getAdminDb(), request, projectId, body.channel, body.from)
    if (result.ok) return NextResponse.json({ channel: body.channel, quota: result.quota }, { headers: { 'Cache-Control': 'no-store' } })
    if (result.reason === 'stale') return NextResponse.json({ error: 'The quota changed.', quota: result.quota }, { status: 409 })
    console.error(`[usage] the quota document names another project than ${projectId}`)
    return NextResponse.json({ error: 'This quota belongs to another project.' }, { status: 409 })
  } catch (error) {
    console.error('Quota top-up failed', error)
    return NextResponse.json({ error: 'The quota could not be updated right now.' }, { status: 502 })
  }
}
