import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { DEFAULT_SUBSCRIPTIONS, normalizeSubscriptions, parseSubscriptionsInput } from '@/lib/usage/fixedSubscriptions'

const mocks = vi.hoisted(() => ({
  authError: null as Response | null,
  projectId: 'landly-be752',
  stored: undefined as Record<string, unknown> | undefined,
  writes: [] as Record<string, unknown>[],
  audits: [] as Record<string, unknown>[],
  readFails: false,
}))
vi.mock('@/lib/admin/adminAuth', () => ({ requireAdminAuth: () => mocks.authError }))
vi.mock('@/lib/admin/auditLog', () => ({ auditInTransaction: (_db: unknown, _tx: unknown, _req: unknown, entry: Record<string, unknown>) => void mocks.audits.push(entry) }))
vi.mock('@/lib/firebase/admin', () => ({
  getAdminProjectId: () => mocks.projectId,
  getAdminDb: () => ({
    doc: () => ({
      get: async () => {
        if (mocks.readFails) throw new Error('UNAVAILABLE')
        return { exists: mocks.stored !== undefined, data: () => mocks.stored }
      },
    }),
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ get: async () => ({ exists: mocks.stored !== undefined, data: () => mocks.stored }), set: (_ref: unknown, value: Record<string, unknown>) => void mocks.writes.push(value) }),
  }),
}))

import { PUT } from '@/app/api/admin/system/costs/subscriptions/route'
import { loadFixedSubscriptions } from '@/lib/usage/fixedSubscriptions.server'

const vercel = { id: 'vercelPro', label: 'Vercel Pro', amount: 25, currency: 'USD', active: true }
const put = (body: unknown) => PUT(new Request('https://www.golandly.com/api/admin/system/costs/subscriptions', { method: 'PUT', body: JSON.stringify(body) }))

beforeEach(() => {
  mocks.authError = null
  mocks.projectId = 'landly-be752'
  mocks.stored = undefined
  mocks.writes = []
  mocks.audits = []
  mocks.readFails = false
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('defaults and validation', () => {
  it('defaults to Vercel Pro at $20 a month', () => {
    expect(DEFAULT_SUBSCRIPTIONS).toEqual([{ id: 'vercelPro', label: 'Vercel Pro', amount: 20, currency: 'USD', active: true }])
  })
  it('accepts a valid list, rounding to cents, and allows custom items', () => {
    const parsed = parseSubscriptionsInput([{ ...vercel, amount: 25.456 }, { id: 'domainTool', label: 'Tool', amount: 5, currency: 'ILS', active: false }])
    expect(parsed).toMatchObject({ ok: true })
    expect(parsed.ok && parsed.items[0].amount).toBe(25.46)
  })
  it.each([
    ['not an array', {}],
    ['empty', []],
    ['no Vercel Pro', [{ id: 'other', label: 'x', amount: 1, currency: 'USD', active: true }]],
    ['negative amount', [{ ...vercel, amount: -1 }]],
    ['too large', [{ ...vercel, amount: 10_001 }]],
    ['NaN-like', [{ ...vercel, amount: '20' }]],
    ['bad currency', [{ ...vercel, currency: 'EUR' }]],
    ['bad id', [{ ...vercel, id: 'Vercel Pro' }]],
    ['no label', [{ ...vercel, label: ' ' }]],
    ['not boolean', [{ ...vercel, active: 'yes' }]],
    ['duplicate', [vercel, vercel]],
    ['too many', Array.from({ length: 11 }, (_, i) => ({ ...vercel, id: i === 0 ? 'vercelPro' : `item${i}` }))],
  ])('rejects %s', (_name, input) => {
    expect(parseSubscriptionsInput(input)).toMatchObject({ ok: false })
  })
  it('normalizes stored data: drops malformed items and restores Vercel Pro', () => {
    expect(normalizeSubscriptions(undefined)).toEqual(DEFAULT_SUBSCRIPTIONS)
    expect(normalizeSubscriptions([{ id: 'x', amount: 'bad' }])).toEqual(DEFAULT_SUBSCRIPTIONS)
    const items = normalizeSubscriptions([{ id: 'tool', label: 'Tool', amount: 3, currency: 'ILS', active: true }])
    expect(items.map((item) => item.id)).toEqual(['vercelPro', 'tool'])
  })
})

describe('loading', () => {
  it('uses the defaults with nothing stored or on a Firestore error, and the stored price otherwise', async () => {
    expect(await loadFixedSubscriptions()).toEqual(DEFAULT_SUBSCRIPTIONS)
    mocks.stored = { items: [{ ...vercel, amount: 30 }] }
    expect((await loadFixedSubscriptions())[0].amount).toBe(30)
    mocks.readFails = true
    expect(await loadFixedSubscriptions()).toEqual(DEFAULT_SUBSCRIPTIONS)
  })
})

describe('PUT /api/admin/system/costs/subscriptions', () => {
  it('needs the admin session', async () => {
    mocks.authError = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    expect((await put({ items: [vercel] })).status).toBe(401)
    expect(mocks.writes).toHaveLength(0)
  })
  it('rejects an invalid list (400)', async () => {
    expect((await put({ items: [{ ...vercel, amount: -5 }] })).status).toBe(400)
    expect(mocks.writes).toHaveLength(0)
  })
  it('saves the list with the project id and an audit entry', async () => {
    const res = await put({ items: [vercel] })
    expect(res.status).toBe(200)
    expect(mocks.writes[0]).toMatchObject({ items: [vercel], projectId: 'landly-be752', updatedBy: 'admin' })
    expect(mocks.audits[0]).toMatchObject({ action: 'usage.fixedSubscriptions', before: DEFAULT_SUBSCRIPTIONS, after: [vercel] })
  })
  it('refuses a document of another project (409)', async () => {
    mocks.stored = { projectId: 'landly-dev', items: [vercel] }
    expect((await put({ items: [vercel] })).status).toBe(409)
    expect(mocks.writes).toHaveLength(0)
  })
})
