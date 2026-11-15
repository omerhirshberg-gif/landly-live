import 'server-only'
import { SUPPORT_EMAIL } from '@/lib/config'
import { createUnsubscribeToken } from '@/lib/newsletter/unsubscribeToken'
import { newsletterLang, UNSUBSCRIBE_COPY, type NewsletterLang } from '@/lib/newsletter/unsubscribeCopy'
import { EMAIL_LOGO_URL, EmailProviderError, escapeHtml, FONT_STACK, getResend } from './brandedEmail'

// Marketing newsletters sent from news@golandly.com through Resend: one
// branded shell (logo header, headline, paragraphs, optional button) and a
// legal footer with the business identity and a signed one-click unsubscribe
// link, localized per recipient. The campaign text is written in one
// language by the admin; its reading direction follows its own first strong
// character, the footer follows the recipient's language.

export const DEFAULT_NEWSLETTER_FROM = 'GoLandly <news@golandly.com>'
export const SUBJECT_MAX = 150
export const HEADLINE_MAX = 150
export const BODY_MAX = 10_000
export const CTA_LABEL_MAX = 40

export interface NewsletterContent {
  subject: string
  headline: string
  body: string
  ctaLabel: string
  ctaUrl: string
}

export interface NewsletterMessageRecipient {
  email: string
  firstName: string
  lang: NewsletterLang
}

export type ContentCheck = { ok: true; content: NewsletterContent } | { ok: false; error: string }

/** Only absolute https URLs without credentials may be a button target. */
export function safeHttpsUrl(value: string): string | null {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' && !url.username && !url.password && url.hostname.includes('.') ? url.toString() : null
  } catch {
    return null
  }
}

export function validateNewsletterContent(input: unknown): ContentCheck {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const text = (key: string) => (typeof raw[key] === 'string' ? (raw[key] as string).replace(/\r\n?/g, '\n').trim() : '')
  const content: NewsletterContent = {
    subject: text('subject'),
    headline: text('headline'),
    body: text('body'),
    ctaLabel: text('ctaLabel'),
    ctaUrl: text('ctaUrl'),
  }
  if (!content.subject) return { ok: false, error: 'subject_required' }
  if (content.subject.length > SUBJECT_MAX || /[\r\n]/.test(content.subject)) return { ok: false, error: 'subject_invalid' }
  if (content.headline.length > HEADLINE_MAX) return { ok: false, error: 'headline_too_long' }
  if (!content.body) return { ok: false, error: 'body_required' }
  if (content.body.length > BODY_MAX) return { ok: false, error: 'body_too_long' }
  if (!!content.ctaLabel !== !!content.ctaUrl) return { ok: false, error: 'cta_incomplete' }
  if (content.ctaLabel.length > CTA_LABEL_MAX) return { ok: false, error: 'cta_label_too_long' }
  if (content.ctaUrl) {
    const url = safeHttpsUrl(content.ctaUrl)
    if (!url) return { ok: false, error: 'cta_url_invalid' }
    content.ctaUrl = url
  }
  return { ok: true, content }
}

/** Fills {firstName} as plain text; with no name the token and its leading space go, so "Hi {firstName}," reads "Hi,". */
export function personalizePlain(text: string, firstName: string): string {
  const name = firstName.trim()
  if (name) return text.replace(/\{firstName\}/g, () => name)
  return text.replace(/[ \t]*\{firstName\}/g, '').replace(/^[ \t]*[,،:;!][ \t]*/, '')
}

const RTL_CHAR = /[֐-ࣿיִ-﷿ﹰ-﻿]/
const LTR_CHAR = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ]/

/** The reading direction of `text`: that of its first letter. */
export function textDirection(text: string): 'rtl' | 'ltr' {
  for (const ch of text) {
    if (RTL_CHAR.test(ch)) return 'rtl'
    if (LTR_CHAR.test(ch)) return 'ltr'
  }
  return 'ltr'
}

/** Escaped HTML with {firstName} wrapped in <bdi dir="auto"> (or dropped when there is no name). */
function personalizeHtml(text: string, firstName: string): string {
  const name = firstName.trim()
  if (name) return escapeHtml(text).replace(/\{firstName\}/g, () => `<bdi dir="auto">${escapeHtml(name)}</bdi>`)
  return escapeHtml(personalizePlain(text, ''))
}

