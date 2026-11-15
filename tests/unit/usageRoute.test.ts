import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

// GET /api/admin/usage: one month of this deployment's own counters,
// read through getAdminDb() and priced.

const mocks = vi.hoisted(() => ({
  authError: null as Response | null,
  projectId: 'landly-be752',
  data: undefined as Record<string, unknown> | undefined,
  fail: false,
  docIds: [] as string[],
  monthIds: ['2026-10', '2026-09', 'notes'],
  listData: {} as Record<string, unknown>,
}))
vi.mock('@/lib/admin/adminAuth', () => ({ requireAdminAuth: () => mocks.authError }))
vi.mock('@/lib/firebase/admin', () => ({
  getAdminProjectId: () => mocks.projectId,
  getAdminDb: () => ({
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          if (mocks.fail) throw new Error('UNAVAILABLE')
          mocks.docIds.push(`${name}/${id}`)
          return { exists: mocks.data !== undefined, data: () => mocks.data }
        },
      }),
      select: () => ({ get: async () => ({ docs: mocks.monthIds.map((id) => ({ id, data: () => mocks.listData[id] })) }) }),
    }),
  }),
}))

import { GET } from '@/app/api/admin/usage/route'
import { reportLines, type UsageReport } from '@/lib/usage/usageReport'

const call = (query = '') => GET(new Request(`https://www.golandly.com/api/admin/usage${query}`))
const report = async (query = '') => (await (await call(query)).json()) as UsageReport

beforeEach(() => {
  mocks.authError = null
  mocks.projectId = 'landly-be752'
  mocks.data = { projectId: 'landly-be752', gateway019: { smsOtpSent: 20, whatsappOtpSent: 10 }, google: { translation: { chars: 1200 } } }
  mocks.fail = false
  mocks.docIds = []
  mocks.listData = {}
  mocks.monthIds = ['2026-10', '2026-09', 'notes']
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/admin/usage', () => {
  it('needs the admin session', async () => {
    mocks.authError = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    expect((await call()).status).toBe(401)
    expect(mocks.docIds).toEqual([])
  })

  it('reads the current UTC month by default, from this project', async () => {
    const r = await report()
    const month = new Date().toISOString().slice(0, 7)
    expect(r.month).toBe(month)
    expect(mocks.docIds).toEqual([`apiUsageStats/${month}`])
    expect(r).toMatchObject({ projectId: 'landly-be752', environment: 'prod' })
  })

  it('prices the month asked for', async () => {
    const r = await report('?month=2026-10')
    expect(mocks.docIds).toEqual(['apiUsageStats/2026-10'])
    expect(r.totals.otpSent).toBe(30)
    expect(r.totals.netIls).toBeCloseTo(20 * 0.02 + 10 * 0.075, 6)
    expect(r.groups.map((g) => g.vendor)).toEqual(['google', 'gateway019', 'meta'])
    expect(reportLines(r).find((l) => l.skuId === 'translation')!.used).toBe(1200)
  })

  it('labels a DEV deployment’s own counters as DEV', async () => {
    mocks.projectId = 'landly-dev'
    mocks.data = { projectId: 'landly-dev', gateway019: { simulated: 4 } }
    const r = await report('?month=2026-10')
    expect(r).toMatchObject({ projectId: 'landly-dev', environment: 'dev' })
    expect(reportLines(r).find((l) => l.skuId === 'sim019')!.used).toBe(4)
  })

  it('answers zeros for a month with no counters', async () => {
    mocks.data = undefined
    const r = await report('?month=2026-01')
    expect(r.totals).toMatchObject({ netIls: 0, grossIls: 0, otpSent: 0, freeCoveragePct: 100 })
  })

  it('lists the months with counters, ignoring other documents', async () => {
    expect((await report('?month=2026-10')).months).toEqual(expect.arrayContaining(['2026-10', '2026-09']))
    expect((await report('?month=2026-10')).months).not.toContain('notes')
  })

  it.each(['?month=2026-13', '?month=oct', '?month='])('refuses %s', async (query) => {
    expect((await call(query)).status).toBe(400)
  })

  it('refuses counters that name another project', async () => {
    mocks.data = { projectId: 'landly-dev' }
    const res = await call('?month=2026-10')
    expect(res.status).toBe(409)
  })

  it('says unavailable when Firestore fails, without details', async () => {
    mocks.fail = true
    const res = await call()
    expect(res.status).toBe(502)
    expect(JSON.stringify(await res.json())).not.toContain('UNAVAILABLE')
  })

  it('reports the 019 package quota against lifetime sends, whichever month is shown', async () => {
    mocks.monthIds = ['2026-11', '2026-10', '2026-09', 'quota019', 'notes']
    mocks.listData = {
      '2026-11': { projectId: 'landly-be752', gateway019: { smsOtpSent: 112, whatsappOtpSent: 17 } },
      '2026-10': { projectId: 'landly-be752', gateway019: { smsOtpSent: 300, whatsappOtpSent: 20 } },
      '2026-09': { projectId: 'landly-be752', gateway019: { smsOtpSent: 900, whatsappOtpSent: 900 } },
      quota019: { projectId: 'landly-be752', smsQuota: 2000 },
      notes: { gateway019: { smsOtpSent: 999 } },
    }
    for (const query of ['', '?month=2026-10']) {
      const r = await report(query)
      expect(r.quota.sms).toMatchObject({ sent: 412, quota: 2000, remaining: 1588 })
      expect(r.quota.whatsapp).toMatchObject({ sent: 37, quota: 1000, remaining: 963 })
      expect(r.months).not.toContain('quota019')
    }
  })

  it('defaults to 1,000 each, with the history still counted, when no quota document exists', async () => {
    mocks.monthIds = ['2026-10']
    mocks.listData = { '2026-10': { projectId: 'landly-be752', gateway019: { smsOtpSent: 20, whatsappOtpSent: 10 } } }
    const r = await report()
    expect(r.quota.sms).toMatchObject({ sent: 20, quota: 1000 })
    expect(r.quota.whatsapp).toMatchObject({ sent: 10, quota: 1000 })
  })

  it('leaves another project\'s documents out of the totals and the quota', async () => {
    mocks.monthIds = ['2026-10', 'quota019']
    mocks.listData = {
      '2026-10': { projectId: 'landly-dev', gateway019: { smsOtpSent: 500, whatsappOtpSent: 500 } },
      quota019: { projectId: 'landly-dev', smsQuota: 9000 },
    }
    const r = await report()
    expect(r.quota.sms).toMatchObject({ sent: 0, quota: 1000 })
  })
})
