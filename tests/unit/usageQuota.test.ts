import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { MemoryFirestore } from '../helpers/memoryFirestore'

// POST /api/admin/usage/topup: the 019 package quota grows by a fixed 1,000
// per call, atomically, guarded by the quota the admin saw, without touching
// the monthly counters (lifetime sent is summed from them).

const mocks = vi.hoisted(() => ({
  store: null as unknown as MemoryFirestore,
  authError: null as Response | null,
  projectId: 'landly-dev',
  audit: [] as unknown[],
}))
vi.mock('@/lib/admin/adminAuth', () => ({ requireAdminAuth: () => mocks.authError }))
vi.mock('@/lib/admin/auditLog', () => ({ auditInTransaction: (_db: unknown, _tx: unknown, _req: unknown, entry: unknown) => void mocks.audit.push(entry) }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: () => mocks.store.db, getAdminProjectId: () => mocks.projectId }))

import { POST } from '@/app/api/admin/usage/topup/route'

const QUOTA = 'apiUsageStats/quota019'
const topup = (body: unknown) =>
  POST(new Request('https://www.golandly.com/api/admin/usage/topup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))

beforeEach(() => {
  mocks.store = new MemoryFirestore()
  mocks.authError = null
  mocks.projectId = 'landly-dev'
  mocks.audit = []
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('POST /api/admin/usage/topup', () => {
  it('needs the admin session', async () => {
    mocks.authError = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    expect((await topup({ channel: 'sms', from: 1000 })).status).toBe(401)
    mocks.authError = NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    expect((await topup({ channel: 'sms', from: 1000 })).status).toBe(403)
    expect(mocks.store.read(QUOTA)).toBeUndefined()
  })

  it.each([
    [{}],
    [{ channel: 'email', from: 1000 }],
    [{ channel: 'sms' }],
    [{ channel: 'sms', from: '1000' }],
    [{ channel: 'sms', from: 1000.5 }],
    [{ channel: 'sms', from: 0 }],
    [{ channel: 'sms', from: -1000 }],
  ])('refuses a malformed request (%j)', async (body) => {
    expect((await topup(body)).status).toBe(400)
    expect(mocks.store.read(QUOTA)).toBeUndefined()
  })

  it('starts from the default 1,000 when nothing is stored: 1,000 -> 2,000 -> 3,000', async () => {
    const first = await topup({ channel: 'sms', from: 1000 })
    expect(first.status).toBe(200)
    expect(await first.json()).toEqual({ channel: 'sms', quota: 2000 })
    expect(mocks.store.read(QUOTA)).toMatchObject({ smsQuota: 2000, projectId: 'landly-dev', lastTopUp: { channel: 'sms' } })
    expect(await (await topup({ channel: 'sms', from: 2000 })).json()).toEqual({ channel: 'sms', quota: 3000 })
    expect(mocks.store.read(QUOTA)?.smsQuota).toBe(3000)
  })

  it('keeps the channels apart', async () => {
    await topup({ channel: 'whatsapp', from: 1000 })
    expect(mocks.store.read(QUOTA)).toMatchObject({ whatsappQuota: 2000 })
    expect(mocks.store.read(QUOTA)?.smsQuota).toBeUndefined()
    await topup({ channel: 'sms', from: 1000 })
    expect(mocks.store.read(QUOTA)).toMatchObject({ smsQuota: 2000, whatsappQuota: 2000 })
  })

  it('refuses a stale click with 409 and the current quota, adding nothing (double click, second admin)', async () => {
    expect((await topup({ channel: 'sms', from: 1000 })).status).toBe(200)
    const again = await topup({ channel: 'sms', from: 1000 })
    expect(again.status).toBe(409)
    expect(await again.json()).toMatchObject({ quota: 2000 })
    expect(mocks.store.read(QUOTA)?.smsQuota).toBe(2000)
    expect(mocks.audit).toHaveLength(1)
  })

  it('adds exactly 1,000 whatever amount the request claims', async () => {
    const res = await topup({ channel: 'sms', from: 1000, amount: 50_000, quota: 99_999 })
    expect(await res.json()).toEqual({ channel: 'sms', quota: 2000 })
  })

  it('never touches the monthly counters the lifetime total is summed from', async () => {
    const month = { month: '2026-10', projectId: 'landly-dev', gateway019: { smsOtpSent: 412, whatsappOtpSent: 37 } }
    mocks.store.seed('apiUsageStats/2026-10', month)
    await topup({ channel: 'sms', from: 1000 })
    await topup({ channel: 'whatsapp', from: 1000 })
    expect(mocks.store.read('apiUsageStats/2026-10')).toEqual(month)
  })

  it('records who changed what in the audit log', async () => {
    await topup({ channel: 'whatsapp', from: 1000 })
    expect(mocks.audit).toEqual([
      { action: 'usage.quotaTopUp', targetType: 'apiUsageQuota', targetId: 'whatsapp', before: { quota: 1000 }, after: { quota: 2000 } },
    ])
  })

  it('treats a malformed stored quota as the default', async () => {
    mocks.store.seed(QUOTA, { projectId: 'landly-dev', smsQuota: 'lots' })
    expect((await topup({ channel: 'sms', from: 1000 })).status).toBe(200)
    expect(mocks.store.read(QUOTA)?.smsQuota).toBe(2000)
  })

  it('refuses a quota document that names another project', async () => {
    mocks.store.seed(QUOTA, { projectId: 'landly-be752', smsQuota: 5000 })
    const res = await topup({ channel: 'sms', from: 5000 })
    expect(res.status).toBe(409)
    expect(mocks.store.read(QUOTA)?.smsQuota).toBe(5000)
    expect(mocks.audit).toEqual([])
  })

  it('answers 502 when Firestore fails, leaving the quota as it was', async () => {
    mocks.store.seed(QUOTA, { projectId: 'landly-dev', smsQuota: 2000 })
    vi.spyOn(mocks.store.db, 'runTransaction').mockRejectedValueOnce(new Error('UNAVAILABLE'))
    expect((await topup({ channel: 'sms', from: 2000 })).status).toBe(502)
    expect(mocks.store.read(QUOTA)?.smsQuota).toBe(2000)
  })
})
