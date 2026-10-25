import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// GET /api/usage/export: PROD's counters for the DEV dashboards. Off unless
// it's Vercel Production with USAGE_EXPORT_TOKEN set, bearer-only, and
// nothing but the month's counters in the answer.

const mocks = vi.hoisted(() => ({ data: undefined as Record<string, unknown> | undefined, failRead: false }))
vi.mock('@/lib/firebase/admin', () => ({
  getAdminProjectId: () => 'landly-be752',
  getAdminDb: () => ({
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          if (mocks.failRead) throw new Error('UNAVAILABLE')
          return { exists: mocks.data !== undefined, data: () => ({ ...mocks.data, collection: name, id }) }
        },
      }),
      select: () => ({ get: async () => ({ docs: [{ id: '2026-10' }, { id: '2026-09' }, { id: 'notes' }] }) }),
    }),
  }),
}))

import { GET } from '@/app/api/usage/export/route'

const TOKEN = 't'.repeat(48)
const call = (query = '?month=2026-10', authorization: string | null = `Bearer ${TOKEN}`) =>
  GET(new Request(`https://www.golandly.com/api/usage/export${query}`, { headers: authorization ? { authorization } : {} }))

beforeEach(() => {
  mocks.data = { projectId: 'landly-be752', month: '2026-10', google: { translation: { chars: 1200 } }, whatsapp: { authSent: 3 }, daily: { '25': { whatsapp: { authSent: 3 } } } }
  mocks.failRead = false
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('LANDLY_VERCEL', '1')
  vi.stubEnv('LANDLY_VERCEL_ENV', 'production')
  vi.stubEnv('USAGE_EXPORT_TOKEN', TOKEN)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('GET /api/usage/export', () => {
  it('answers the month’s counters and nothing else', async () => {
    const res = await call()
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = await res.json()
    expect(Object.keys(body).sort()).toEqual(['counters', 'month', 'months', 'projectId'])
    expect(body).toMatchObject({ projectId: 'landly-be752', month: '2026-10', months: ['2026-10', '2026-09'] })
    expect(body.counters.google.translation.chars).toBe(1200)
    expect(body.counters.whatsapp.authSent).toBe(3)
    expect(JSON.stringify(body)).not.toContain('daily')
  })

  it('answers zeros for a month with no counters', async () => {
    mocks.data = undefined
    const body = await (await call()).json()
    expect(body.counters.whatsapp.authSent).toBe(0)
  })

  it.each([
    ['no token is set', () => vi.stubEnv('USAGE_EXPORT_TOKEN', '')],
    ['the token is too short', () => vi.stubEnv('USAGE_EXPORT_TOKEN', 'short')],
    ['it runs on Vercel Preview', () => vi.stubEnv('LANDLY_VERCEL_ENV', 'preview')],
    ['it runs locally', () => vi.stubEnv('LANDLY_VERCEL', '')],
  ])('is not there when %s', async (_, setup) => {
    setup()
    expect((await call()).status).toBe(404)
  })

  it.each([
    ['no header', null],
    ['a wrong token', `Bearer ${'u'.repeat(48)}`],
    ['a prefix of the token', `Bearer ${TOKEN.slice(0, 10)}`],
    ['the token without Bearer', TOKEN],
  ])('refuses %s', async (_, authorization) => {
    expect((await call('?month=2026-10', authorization)).status).toBe(401)
  })

  it.each(['', '?month=2026-13', '?month=../users', '?month=2026-10-01'])('refuses month %j', async (query) => {
    expect((await call(query)).status).toBe(400)
  })

  it('refuses counters that name another project', async () => {
    mocks.data = { projectId: 'landly-dev' }
    expect((await call()).status).toBe(409)
  })

  it('says unavailable when Firestore fails, without details', async () => {
    mocks.failRead = true
    const res = await call()
    expect(res.status).toBe(502)
    expect(JSON.stringify(await res.json())).not.toContain('UNAVAILABLE')
  })
})
