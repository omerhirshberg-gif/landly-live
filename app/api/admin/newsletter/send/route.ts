import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { validateNewsletterContent } from '@/lib/email/newsletterEmail'
import { MAX_CAMPAIGN_RECIPIENTS, resolveAudience } from '@/lib/newsletter/audience.server'
import { campaignSendMode, createCampaign, hasCampaignInFlight, runAfterResponse, runCampaign } from '@/lib/newsletter/campaigns.server'
import { emailOrigin, jsonError, NO_STORE, parseAudienceFilter, readJson } from '@/lib/newsletter/adminRequest'

// A big list is sent in 100-email batches spaced for Resend's rate limit.
export const maxDuration = 300

// POST /api/admin/newsletter/send {subject, headline, body, ctaLabel, ctaUrl,
// audience: {kind, segment, lang}, expectedCount}: starts a campaign and
// answers at once; the batches go out after the response. expectedCount is the
// number the admin confirmed, so a list that changed since is refused.
export async function POST(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const raw = await readJson(request)
  if (!raw) return jsonError('invalid_body', 400)
  const check = validateNewsletterContent(raw)
  if (!check.ok) return jsonError(check.error, 400)
  const audience = parseAudienceFilter((raw.audience ?? {}) as Record<string, unknown>)

  try {
    const recipients = await resolveAudience(audience)
    if (recipients.length === 0) return jsonError('audience_empty', 400)
    if (recipients.length > MAX_CAMPAIGN_RECIPIENTS) return jsonError('audience_over_cap', 400)
    if (raw.expectedCount !== recipients.length) return NextResponse.json({ error: 'audience_changed', count: recipients.length }, { status: 409, headers: NO_STORE })
    if (await hasCampaignInFlight()) return jsonError('campaign_in_flight', 409)

    const mode = campaignSendMode()
    const campaignId = await createCampaign({ content: check.content, audience, recipientCount: recipients.length, mode })
    const origin = emailOrigin(request)
    runAfterResponse(() => runCampaign({ campaignId, content: check.content, recipients, origin, mode }))
    return NextResponse.json({ ok: true, campaignId, recipientCount: recipients.length, simulated: mode === 'simulated' }, { status: 202, headers: NO_STORE })
  } catch (err) {
    console.error('[newsletter] send failed to start', err instanceof Error ? err.message : err)
    return jsonError('send_failed', 500)
  }
}
