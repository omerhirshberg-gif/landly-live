import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  projectId: 'landly-be752',
  updates: [] as Record<string, unknown>[],
  sets: [] as string[],
  batchSend: vi.fn(),
  usage: vi.fn(),
}))

vi.mock('resend', () => ({ Resend: class { batch = { send: db.batchSend }; emails = { send: vi.fn() } } }))
vi.mock('next/server', () => ({ after: (task: () => Promise<void>) => void task() }))
vi.mock('@/lib/usage/recordUsage', () => ({ recordUsageBatch: db.usage, recordUsage: db.usage }))
vi.mock('@/lib/firebase/admin', () => ({
  getAdminProjectId: () => db.projectId,
  getAdminDb: () => ({
    collection: (name: string) => ({ doc: (id: string) => ({ update: async (d: Record<string, unknown>) => void db.updates.push(d), set: async () => void db.sets.push(`${name}/${id}`) }) }),
    batch: () => ({ set: (ref: unknown) => void db.sets.push('batch'), commit: async () => undefined }),
  }),
}))

import { campaignSendMode, runCampaign } from '@/lib/newsletter/campaigns.server'

const content = { subject: 'S', headline: '', body: 'B', ctaLabel: '', ctaUrl: '' }
const recipients = Array.from({ length: 250 }, (_, i) => ({ email: `u${i}@x.co`, firstName: '', lastName: '', segment: '', lang: 'en' as const, source: 'user' as const }))

beforeEach(() => {
  process.env.UNSUBSCRIBE_SECRET = 's'
  db.projectId = 'landly-be752'
  db.updates = []
  db.sets = []
  db.batchSend.mockReset()
  db.usage.mockReset()
  process.env.RESEND_API_KEY = 're_x'
})

describe('campaignSendMode', () => {
  it('is live only in Production with a Resend key', () => {
    expect(campaignSendMode()).toBe('live')
    db.projectId = 'landly-dev'
    expect(campaignSendMode()).toBe('simulated')
    db.projectId = 'landly-be752'
    delete process.env.RESEND_API_KEY
    expect(campaignSendMode()).toBe('simulated')
  })
})

describe('runCampaign', () => {
  it('simulated: records usage and closes the campaign without calling Resend', async () => {
    await runCampaign({ campaignId: 'c', content, recipients, origin: 'https://golandly.com', mode: 'simulated' })
    expect(db.batchSend).not.toHaveBeenCalled()
    expect(db.usage).toHaveBeenCalledWith({ 'resend.simulated': 250 })
    expect(db.updates.at(-1)).toMatchObject({ status: 'simulated', sentCount: 250, failedCount: 0 })
  })

  it('live: 100 per batch, counted per accepted batch', async () => {
    db.batchSend.mockResolvedValue({ data: {}, error: null })
    await runCampaign({ campaignId: 'c', content, recipients, origin: 'https://golandly.com', mode: 'live' })
    expect(db.batchSend.mock.calls.map((c) => c[0].length)).toEqual([100, 100, 50])
    // Counted once per accepted batch by the shared Resend client, not again by the campaign.
    expect(db.usage.mock.calls).toEqual([['resend.emailsSent', 100], ['resend.emailsSent', 100], ['resend.emailsSent', 50]])
    expect(db.updates.at(-1)).toMatchObject({ status: 'sent', sentCount: 250, failedCount: 0, error: null })
  }, 15000)

  it('live: a rejected batch makes it partial and keeps the first error', async () => {
    db.batchSend
      .mockResolvedValueOnce({ data: {}, error: null })
      .mockResolvedValueOnce({ error: { name: 'validation_error', message: 'bad', statusCode: 422 } })
      .mockResolvedValueOnce({ data: {}, error: null })
    await runCampaign({ campaignId: 'c', content, recipients, origin: 'https://golandly.com', mode: 'live' })
    expect(db.updates.at(-1)).toMatchObject({ status: 'partial', sentCount: 150, failedCount: 100, error: 'validation_error: bad' })
    expect(db.usage.mock.calls).toEqual([['resend.emailsSent', 100], ['resend.emailsSent', 50]])
  }, 15000)
})
