import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runDailySync = vi.fn(async (_db: unknown, opts: { dry?: boolean }) => ({ status: 'ok', dry: !!opts.dry, date: '2026-11-18', counts: { added: 0, reactivated: 0, archived: 0 } }))
vi.mock('@/lib/inventory/raayonitDailySync', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/inventory/raayonitDailySync')>()), runDailySync: (...a: Parameters<typeof runDailySync>) => runDailySync(...a) }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: () => ({}) }))
vi.mock('@/lib/admin/revalidateHome', () => ({ revalidateGuestHome: vi.fn() }))
vi.mock('@/lib/translate/cloudTranslate', () => ({ isTranslationEnabled: () => false, cloudTranslator: {} }))

const call = async (headers: Record<string, string> = {}, query = '') => {
  const { GET } = await import('@/app/api/cron/raayonit-sync/route')
  return GET(new Request(`http://localhost/api/cron/raayonit-sync${query}`, { headers }))
}

beforeEach(() => { runDailySync.mockClear(); vi.stubEnv('CRON_SECRET', 'a-long-enough-secret-value') })
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

describe('GET /api/cron/raayonit-sync', () => {
  it('answers 503 without CRON_SECRET and 401 with a wrong one', async () => {
    vi.stubEnv('CRON_SECRET', '')
    expect((await call()).status).toBe(503)
    vi.stubEnv('CRON_SECRET', 'a-long-enough-secret-value')
    expect((await call({ authorization: 'Bearer nope' })).status).toBe(401)
    expect((await call()).status).toBe(401)
    expect(runDailySync).not.toHaveBeenCalled()
  })
  it('skips the firing that is not 04:00 in Jerusalem', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-18T01:00:00Z')) // winter: 03:00 there
    const res = await call({ authorization: 'Bearer a-long-enough-secret-value' })
    expect(await res.json()).toMatchObject({ skipped: 'wrong-hour', hour: 3 })
    expect(runDailySync).not.toHaveBeenCalled()
  })
  it('runs at 04:00 there in winter and in summer, guarded by the daily lock', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    for (const at of ['2026-11-18T02:00:00Z', '2026-07-15T01:00:00Z']) {
      vi.setSystemTime(new Date(at))
      const res = await call({ authorization: 'Bearer a-long-enough-secret-value' })
      expect(res.status).toBe(200)
    }
    expect(runDailySync).toHaveBeenCalledTimes(2)
    expect(runDailySync.mock.calls[0]![1]).toMatchObject({ dry: false, guarded: true })
  })
  it('?dry=1 previews at any hour', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-18T12:00:00Z'))
    await call({ authorization: 'Bearer a-long-enough-secret-value' }, '?dry=1')
    expect(runDailySync.mock.calls[0]![1]).toMatchObject({ dry: true })
  })
})
