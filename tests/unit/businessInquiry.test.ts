import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ send: vi.fn(), limited: vi.fn(() => false) }))
vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.send } } }))
vi.mock('@/lib/auth/contactFormRateLimit', () => ({ isBusinessInquiryRateLimited: mocks.limited }))

import { POST } from '@/app/api/business/inquiry/route'
import { parseBusinessInquiry } from '@/lib/email/sendBusinessInquiry'

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('EMAIL_FROM', 'test@landly.test')
  vi.stubEnv('RESEND_API_KEY', 'fake-test-key')
  mocks.send.mockResolvedValue({ error: null })
  mocks.limited.mockReturnValue(false)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

const valid = {
  businessName: 'Café Yafo', contactName: 'Avi Cohen', email: 'avi@cafeyafo.co.il',
  phone: '+972 50-123-4567', category: 'Restaurants and Cafes', message: 'We would like to offer 10% off.',
}

function post(body: unknown) {
  return POST(new Request('https://landly.test/api/business/inquiry', { method: 'POST', body: JSON.stringify(body) }))
}

describe('/api/business/inquiry', () => {
  it('emails the team inbox with Reply-To set to the lead', async () => {
    expect((await post(valid)).status).toBe(200)
    expect(mocks.send).toHaveBeenCalledTimes(1)
    const email = mocks.send.mock.calls[0][0]
    expect(email.to).toBe('contact@golandly.com')
    expect(email.replyTo).toBe('avi@cafeyafo.co.il')
    expect(email.subject).toBe('[Landly Business Lead] Café Yafo — Avi Cohen')
    for (const value of ['Café Yafo', 'Avi Cohen', 'avi@cafeyafo.co.il', '+972 50-123-4567', 'Restaurants and Cafes', '10% off']) {
      expect(email.text).toContain(value)
      expect(email.html).toContain(value)
    }
    expect(email.html).toContain('href="tel:+972501234567"')
  })

  it('accepts a missing message and category', async () => {
    expect((await post({ ...valid, message: '', category: '' })).status).toBe(200)
    expect(mocks.send.mock.calls[0][0].text).toContain('Category: Not specified')
  })

  it('escapes HTML and keeps the subject on one line', async () => {
    await post({ ...valid, businessName: 'Evil\r\nBcc: x@y.z', message: '<img src=x onerror=alert(1)>' })
    const email = mocks.send.mock.calls[0][0]
    expect(email.subject).not.toMatch(/[\r\n]/)
    expect(email.html).not.toContain('<img src=x')
  })

  it('drops categories outside the list', () => {
    expect(parseBusinessInquiry({ ...valid, category: '<b>Spam</b>' })?.category).toBe('')
  })

  it.each([
    [{ ...valid, businessName: '' }],
    [{ ...valid, contactName: ' ' }],
    [{ ...valid, email: 'nope' }],
    [{ ...valid, phone: '123' }],
    [{ ...valid, phone: 'call me maybe' }],
    [{ ...valid, businessName: 'x'.repeat(121) }],
    [{ ...valid, message: 'x'.repeat(3001) }],
    [null],
  ])('rejects invalid input %#', async (body) => {
    expect((await post(body)).status).toBe(400)
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('drops honeypot submissions without sending', async () => {
    expect((await post({ ...valid, website: 'x' })).status).toBe(200)
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('returns 429 when rate limited and 502 when sending fails', async () => {
    mocks.limited.mockReturnValueOnce(true)
    expect((await post(valid)).status).toBe(429)
    mocks.send.mockResolvedValue({ error: { name: 'validation_error', statusCode: 422, message: 'bad' } })
    expect((await post(valid)).status).toBe(502)
  })
})
