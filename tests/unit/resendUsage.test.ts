import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ send: vi.fn(), batch: vi.fn(), usage: vi.fn() }))
vi.mock('resend', () => ({ Resend: class { emails = { send: m.send }; batch = { send: m.batch } } }))
vi.mock('@/lib/usage/recordUsage', () => ({ recordUsage: m.usage }))

import { getResend, sendBrandedEmail } from '@/lib/email/brandedEmail'

beforeEach(() => {
  m.send.mockReset().mockResolvedValue({ data: { id: 'e1' }, error: null })
  m.batch.mockReset().mockResolvedValue({ data: {}, error: null })
  m.usage.mockReset()
  vi.stubEnv('RESEND_API_KEY', 're_x')
  vi.stubEnv('EMAIL_FROM', 'GoLandly <noreply@golandly.com>')
})

describe('Resend usage counting', () => {
  it('counts one email for each accepted single send, whoever sends it', async () => {
    await getResend().emails.send({ from: 'a', to: 'b@c.co', subject: 's', html: 'h' })
    await sendBrandedEmail({ to: 'b@c.co', lang: 'en', origin: 'https://golandly.com', subject: 's', heading: 'h', body: 'b', footnote: 'f' })
    expect(m.usage.mock.calls).toEqual([['resend.emailsSent'], ['resend.emailsSent']])
  })

  it('counts a batch by its size', async () => {
    await getResend().batch.send(Array.from({ length: 37 }, () => ({ from: 'a', to: 'b@c.co', subject: 's', html: 'h' })))
    expect(m.usage.mock.calls).toEqual([['resend.emailsSent', 37]])
  })

  it('counts nothing when Resend rejects the send', async () => {
    m.send.mockResolvedValueOnce({ data: null, error: { name: 'validation_error', message: 'x', statusCode: 422 } })
    m.batch.mockResolvedValueOnce({ data: null, error: { name: 'rate_limit_exceeded', message: 'x', statusCode: 429 } })
    await getResend().emails.send({ from: 'a', to: 'b@c.co', subject: 's', html: 'h' })
    await getResend().batch.send([{ from: 'a', to: 'b@c.co', subject: 's', html: 'h' }])
    expect(m.usage).not.toHaveBeenCalled()
  })
})
