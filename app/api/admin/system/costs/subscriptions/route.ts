import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { getAdminDb, getAdminProjectId } from '@/lib/firebase/admin'
import { parseSubscriptionsInput } from '@/lib/usage/fixedSubscriptions'
import { saveFixedSubscriptions } from '@/lib/usage/fixedSubscriptions.server'

// PUT /api/admin/system/costs/subscriptions { items: [{ id, label, amount,
// currency: 'USD' | 'ILS', active }] }: the flat monthly plan fees (Vercel
// Pro today) in system_config/fixed_subscriptions of this deployment's own
// Firebase project, replacing the list. Vercel Pro can be switched off but not
// removed. Same session and same-origin checks as every /api/admin/* route;
// the change is audited. Tranzila's rates are code constants, not editable here.
export async function PUT(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError

  const body = await request.json().catch(() => null)
  const parsed = parseSubscriptionsInput(body?.items)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  try {
    const projectId = getAdminProjectId()
    const result = await saveFixedSubscriptions(getAdminDb(), request, projectId, parsed.items)
    if (!result.ok) {
      console.error(`[usage] the fixed subscriptions document names another project than ${projectId}`)
      return NextResponse.json({ error: 'These subscriptions belong to another project.' }, { status: 409 })
    }
    return NextResponse.json({ items: parsed.items }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Saving the fixed subscriptions failed', error)
    return NextResponse.json({ error: 'The subscriptions could not be saved right now.' }, { status: 502 })
  }
}
