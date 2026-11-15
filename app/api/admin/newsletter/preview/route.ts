import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { renderNewsletterEmail, safeHttpsUrl, textDirection, BODY_MAX, HEADLINE_MAX, SUBJECT_MAX, CTA_LABEL_MAX, personalizePlain } from '@/lib/email/newsletterEmail'
import { emailOrigin, jsonError, NO_STORE, readJson } from '@/lib/newsletter/adminRequest'
import { newsletterLang } from '@/lib/newsletter/unsubscribeCopy'

// POST /api/admin/newsletter/preview: the exact HTML a recipient gets, built
// by the sender's own renderer, from whatever has been typed so far (nothing
// is required, nothing is stored or sent).
export async function POST(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const raw = await readJson(request)
  if (!raw) return jsonError('invalid_body', 400)
  const text = (key: string, max: number) => (typeof raw[key] === 'string' ? (raw[key] as string).replace(/\r\n?/g, '\n').trim().slice(0, max) : '')
  const ctaUrl = safeHttpsUrl(text('ctaUrl', 2000))
  const ctaLabel = text('ctaLabel', CTA_LABEL_MAX)
  const content = {
    subject: text('subject', SUBJECT_MAX),
    headline: text('headline', HEADLINE_MAX),
    body: text('body', BODY_MAX),
    ctaLabel: ctaUrl ? ctaLabel : '',
    ctaUrl: ctaUrl && ctaLabel ? ctaUrl : '',
  }
  const lang = newsletterLang(raw.lang)
  const sampleName = textDirection(`${content.headline} ${content.body}`) === 'rtl' ? 'דנה' : 'Dana'
  const origin = emailOrigin(request)
  const html = renderNewsletterEmail({
    content,
    recipient: { email: 'preview@example.com', firstName: sampleName, lang },
    origin,
    unsubscribeUrl: `${origin}/unsubscribe`,
  })
  return NextResponse.json({ html, subject: personalizePlain(content.subject, sampleName) }, { headers: NO_STORE })
}
