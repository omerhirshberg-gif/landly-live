import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

// The monthly costs cron (auth, month, once-a-month lock) and the admin's manual send.

const mocks = vi.hoisted(() => ({
  projectId: 'landly-be752',
  locks: new Map<string, Record<string, unknown>>(),
  sent: [] as Record<string, unknown>[],
  sendOptions: [] as unknown[],
  sendError: null as { name: string; statusCode: number; message: string } | null,
  authError: null as Response | null,
}))

vi.mock('@/lib/admin/adminAuth', () => ({ requireAdminAuth: () => mocks.authError }))
vi.mock('@/lib/firebase/admin', () => ({
  getAdminProjectId: () => mocks.projectId,
  getAdminDb: () => ({
    doc: (path: string) => ({
      path,
      set: async (value: Record<string, unknown>) => void mocks.locks.set(path, value),
      delete: async () => void mocks.locks.delete(path),
    }),
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        get: async (ref: { path: string }) => ({ exists: mocks.locks.has(ref.path), data: () => mocks.locks.get(ref.path) }),
        set: (ref: { path: string }, value: Record<string, unknown>) => void mocks.locks.set(ref.path, value),
      }),
  }),
}))
vi.mock('@/lib/usage/loadUsageReport.server', async () => {
  const { buildUsageReport } = await import('@/lib/usage/usageReport')
  const { emptyCounters } = await import('@/lib/usage/usageTypes')
  return {
    ForeignProjectError: class extends Error {},
    loadUsageReport: async (month: string) => buildUsageReport({ month, months: [month], projectId: mocks.projectId, counters: emptyCounters() }),
  }
})
vi.mock('@/lib/usage/recordUsage', () => ({ recordUsage: vi.fn() }))
vi.mock('@/lib/email/brandedEmail', () => ({
  EmailProviderError: class extends Error {},
  emailConfigProblem: () => null,
  getResend: () => ({
    emails: {
      send: async (message: Record<string, unknown>, options: unknown) => {
        mocks.sendOptions.push(options)
        if (mocks.sendError) return { error: mocks.sendError }
        mocks.sent.push(message)
        return { data: { id: 'x' } }
      },
    },
  }),
}))

import { GET } from '@/app/api/cron/monthly-costs-report/route'
import { POST } from '@/app/api/admin/system/costs/send-report/route'
import { previousMonthKey, reportRecipient } from '@/lib/usage/monthlyCostsReport.server'

const cron = (token?: string, query = '') =>
  GET(new Request(`https://www.golandly.com/api/cron/monthly-costs-report${query}`, { headers: token ? { authorization: `Bearer ${token}` } : {} }))
const manual = (body: unknown) => POST(new Request('https://www.golandly.com/api/admin/system/costs/send-report', { method: 'POST', body: JSON.stringify(body) }))

