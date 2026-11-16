import { beforeEach, describe, expect, it, vi } from 'vitest'

// A minimal in-memory newsletter_suppressions collection (get / set with merge / delete / the email > '' query).
const store = vi.hoisted(() => ({ docs: new Map<string, Record<string, unknown>>(), auth: null as Response | null }))
vi.mock('@/lib/firebase/admin', () => ({
  getAdminProjectId: () => 'landly-dev',
  getAdminDb: () => ({
    collection: () => ({
      doc: (id: string) => ({
        get: async () => ({ exists: store.docs.has(id), data: () => store.docs.get(id), get: (f: string) => store.docs.get(id)?.[f] }),
        set: async (value: Record<string, unknown>, opts?: { merge?: boolean }) => void store.docs.set(id, opts?.merge ? { ...store.docs.get(id), ...value } : value),
        delete: async () => void store.docs.delete(id),
      }),
      where: () => ({
        get: async () => ({ docs: [...store.docs].filter(([, d]) => typeof d.email === 'string' && d.email > '').map(([id, d]) => ({ id, data: () => d })) }),
      }),
    }),
  }),
}))
vi.mock('@/lib/admin/adminAuth', () => ({ requireAdminAuth: () => store.auth }))

import { DELETE, GET, POST } from '@/app/api/admin/newsletter/suppressions/route'
import { eligibleLeads, eligibleUsers, emailHash } from '@/lib/newsletter/audience.server'

const ALL = { kind: 'all', segment: 'all', lang: 'all' } as const
const call = (method: 'POST' | 'DELETE', body?: unknown, query = '') =>
  (method === 'POST' ? POST : DELETE)(new Request(`https://golandly.com/api/admin/newsletter/suppressions${query}`, { method, body: body === undefined ? undefined : JSON.stringify(body) }))

beforeEach(() => {
  store.docs.clear()
  store.auth = null
})

describe('admin newsletter suppressions', () => {
  it('suppresses an address with reason admin, keyed by its hash', async () => {
    const res = await call('POST', { email: ' Sysprof@Icloiud.com ' })
    expect(res.status).toBe(200)
    expect(store.docs.get(emailHash('sysprof@icloiud.com'))).toMatchObject({ reason: 'admin', email: 'sysprof@icloiud.com' })
  })
  it('rejects a malformed address and a missing body', async () => {
    expect((await call('POST', { email: 'nope' })).status).toBe(400)
    expect((await call('POST', {})).status).toBe(400)
  })
  it('never overrides a recipient\'s own opt-out, new or legacy', async () => {
    store.docs.set(emailHash('a@x.co'), { reason: 'unsubscribe', unsubscribedAt: 1 })
    store.docs.set(emailHash('b@x.co'), { unsubscribedAt: 1 }) // from before reasons were recorded
    expect((await call('POST', { email: 'a@x.co' })).status).toBe(409)
    expect((await call('POST', { email: 'b@x.co' })).status).toBe(409)
    expect(store.docs.get(emailHash('a@x.co'))).toEqual({ reason: 'unsubscribe', unsubscribedAt: 1 })
    expect(store.docs.get(emailHash('b@x.co'))).toEqual({ unsubscribedAt: 1 })
  })
  it('restores an admin suppression but refuses to lift an opt-out', async () => {
    await call('POST', { email: 'typo@icloiud.com' })
    expect((await call('DELETE', undefined, `?hash=${emailHash('typo@icloiud.com')}`)).status).toBe(200)
    expect(store.docs.size).toBe(0)

    store.docs.set(emailHash('gone@x.co'), { reason: 'unsubscribe', email: 'gone@x.co' })
    expect((await call('DELETE', undefined, `?hash=${emailHash('gone@x.co')}`)).status).toBe(409)
    expect(store.docs.size).toBe(1)
    expect((await call('DELETE', undefined, `?hash=${'0'.repeat(40)}`)).status).toBe(404)
    expect((await call('DELETE', undefined, '?hash=nothex')).status).toBe(400)
  })
  it('lists admin suppressions and opt-outs that carry an address, with the reason', async () => {
    await call('POST', { email: 'typo@icloiud.com' })
    store.docs.set(emailHash('gone@x.co'), { reason: 'unsubscribe', email: 'gone@x.co' })
    store.docs.set(emailHash('hashonly@x.co'), { reason: 'unsubscribe' })
    const body = await (await GET(new Request('https://golandly.com/api/admin/newsletter/suppressions'))).json()
    expect(body.suppressions.map((s: { email: string; reason: string }) => [s.email, s.reason]).sort()).toEqual([['gone@x.co', 'unsubscribe'], ['typo@icloiud.com', 'admin']])
  })
  it('answers the admin guard\'s refusal untouched', async () => {
    store.auth = new Response(null, { status: 401 })
    expect((await call('POST', { email: 'a@x.co' })).status).toBe(401)
    expect((await GET(new Request('https://golandly.com/api/admin/newsletter/suppressions'))).status).toBe(401)
  })
})

describe('audiences honour admin suppressions and flagged leads', () => {
  it('keeps an admin-suppressed member out, without touching a member who re-subscribed after opting out', () => {
    const docs = [{ email: 'typo@icloiud.com', marketingOptIn: true }, { email: 'ok@x.co', marketingOptIn: true }]
    expect(eligibleUsers(docs, ALL, new Set([emailHash('typo@icloiud.com')])).map((r) => r.email)).toEqual(['ok@x.co'])
    expect(eligibleUsers(docs, ALL).map((r) => r.email)).toEqual(['typo@icloiud.com', 'ok@x.co'])
  })
  it('leaves out leads flagged invalid', () => {
    const docs = [{ email: 'bad@icloiud.com', invalid: true }, { email: 'ok@x.co' }]
    expect(eligibleLeads(docs, ALL, new Set()).map((r) => r.email)).toEqual(['ok@x.co'])
  })
})
