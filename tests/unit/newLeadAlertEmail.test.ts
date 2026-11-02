import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.send } } }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminProjectId: () => 'landly-dev' }))

import { newLeadAlertEmail, sendNewLeadAlertEmail } from '@/lib/email/sendNewLeadAlertEmail'
import { buildTeamInboxEmail } from '@/lib/email/teamInboxEmail'
import type { LeadSubmission } from '@/lib/prelaunch/validation'

const LEAD: LeadSubmission = {
  firstName: 'Noa',
  lastName: 'Cohen',
  phone: '+972501234567',
  email: 'noa@example.com',
  lang: 'he',
  preferredLanguage: 'ru',
  persona: 'other',
  personaOtherDescription: 'Here <for> work',
  referralSource: 'tiktok',
  referredBy: null,
  attribution: {} as LeadSubmission['attribution'],
}
const AT = new Date('2026-11-02T10:30:00Z')

beforeEach(() => {
  vi.stubEnv('RESEND_API_KEY', 're_test')
  vi.stubEnv('EMAIL_FROM', 'Landly <noreply@golandly.com>')
  mocks.send.mockReset().mockResolvedValue({ data: { id: 'm1' }, error: null })
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('the new lead alert', () => {
  it('lists everything the team needs, in plain English', () => {
    const { subject, rows } = newLeadAlertEmail(LEAD, 'abcdefgh23', AT, 'landly-dev')
    expect(subject).toBe('🚀 New Waitlist Lead: Noa Cohen')
    expect(Object.fromEntries(rows.map((row) => [row.label, row.value]))).toEqual({
      'Full name': 'Noa Cohen',
      Email: 'noa@example.com',
      Phone: '+972501234567',
      'Preferred language': 'Russian',
      Persona: 'Other',
      'In their words': 'Here <for> work',
      'Heard about us': '🎵 TikTok',
      Submitted: '02.11.2026 12:30 (Israel)',
      'Lead ID': 'abcdefgh23',
      Project: 'landly-dev',
    })
  })
  it('says when a question was skipped, and leaves out the empty description', () => {
    const { rows } = newLeadAlertEmail({ ...LEAD, persona: null, personaOtherDescription: null, referralSource: null }, 'abcdefgh23', AT, 'landly-dev')
    const labels = Object.fromEntries(rows.map((row) => [row.label, row.value]))
    expect(labels).toMatchObject({ Persona: 'Not answered', 'Heard about us': 'Not answered' })
    expect(labels).not.toHaveProperty('In their words')
  })
  it('escapes visitor text, and has no message block without a message', () => {
    const { text, html } = buildTeamInboxEmail(newLeadAlertEmail(LEAD, 'abcdefgh23', AT, 'landly-dev'))
    expect(html).toContain('Here &lt;for&gt; work')
    expect(html).not.toContain('Here <for> work')
    expect(html).not.toContain('white-space:pre-wrap')
    expect(text).not.toContain('Message:')
  })
  it('goes to the team inbox from EMAIL_FROM, answers to the lead, and can only send once', async () => {
    expect(await sendNewLeadAlertEmail(LEAD, 'abcdefgh23', AT)).toBe('sent')
    const [email, options] = mocks.send.mock.calls[0]
    expect(email).toMatchObject({ from: 'Landly <noreply@golandly.com>', to: 'contact@golandly.com', replyTo: 'noa@example.com', subject: '🚀 New Waitlist Lead: Noa Cohen' })
    expect(options).toEqual({ idempotencyKey: 'new-lead-alert/abcdefgh23' })
  })
  it.each([
    ['Resend refuses', () => mocks.send.mockResolvedValue({ data: null, error: { name: 'rate_limit_exceeded', statusCode: 429, message: 'noa@example.com was refused' } })],
    ['Resend is down', () => mocks.send.mockRejectedValue(new Error('noa@example.com unreachable'))],
    ['email is not configured', () => vi.stubEnv('RESEND_API_KEY', '')],
  ])('never throws or logs the lead when %s', async (_, arrange) => {
    arrange()
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await sendNewLeadAlertEmail(LEAD, 'abcdefgh23', AT)).toBe('failed')
    const logged = JSON.stringify(log.mock.calls)
    expect(logged).toContain('abcdefgh23')
    expect(logged).not.toMatch(/noa@example|972501234567|Cohen/)
  })
})