function paragraphsHtml(body: string, firstName: string, align: string, dir: string): string {
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p dir="${dir}" style="margin:0 0 16px 0;font-family:${FONT_STACK};font-size:16px;line-height:1.65;color:#475569;text-align:${align};">${personalizeHtml(p, firstName).replace(/\n/g, '<br>')}</p>`
    )
    .join('\n')
}

export function unsubscribeLinks(email: string, lang: NewsletterLang, origin: string): { page: string; oneClick: string } {
  const token = encodeURIComponent(createUnsubscribeToken(email))
  return { page: `${origin}/unsubscribe?token=${token}&lang=${lang}`, oneClick: `${origin}/api/newsletter/unsubscribe?token=${token}` }
}

export function renderNewsletterEmail(params: {
  content: NewsletterContent
  recipient: NewsletterMessageRecipient
  origin: string
  /** Overrides the signed link (the preview has no real recipient). */
  unsubscribeUrl?: string
}): string {
  const { content, recipient, origin } = params
  const lang = recipient.lang
  const copy = UNSUBSCRIBE_COPY[lang]
  const footerRtl = lang === 'he'
  const footerDir = footerRtl ? 'rtl' : 'ltr'
  const footerAlign = footerRtl ? 'right' : 'left'
  const contentDir = textDirection(`${content.headline} ${content.body}`)
  const align = contentDir === 'rtl' ? 'right' : 'left'
  const unsubscribe = escapeHtml(params.unsubscribeUrl ?? unsubscribeLinks(recipient.email, lang, origin).page)
  const subject = personalizePlain(content.subject, recipient.firstName)
  const headline = content.headline ? personalizeHtml(content.headline, recipient.firstName) : ''
  const link = content.ctaUrl ? escapeHtml(content.ctaUrl) : ''
  const label = escapeHtml(content.ctaLabel)
  const year = new Date().getFullYear()

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${contentDir}" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;width:100%;background-color:#F8FAFC;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F8FAFC" style="background-color:#F8FAFC;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="max-width:560px;width:100%;background-color:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;border-collapse:separate;overflow:hidden;">
          <tr>
            <td height="4" bgcolor="#0066FF" style="height:4px;line-height:4px;font-size:4px;background-color:#0066FF;background-image:linear-gradient(90deg,#0066FF,#2563EB);">&nbsp;</td>
          </tr>
          <tr>
            <td align="center" bgcolor="#FFFFFF" style="padding:32px 32px 4px 32px;background-color:#FFFFFF;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" dir="ltr" align="center">
                <tr>
                  <td valign="middle" style="padding-right:12px;"><img src="${escapeHtml(EMAIL_LOGO_URL)}" alt="GoLandly" width="48" height="46" style="display:block;width:48px;height:46px;border:0;outline:none;text-decoration:none;"></td>
                  <td valign="middle" style="font-family:${FONT_STACK};font-size:26px;line-height:30px;font-weight:800;color:#0038B8;letter-spacing:-0.5px;">GoLandly</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td bgcolor="#FFFFFF" dir="${contentDir}" style="padding:28px 40px 4px 40px;background-color:#FFFFFF;text-align:${align};font-family:${FONT_STACK};">${headline ? `
              <h1 dir="${contentDir}" style="margin:0 0 16px 0;font-family:${FONT_STACK};font-size:26px;line-height:34px;font-weight:800;color:#0F172A;letter-spacing:-0.3px;text-align:${align};">${headline}</h1>` : ''}
${paragraphsHtml(content.body, recipient.firstName, align, contentDir)}
            </td>
          </tr>${link ? `
          <tr>
            <td align="center" bgcolor="#FFFFFF" style="padding:12px 40px 8px 40px;background-color:#FFFFFF;">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${link}" style="height:52px;v-text-anchor:middle;width:300px;" arcsize="23%" stroke="f" fillcolor="#0066FF">
                <w:anchorlock/>
                <center style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${label}</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-->
              <a href="${link}" target="_blank" style="display:inline-block;background-color:#0066FF;color:#FFFFFF;font-family:${FONT_STACK};font-size:16px;line-height:20px;font-weight:700;text-decoration:none;padding:16px 36px;border-radius:12px;border:1px solid #0058DD;box-shadow:0 6px 16px rgba(0,102,255,0.22);mso-hide:all;">${label}</a>
              <!--<![endif]-->
            </td>
          </tr>` : ''}
          <tr>
            <td dir="${footerDir}" align="center" bgcolor="#FFFFFF" style="padding:32px 32px 28px 32px;background-color:#FFFFFF;font-family:${FONT_STACK};">
              <div style="border-top:1px solid #E2E8F0;padding-top:22px;text-align:center;">
                <p dir="${footerDir}" style="margin:0 0 8px 0;font-size:12px;line-height:18px;color:#64748B;text-align:center;">${escapeHtml(copy.footerReason)}</p>
                <p dir="${footerDir}" style="margin:0 0 14px 0;font-size:13px;line-height:20px;text-align:center;"><a href="${unsubscribe}" target="_blank" style="color:#2563EB;text-decoration:underline;font-weight:600;">${escapeHtml(copy.footerLink)}</a></p>
                <p dir="${footerDir}" style="margin:0;font-size:12px;line-height:18px;color:#94A3B8;text-align:center;">&copy; ${year} ${escapeHtml(copy.footerIdentity)} · <a href="${escapeHtml(`mailto:${SUPPORT_EMAIL}`)}" dir="ltr" style="color:#94A3B8;text-decoration:none;unicode-bidi:isolate;">${escapeHtml(SUPPORT_EMAIL)}</a></p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function renderNewsletterText(content: NewsletterContent, recipient: NewsletterMessageRecipient, unsubscribeUrl: string): string {
  const copy = UNSUBSCRIBE_COPY[recipient.lang]
  const parts = [
    content.headline && personalizePlain(content.headline, recipient.firstName),
    personalizePlain(content.body, recipient.firstName),
    content.ctaUrl && `${content.ctaLabel}: ${content.ctaUrl}`,
    `--\n${copy.footerIdentity} · ${SUPPORT_EMAIL}\n${copy.footerReason}\n${copy.footerLink}: ${unsubscribeUrl}`,
  ]
  return parts.filter(Boolean).join('\n\n')
}

export interface NewsletterMessage {
  from: string
  to: string
  replyTo: string
  subject: string
  html: string
  text: string
  headers: Record<string, string>
}

export function newsletterFrom(): string {
  return process.env.NEWSLETTER_FROM?.trim() || DEFAULT_NEWSLETTER_FROM
}

/** One recipient's complete message, with RFC 8058 one-click headers. */
export function buildNewsletterMessage(content: NewsletterContent, recipient: NewsletterMessageRecipient, origin: string): NewsletterMessage {
  const links = unsubscribeLinks(recipient.email, recipient.lang, origin)
  return {
    from: newsletterFrom(),
    to: recipient.email,
    replyTo: SUPPORT_EMAIL,
    subject: personalizePlain(content.subject, recipient.firstName),
    html: renderNewsletterEmail({ content, recipient, origin, unsubscribeUrl: links.page }),
    text: renderNewsletterText(content, recipient, links.page),
    headers: {
      'List-Unsubscribe': `<${links.oneClick}>, <mailto:${SUPPORT_EMAIL}?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  }
}

