import { beforeEach, describe, expect, it, vi } from 'vitest'

const resend = vi.hoisted(() => ({ batchSend: vi.fn(), send: vi.fn() }))
vi.mock('resend', () => ({
  Resend: class {
    batch = { send: resend.batchSend }
    emails = { send: resend.send }
  },
}))

import {
  buildNewsletterMessage,
  personalizePlain,
  renderNewsletterEmail,
  safeHttpsUrl,
  sendNewsletterBatch,
  textDirection,
  validateNewsletterContent,
} from '@/lib/email/newsletterEmail'
import { verifyUnsubscribeToken } from '@/lib/newsletter/unsubscribeToken'

const content = { subject: 'Hi {firstName}', headline: 'Big news', body: 'Hello {firstName},\nline two\n\nSecond <b>paragraph</b>', ctaLabel: 'Open', ctaUrl: 'https://golandly.com/offers' }

beforeEach(() => {
  process.env.UNSUBSCRIBE_SECRET = 'secret'
  resend.batchSend.mockReset()
  resend.send.mockReset()
})

describe('content validation', () => {
  it('accepts a complete campaign and normalizes the link', () => {
    const r = validateNewsletterContent({ ...content, ctaUrl: ' https://golandly.com/x ' })
    expect(r.ok && r.content.ctaUrl).toBe('https://golandly.com/x')
  })
  it('requires subject and body, and a button label and link together', () => {
    expect(validateNewsletterContent({ ...content, subject: '' })).toEqual({ ok: false, error: 'subject_required' })
    expect(validateNewsletterContent({ ...content, body: ' ' })).toEqual({ ok: false, error: 'body_required' })
    expect(validateNewsletterContent({ ...content, ctaUrl: '' })).toEqual({ ok: false, error: 'cta_incomplete' })
  })
  it('only allows https links', () => {
    for (const bad of ['http://x.co', 'javascript:alert(1)', 'https://u:p@x.co', 'https://localhost', 'x.co']) expect(safeHttpsUrl(bad)).toBeNull()
    expect(validateNewsletterContent({ ...content, ctaUrl: 'javascript:alert(1)' })).toEqual({ ok: false, error: 'cta_url_invalid' })
  })
  it('rejects a subject with a line break (header injection)', () => {
    expect(validateNewsletterContent({ ...content, subject: 'a\nBcc: x@y.co' })).toEqual({ ok: false, error: 'subject_invalid' })
  })
})

describe('personalization', () => {
  it('fills the name, and drops the token cleanly without one', () => {
    expect(personalizePlain('Hi {firstName},', 'Dana')).toBe('Hi Dana,')
    expect(personalizePlain('Hi {firstName},', '')).toBe('Hi,')
    expect(personalizePlain('{firstName}, welcome', ' ')).toBe('welcome')
  })
  it('reads direction from the first letter', () => {
    expect(textDirection('123 שלום')).toBe('rtl')
    expect(textDirection('Hello שלום')).toBe('ltr')
  })
})

describe('rendered email', () => {
  const recipient = { email: 'dana@x.co', firstName: 'Dana <i>', lang: 'he' as const }
  it('escapes content, isolates the name in bdi and splits paragraphs', () => {
    const html = renderNewsletterEmail({ content, recipient, origin: 'https://golandly.com' })
    expect(html).toContain('<bdi dir="auto">Dana &lt;i&gt;</bdi>')
    expect(html).toContain('Second &lt;b&gt;paragraph&lt;/b&gt;')
    expect(html).toContain('line two')
    expect(html.match(/<p dir=/g)?.length).toBeGreaterThanOrEqual(2)
    expect(html).toContain('href="https://golandly.com/offers"')
  })
  it('has a localized legal footer with identity and a verifiable unsubscribe link', () => {
    const html = renderNewsletterEmail({ content, recipient, origin: 'https://golandly.com' })
    expect(html).toContain('תל אביב, ישראל')
    expect(html).toContain('contact@golandly.com')
    const token = new URL(html.match(/href="([^"]*\/unsubscribe[^"]*)"/)![1]!.replace(/&amp;/g, '&')).searchParams.get('token')
    expect(verifyUnsubscribeToken(token)).toBe('dana@x.co')
  })
  it('omits the button when there is no link', () => {
    expect(renderNewsletterEmail({ content: { ...content, ctaLabel: '', ctaUrl: '' }, recipient, origin: 'https://golandly.com' })).not.toContain('v:roundrect')
  })
})

describe('message and sending', () => {
  it('builds RFC 8058 headers, a reply-to and a plain-text part', () => {
    const m = buildNewsletterMessage(content, { email: 'a@x.co', firstName: '', lang: 'en' }, 'https://golandly.com')
    expect(m.from).toBe('GoLandly <news@golandly.com>')
    expect(m.replyTo).toBe('contact@golandly.com')
    expect(m.subject).toBe('Hi')
    expect(m.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
    expect(m.headers['List-Unsubscribe']).toMatch(/^<https:\/\/golandly\.com\/api\/newsletter\/unsubscribe\?token=.+>, <mailto:contact@golandly\.com/)
    expect(m.text).toContain('Unsubscribe:')
  })
  it('retries rate limits with growing waits, then gives up on other errors', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined)
    resend.batchSend
      .mockResolvedValueOnce({ error: { name: 'rate_limit_exceeded', message: 'slow', statusCode: 429 } })
      .mockResolvedValueOnce({ error: { name: 'rate_limit_exceeded', message: 'slow', statusCode: 429 } })
      .mockResolvedValueOnce({ data: {}, error: null })
    const messages = [buildNewsletterMessage(content, { email: 'a@x.co', firstName: '', lang: 'en' }, 'https://golandly.com')]
    expect(await sendNewsletterBatch(messages, sleep)).toEqual({ sent: 1, failed: 0, error: null })
    expect(sleep.mock.calls).toEqual([[1000], [2000]])

    resend.batchSend.mockResolvedValueOnce({ error: { name: 'validation_error', message: 'domain not verified', statusCode: 403 } })
    expect(await sendNewsletterBatch(messages, sleep)).toEqual({ sent: 0, failed: 1, error: 'validation_error: domain not verified' })
  })
})
