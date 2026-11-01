import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Firestore } from 'firebase-admin/firestore'
import { ravMesserConfigured, ravMesserListId, sweepUnsyncedLeads, syncLeadToRavMesser } from '@/lib/marketing/ravMesser.server'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const token = () => json({ token: 'jwt-token' })
const created = () => json({ status: true, duplicate: false, createdId: 1 })
const duplicate = () => json({ status: true, duplicate: true, createdId: 1 })

const LEAD = { firstName: 'Noa', lastName: 'Cohen', email: 'noa@example.com', phone: '+972501234567', lang: 'he', persona: 'student', ravMesserSync: { synced: false, syncedAt: null, error: null }, ravMesserSyncAttempts: 0 }

// Only what the sync touches: one collection of leads, with the update recorded.
function fakeDb(leads: Record<string, Record<string, unknown>>) {
  const updates: Record<string, Record<string, unknown>[]> = {}
  const db = {
    collection: () => ({
      doc: (id: string) => ({
        get: async () => ({ exists: id in leads, data: () => leads[id] }),
        update: async (patch: Record<string, unknown>) => { (updates[id] ??= []).push(patch) },
      }),
      where: () => ({
        select: () => ({
          get: async () => ({
            docs: Object.entries(leads).map(([id, lead]) => ({ id, get: (field: string) => lead[field] })),
          }),
        }),
      }),
    }),
  }
  return { db: db as unknown as Firestore, updates }
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('RESPONDER_LIST_ID', '111')
  vi.stubEnv('RESPONDER_CLIENT_ID', '')
  vi.stubEnv('RESPONDER_API_BASE', '')
  vi.stubEnv('RESPONDER_CLIENT_KEY', '123')
  vi.stubEnv('RESPONDER_CLIENT_SECRET', 'client-secret')
  vi.stubEnv('RESPONDER_USER_TOKEN', 'members-token')
  vi.stubEnv('RAV_MESSER_USER_TOKEN', '')
  vi.stubEnv('RAV_MESSER_LIST_ID', '')
  vi.stubEnv('RAV_MESSER_FIELD_PERSONA', '')
  vi.stubEnv('RAV_MESSER_FIELD_LANG', '')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const subscriberBody = (i = 1) => JSON.parse((fetchMock.mock.calls[i] as [string, RequestInit])[1].body as string)

describe('syncLeadToRavMesser', () => {
  it('sends the lead to list 127449 by default, not the members list, and records the sync', async () => {
    fetchMock.mockResolvedValueOnce(token()).mockResolvedValueOnce(created())
    const { db, updates } = fakeDb({ lead1: LEAD })
    expect(await syncLeadToRavMesser(db, 'lead1')).toBe('synced')
    expect(subscriberBody()).toEqual({ email: 'noa@example.com', first: 'Noa', last: 'Cohen', phone: '+972501234567', list_ids: [127449] })
    expect(updates.lead1).toHaveLength(1)
    expect(updates.lead1[0].ravMesserSync).toMatchObject({ synced: true, error: null })
    expect((updates.lead1[0].ravMesserSync as { syncedAt: unknown }).syncedAt).not.toBeNull()
  })

  it('leaves last out for a lead from before it was asked, and reads a lead that only has a name', async () => {
    fetchMock.mockResolvedValueOnce(token()).mockResolvedValueOnce(created())
    await syncLeadToRavMesser(fakeDb({ lead1: { ...LEAD, firstName: undefined, name: 'Legacy', lastName: undefined } }).db, 'lead1')
    expect(subscriberBody()).toEqual({ email: 'noa@example.com', first: 'Legacy', phone: '+972501234567', list_ids: [127449] })
  })

  it('honours RAV_MESSER_LIST_ID and RAV_MESSER_USER_TOKEN', async () => {
    vi.stubEnv('RAV_MESSER_LIST_ID', '555')
    vi.stubEnv('RAV_MESSER_USER_TOKEN', 'list-token')
    expect(ravMesserListId()).toBe('555')
    fetchMock.mockResolvedValueOnce(token()).mockResolvedValueOnce(created())
    await syncLeadToRavMesser(fakeDb({ lead1: LEAD }).db, 'lead1')
    expect(subscriberBody(0).user_token).toBe('list-token')
    expect(subscriberBody().list_ids).toEqual([555])
  })

  it('never sends override, rejoin or a description', async () => {
    fetchMock.mockResolvedValueOnce(token()).mockResolvedValueOnce(created())
    await syncLeadToRavMesser(fakeDb({ lead1: LEAD }).db, 'lead1')
    expect(subscriberBody()).not.toHaveProperty('override')
    expect(subscriberBody()).not.toHaveProperty('rejoin')
    expect(subscriberBody()).not.toHaveProperty('description')
  })

  it('sends a personal field only when its id is set', async () => {
    vi.stubEnv('RAV_MESSER_FIELD_PERSONA', '508')
    fetchMock.mockResolvedValueOnce(token()).mockResolvedValueOnce(created())
    await syncLeadToRavMesser(fakeDb({ lead1: LEAD }).db, 'lead1')
    expect(subscriberBody().personal_fields).toEqual({ 508: 'student' })

    vi.stubEnv('RAV_MESSER_FIELD_LANG', '509')
    fetchMock.mockResolvedValueOnce(token()).mockResolvedValueOnce(created())
    await syncLeadToRavMesser(fakeDb({ lead1: { ...LEAD, persona: null } }).db, 'lead1')
    expect(subscriberBody(3).personal_fields).toEqual({ 509: 'he' })
  })

  it('counts an address already on the list as synced', async () => {
    fetchMock.mockResolvedValueOnce(token()).mockResolvedValueOnce(duplicate())
    const { db, updates } = fakeDb({ lead1: LEAD })
    expect(await syncLeadToRavMesser(db, 'lead1')).toBe('synced')
    expect(updates.lead1[0].ravMesserSync).toMatchObject({ synced: true })
  })

  it.each([
    ['a refusal', () => { fetchMock.mockResolvedValueOnce(token()).mockResolvedValueOnce(json({ status: false })) }, 'refused'],
    ['a server error', () => { fetchMock.mockResolvedValueOnce(token()).mockResolvedValueOnce(json({}, 503)) }, 'http_503'],
    ['a rate limit', () => { fetchMock.mockResolvedValueOnce(token()).mockResolvedValueOnce(json({}, 429)) }, 'http_429'],
    ['refused credentials', () => { fetchMock.mockResolvedValueOnce(json({ error: 'no' }, 401)) }, 'token'],
    ['a network error', () => { fetchMock.mockRejectedValueOnce(new TypeError('fetch failed')) }, 'network'],
  ])('records %s without throwing', async (_, arrange, code) => {
    arrange()
    const { db, updates } = fakeDb({ lead1: LEAD })
    expect(await syncLeadToRavMesser(db, 'lead1')).toBe('failed')
    expect(updates.lead1[0].ravMesserSync).toEqual({ synced: false, syncedAt: null, error: code })
  })

  it('records a timeout after the 10-second deadline', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    }))
    const { db, updates } = fakeDb({ lead1: LEAD })
    const pending = syncLeadToRavMesser(db, 'lead1')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await pending).toBe('failed')
    expect(updates.lead1[0].ravMesserSync).toMatchObject({ error: 'timeout' })
  })

  it('leaves the lead pending, with a warning and no attempt, when credentials are missing', async () => {
    vi.stubEnv('RESPONDER_USER_TOKEN', '')
    const { db, updates } = fakeDb({ lead1: LEAD })
    expect(ravMesserConfigured()).toBe(false)
    expect(await syncLeadToRavMesser(db, 'lead1')).toBe('skipped')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(updates).toEqual({})
    expect(console.warn).toHaveBeenCalledTimes(1)
  })

  it('does not call Rav Messer for a synced or a missing lead', async () => {
    const { db } = fakeDb({ lead1: { ...LEAD, ravMesserSync: { synced: true } } })
    expect(await syncLeadToRavMesser(db, 'lead1')).toBe('synced')
    expect(await syncLeadToRavMesser(db, 'nobody')).toBe('missing')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('never throws when Firestore fails, and logs no lead details', async () => {
    const db = { collection: () => { throw new Error('down') } } as unknown as Firestore
    expect(await syncLeadToRavMesser(db, 'lead1')).toBe('failed')
    expect(JSON.stringify((console.error as unknown as { mock: { calls: unknown[] } }).mock.calls)).not.toContain('noa@example.com')
  })
})

