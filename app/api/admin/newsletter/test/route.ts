import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { buildNewsletterMessage, sendNewsletterTest, validateNewsletterContent } from '@/lib/email/newsletterEmail'
import { EmailProviderError } from '@/lib/email/brandedEmail'
import { isDeliverableEmail } from '@/lib/newsletter/audience.server'
import { emailOrigin, jsonError, NO_STORE, readJson } from '@/lib/newsletter/adminRequest'
import { newsletterLang } from '@/lib/newsletter/unsubscribeCopy'
import { recordUsage } from '@/lib/usage/recordUsage'

// POST /api/admin/newsletter/test {to, subject, headline, body, ctaLabel, ctaUrl, lang}:
// one real email to the address the admin typed, so the campaign can be read
// in an inbox before it goes out. Without RESEND_API_KEY nothing is sent.
export async function POST(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const raw = await readJson(request)
  if (!raw) return jsonError('invalid_body', 400)
  const check = validateNewsletterContent(raw)
  if (!check.ok) return jsonError(check.error, 400)
  const to = typeof raw.to === 'string' ? raw.to.trim().toLowerCase() : ''
  if (!isDeliverableEmail(to)) return jsonError('test_email_invalid', 400)

  if (!process.env.RESEND_API_KEY) {
    recordUsage('resend.simulated')
    return NextResponse.json({ ok: true, simulated: true }, { headers: NO_STORE })
  }
  try {
    await sendNewsletterTest(buildNewsletterMessage(check.content, { email: to, firstName: 'Test', lang: newsletterLang(raw.lang) }, emailOrigin(request)))
  } catch (err) {
    if (err instanceof EmailProviderError) {
      console.error('[newsletter] test send rejected', err.code)
      return NextResponse.json({ error: 'provider_error', code: err.code, message: err.message }, { status: 502, headers: NO_STORE })
    }
    console.error('[newsletter] test send failed', err instanceof Error ? err.message : err)
    return jsonError('send_failed', 500)
  }
  return NextResponse.json({ ok: true, simulated: false }, { headers: NO_STORE })
}