beforeEach(() => {
  mocks.projectId = 'landly-be752'
  mocks.locks.clear()
  mocks.sent = []
  mocks.sendOptions = []
  mocks.sendError = null
  mocks.authError = null
  vi.stubEnv('CRON_SECRET', 'cron-secret-value')
  vi.stubEnv('RESEND_API_KEY', 're_test')
  vi.stubEnv('EMAIL_FROM', 'GoLandly <hello@golandly.com>')
  vi.stubEnv('COSTS_REPORT_EMAIL', '')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('helpers', () => {
  it('summarises the UTC month before now, across a year boundary', () => {
    expect(previousMonthKey(new Date('2026-12-01T05:00:00Z'))).toBe('2026-11')
    expect(previousMonthKey(new Date('2027-01-01T05:00:00Z'))).toBe('2026-12')
  })
  it('sends to COSTS_REPORT_EMAIL, else contact@golandly.com', () => {
    expect(reportRecipient()).toBe('contact@golandly.com')
    vi.stubEnv('COSTS_REPORT_EMAIL', 'books@example.com')
    expect(reportRecipient()).toBe('books@example.com')
  })
})

describe('GET /api/cron/monthly-costs-report', () => {
  it('is unavailable (503) until CRON_SECRET is set', async () => {
    vi.stubEnv('CRON_SECRET', '')
    expect((await cron('anything')).status).toBe(503)
    expect(mocks.sent).toHaveLength(0)
  })
  it('refuses a missing or wrong bearer token (401)', async () => {
    expect((await cron()).status).toBe(401)
    expect((await cron('wrong')).status).toBe(401)
    expect(mocks.sent).toHaveLength(0)
  })
  it('rejects a malformed month (400)', async () => {
    expect((await cron('cron-secret-value', '?month=2026-13')).status).toBe(400)
  })
  it('emails the report with a BOM CSV attachment (200) and an idempotency key', async () => {
    const res = await cron('cron-secret-value', '?month=2026-11')
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, status: 'sent', month: '2026-11', to: 'contact@golandly.com' })
    const [message] = mocks.sent
    expect(message.to).toBe('contact@golandly.com')
    const [attachment] = message.attachments as { filename: string; content: Buffer }[]
    expect(attachment.filename).toBe('golandly-costs-2026-11.csv')
    expect([...attachment.content.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(mocks.sendOptions[0]).toEqual({ idempotencyKey: 'monthly-costs-2026-11' })
    expect(mocks.locks.get('system_config/monthly_costs_report_2026-11')).toMatchObject({ status: 'sent' })
  })
  it('does not send twice for the same month', async () => {
    await cron('cron-secret-value', '?month=2026-11')
    const again = await (await cron('cron-secret-value', '?month=2026-11')).json()
    expect(again).toMatchObject({ status: 'skipped', reason: 'already-sent' })
    expect(mocks.sent).toHaveLength(1)
  })
  it('skips while another run holds a fresh lock, and takes over a stale one', async () => {
    mocks.locks.set('system_config/monthly_costs_report_2026-11', { status: 'sending', claimedAt: Date.now() })
    expect(await (await cron('cron-secret-value', '?month=2026-11')).json()).toMatchObject({ status: 'skipped', reason: 'in-progress' })
    mocks.locks.set('system_config/monthly_costs_report_2026-11', { status: 'sending', claimedAt: Date.now() - 3600_000 })
    expect((await (await cron('cron-secret-value', '?month=2026-11')).json()).status).toBe('sent')
  })
  it('frees the lock when Resend rejects, so a retry can send (502)', async () => {
    mocks.sendError = { name: 'application_error', statusCode: 500, message: 'boom' }
    expect((await cron('cron-secret-value', '?month=2026-11')).status).toBe(502)
    expect(mocks.locks.has('system_config/monthly_costs_report_2026-11')).toBe(false)
    mocks.sendError = null
    expect((await cron('cron-secret-value', '?month=2026-11')).status).toBe(200)
  })
  it('simulates outside Production: nothing mailed, no lock', async () => {
    mocks.projectId = 'landly-dev'
    const body = await (await cron('cron-secret-value', '?month=2026-11')).json()
    expect(body.status).toBe('simulated')
    expect(mocks.sent).toHaveLength(0)
    expect(mocks.locks.size).toBe(0)
  })
})

describe('POST /api/admin/system/costs/send-report', () => {
  it('needs the admin session', async () => {
    mocks.authError = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    expect((await manual({ month: '2026-10' })).status).toBe(401)
  })
  it('rejects a bad month (400)', async () => {
    expect((await manual({ month: 'nope' })).status).toBe(400)
  })
  it('sends the chosen month in the admin\'s language, ignoring the cron lock', async () => {
    mocks.locks.set('system_config/monthly_costs_report_2026-09', { status: 'sent' })
    const res = await manual({ month: '2026-09', lang: 'he' })
    expect(res.status).toBe(200)
    expect(mocks.sent).toHaveLength(1)
    expect(mocks.sent[0].html).toContain('dir="rtl"')
    expect(mocks.sendOptions[0]).toBeUndefined()
  })
  it('throttles a repeat within 30 seconds (429)', async () => {
    expect((await manual({ month: '2026-08' })).status).toBe(200)
    expect((await manual({ month: '2026-08' })).status).toBe(429)
  })
})