describe('sweepUnsyncedLeads', () => {
  const age = (minutes: number) => ({ toMillis: () => Date.now() - minutes * 60_000 })

  it('retries settled leads, oldest first, leaving fresh and exhausted ones', async () => {
    fetchMock.mockImplementation(async (url: string) => (url.endsWith('/oauth/token') ? token() : created()))
    const { db, updates } = fakeDb({
      older: { ...LEAD, createdAt: age(60) },
      oldest: { ...LEAD, createdAt: age(120) },
      fresh: { ...LEAD, createdAt: age(1) },
      exhausted: { ...LEAD, createdAt: age(90), ravMesserSyncAttempts: 5 },
    })
    expect(await sweepUnsyncedLeads(db)).toEqual({ attempted: 2, synced: 2 })
    expect(Object.keys(updates)).toEqual(['oldest', 'older'])
  })

  it('takes 25 leads a run', async () => {
    fetchMock.mockImplementation(async (url: string) => (url.endsWith('/oauth/token') ? token() : created()))
    const leads = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`lead${i}`, { ...LEAD, createdAt: age(60) }]))
    expect(await sweepUnsyncedLeads(fakeDb(leads).db)).toEqual({ attempted: 25, synced: 25 })
  })

  it('stops starting syncs once its time budget is spent', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(() => new Promise((_resolve, reject) => setTimeout(() => reject(new TypeError('fetch failed')), 9_000)))
    const leads = Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`lead${i}`, { ...LEAD, createdAt: age(60) }]))
    const pending = sweepUnsyncedLeads(fakeDb(leads).db)
    await vi.advanceTimersByTimeAsync(60_000)
    expect((await pending).attempted).toBe(6)
  })

  it('does nothing when credentials are missing', async () => {
    vi.stubEnv('RESPONDER_CLIENT_SECRET', '')
    const { db } = fakeDb({ lead1: { ...LEAD, createdAt: age(60) } })
    expect(await sweepUnsyncedLeads(db)).toEqual({ attempted: 0, synced: 0 })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
