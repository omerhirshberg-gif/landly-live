import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { listCampaigns } from '@/lib/newsletter/campaigns.server'
import { jsonError, NO_STORE } from '@/lib/newsletter/adminRequest'

// GET /api/admin/newsletter/campaigns: the 50 latest campaigns, newest first.
export async function GET(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  try {
    return NextResponse.json({ campaigns: await listCampaigns() }, { headers: NO_STORE })
  } catch (err) {
    console.error('[newsletter] history failed', err instanceof Error ? err.message : err)
    return jsonError('history_failed', 500)
  }
}