export const BATCH_SIZE = 100
const BATCH_GAP_MS = 600
const RETRY_DELAYS_MS = [1000, 2000, 4000]

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function isRateLimit(error: { name?: string; statusCode?: number | null }): boolean {
  return error.statusCode === 429 || error.name === 'rate_limit_exceeded'
}

export interface BatchOutcome {
  /** Messages Resend accepted in this batch (the whole batch, or none). */
  sent: number
  failed: number
  error: string | null
}

/** One batch of up to 100 messages; rate-limit answers are retried with growing waits, other errors are not. */
export async function sendNewsletterBatch(messages: NewsletterMessage[], sleep: (ms: number) => Promise<void> = defaultSleep): Promise<BatchOutcome> {
  for (let attempt = 0; ; attempt++) {
    const { error } = await getResend().batch.send(messages)
    if (!error) return { sent: messages.length, failed: 0, error: null }
    if (isRateLimit(error) && attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt]!)
      continue
    }
    return { sent: 0, failed: messages.length, error: `${error.name}: ${error.message}` }
  }
}

/** Sends one message (the admin's test email); throws EmailProviderError when Resend rejects it. */
export async function sendNewsletterTest(message: NewsletterMessage): Promise<void> {
  const { error } = await getResend().emails.send(message)
  if (error) throw new EmailProviderError(error.name, error.statusCode, error.message)
}

export { BATCH_GAP_MS, newsletterLang }
