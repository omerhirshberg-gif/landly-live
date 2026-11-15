import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { MAX_CAMPAIGN_RECIPIENTS, resolveAudience, subscriberRows } from '@/lib/newsletter/audience.server'
import { getAdminProjectId } from '@/lib/firebase/admin'
import { usageEnvOf } from '@/lib/usage/usageTypes'
import { campaignSendMode } from '@/lib/newsletter/campaigns.server'
import { jsonError, NO_STORE, parseAudienceFilter } from '@/lib/newsletter/adminRequest'

// GET /api/admin/newsletter/audience?kind=&segment=&lang=[&includeList=true]: how many people a
// campaign to this audience would reach, by the same rules the sender uses;
// includeList also names them (the admin's subscriber list), and `env` says which
// Firebase project the list comes from so an empty DEV list can be explained.
export async function GET(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const params = new URL(request.url).searchParams
  const filter = parseAudienceFilter({ kind: params.get('kind'), segment: params.get('segment'), lang: params.get('lang') })
  try {
    const recipients = await resolveAudience(filter)
    return NextResponse.json(
      {
        filter,
        count: recipients.length,
        cap: MAX_CAMPAIGN_RECIPIENTS,
        overCap: recipients.length > MAX_CAMPAIGN_RECIPIENTS,
        mode: campaignSendMode(),
        env: usageEnvOf(getAdminProjectId()),
        ...(params.get('includeList') === 'true' ? { list: subscriberRows(recipients) } : {}),
      },
      { headers: NO_STORE }
    )
  } catch (err) {
    console.error('[newsletter] audience count failed', err instanceof Error ? err.message : err)
    return jsonError('audience_failed', 500)
  }
}
