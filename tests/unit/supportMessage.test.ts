import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ send: vi.fn(), limited: vi.fn(() => false) }))
vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.send } } }))
vi.mock('@/lib/auth/contactFormRateLimit', () => ({ isSupportMessageRateLimited: mocks.limited }))

import { POST } from '@/app/api/support/route'
import { parseSupportMessage } from '@/lib/email/sendSupportMessage'

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('EMAIL_FROM', 'test@landly.test')
  vi.stubEnv('RESEND_API_KEY', 'fake-test-key')
  mocks.send.mockResolvedValue({ error: null })
  mocks.limited.mockReturnValue(false)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

const valid = { name: 'Dana Levi', email: 'dana@example.com', subject: 'billing', message: 'Hello\nI was charged twice.', lang: 'he' }

function post(body: unknown) {
  return POST(new Request('https://landly.test/api/support', { method: 'POST', body: JSON.stringify(body) }))
}

describe('/api/support', () => {
  it('emails the team inbox with Reply-To set to the sender', async () => {
    const res = await post(valid)
    expect(res.status).toBe(200)
    expect(mocks.send).toHaveBeenCalledTimes(1)
    const email = mocks.send.mock.calls[0][0]
    expect(email.to).toBe('contact@golandly.com')
    expect(email.replyTo).toBe('dana@example.com')
    expect(email.from).toBe('test@landly.test')
    expect(email.subject).toBe('[Landly Support] Billing and payments — Dana Levi')
    expect(email.text).toContain('Email: dana@example.com')
    expect(email.text).toContain('I was charged twice.')
  })

  it('escapes HTML and strips header-breaking characters', async () => {
    await post({ ...valid, name: 'Eve\r\nBcc: x@y.z', message: '<script>alert(1)</script>' })
    const email = mocks.send.mock.calls[0][0]
    expect(email.subject).not.toMatch(/[\r\n]/)
    expect(email.html).not.toContain('<script>')
    expect(email.html).toContain('&lt;script&gt;')
  })

  it.each([
    [{ ...valid, email: 'not-an-email' }],
    [{ ...valid, email: 'a@b.c\r\nBcc: x@y.z' }],
    [{ ...valid, name: '   ' }],
    [{ ...valid, message: '' }],
    [{ ...valid, message: 'x'.repeat(5001) }],
    [null],
  ])('rejects invalid input %#', async (body) => {
    expect((await post(body)).status).toBe(400)
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('falls back to the general subject for unknown values', () => {
    expect(parseSupportMessage({ ...valid, subject: 'constructor' })?.subject).toBe('general')
  })

  it('drops honeypot submissions without sending', async () => {
    expect((await post({ ...valid, website: 'spam.example' })).status).toBe(200)
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('returns 429 when rate limited', async () => {
    mocks.limited.mockReturnValue(true)
    expect((await post(valid)).status).toBe(429)
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('returns 502 when the provider rejects or email is not configured', async () => {
    mocks.send.mockResolvedValue({ error: { name: 'validation_error', statusCode: 422, message: 'bad' } })
    expect((await post(valid)).status).toBe(502)
    vi.stubEnv('RESEND_API_KEY', '')
    expect((await post(valid)).status).toBe(502)
  })
})
