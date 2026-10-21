import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { updateSubscriberEmail } from '@/lib/responder/updateSubscriberEmail'

const CHANGE = { uid: 'member-1', oldEmail: 'Old@Landly.test', newEmail: 'new@landly.test', firstName: ' Dana ' }
const BASE = 'https://graph.responder.live/v2'
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
// The shapes Responder Live answered with in the live check.
const token = () => json({ id: 1, token: 'jwt-token', expire: '2026-10-21 00:00:00' })
const created = () => json({ status: true, duplicate: false, createdId: '24136180', capacity: true })
const record = (email: string, extra: Record<string, unknown> = {}) => ({ id: 1, list_id: 125246, subscriber_id: 7, email, first: 'Dana', active: 1, unsubscribed: 0, blocked: 0, ...extra })
const page = (records: unknown[]) => json({ status: true, total: records.length, data: records })

const SETTINGS = {
  RESPONDER_LIST_ID: '125246',
  RESPONDER_CLIENT_KEY: '123',
  RESPONDER_CLIENT_SECRET: 'client-secret',
  RESPONDER_USER_TOKEN: 'user-token',
}

let fetchMock: ReturnType<typeof vi.fn>
let errorLog: { mock: { calls: unknown[][] } }

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  for (const [name, value] of Object.entries(SETTINGS)) vi.stubEnv(name, value)
  vi.stubEnv('RESPONDER_CLIENT_ID', '')
  vi.stubEnv('RESPONDER_API_BASE', '')
  errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const logged = () => errorLog.mock.calls.map((c) => c.join(' ')).join('\n')
const call = (i: number) => {
  const [url, init] = fetchMock.mock.calls[i] as [string, RequestInit & { headers: Record<string, string> }]
  return { url, init, body: init.body ? JSON.parse(init.body as string) : undefined }
}

describe('updateSubscriberEmail', () => {
  it('reads the list, then adds the new address when the old one is subscribed', async () => {
    fetchMock.mockResolvedValueOnce(token()).mockResolvedValueOnce(page([record('old@landly.test')])).mockResolvedValueOnce(page([])).mockResolvedValueOnce(created())
    expect(await updateSubscriberEmail(CHANGE)).toBe('created')
    expect(fetchMock).toHaveBeenCalledTimes(4)

    const read = call(1)
    expect(read.url).toBe(`${BASE}/lists/125246/subscribers?limit=200&offset=0`)
    expect(read.init.method).toBe('GET')
    expect(read.init.body).toBeUndefined()
    expect(read.init.headers).toMatchObject({ Authorization: 'Bearer jwt-token' })
    expect(call(2).url).toBe(`${BASE}/lists/125246/subscribers?limit=200&offset=1`)

    const create = call(3)
    expect(create.url).toBe(`${BASE}/subscribers`)
    expect(create.init.method).toBe('POST')
    expect(create.body).toEqual({ email: 'new@landly.test', first: 'Dana', list_ids: [125246] })
    expect(errorLog.mock.calls).toHaveLength(0)
  })

  it('adds the new address for a member never synced', async () => {
    fetchMock.mockResolvedValueOnce(token()).mockResolvedValueOnce(page([])).mockResolvedValueOnce(created())
    expect(await updateSubscriberEmail(CHANGE)).toBe('created')
    expect(call(2).body.email).toBe('new@landly.test')
  })

  it.each([
    ['unsubscribed', { unsubscribed: 1 }],
    ['blocked', { blocked: '1' }],
  ])('adds nothing when the old address is %s in Responder', async (_, extra) => {
    fetchMock.mockResolvedValueOnce(token()).mockResolvedValueOnce(page([record('OLD@landly.test', extra)])).mockResolvedValueOnce(page([]))
    expect(await updateSubscriberEmail(CHANGE)).toBe('optedOut')
    // Only the token exchange posts; the list is only read.
    expect(fetchMock.mock.calls.slice(1).every(([, init]) => (init as RequestInit).method === 'GET')).toBe(true)
  })

  it('adds nothing when the new address already opted out', async () => {
    fetchMock.mockResolvedValueOnce(token()).mockResolvedValueOnce(page([record('old@landly.test'), record('new@landly.test', { unsubscribed: 1 })]))
    expect(await updateSubscriberEmail(CHANGE)).toBe('optedOut')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('stops reading once both addresses are found, and leaves a subscribed new address alone', async () => {
    fetchMock.mockResolvedValueOnce(token()).mockResolvedValueOnce(page([record('new@landly.test'), record('old@landly.test')]))
    expect(await updateSubscriberEmail(CHANGE)).toBe('existing')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('pages by the number of records each page returned', async () => {
    fetchMock
      .mockResolvedValueOnce(token())
      .mockResolvedValueOnce(page([record('a@landly.test'), record('b@landly.test'), record('c@landly.test')]))
      .mockResolvedValueOnce(page([record('old@landly.test')]))
      .mockResolvedValueOnce(page([]))
      .mockResolvedValueOnce(created())
    expect(await updateSubscriberEmail(CHANGE)).toBe('created')
    expect(call(2).url).toContain('offset=3')
    expect(call(3).url).toContain('offset=4')
  })

  it('is a silent no-op without settings, or when the address did not really change', async () => {
    expect(await updateSubscriberEmail({ ...CHANGE, newEmail: ' old@LANDLY.test ' })).toBe('skipped')
    expect(await updateSubscriberEmail({ ...CHANGE, oldEmail: '' })).toBe('skipped')
    vi.stubEnv('RESPONDER_USER_TOKEN', '')
    expect(await updateSubscriberEmail(CHANGE)).toBe('skipped')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(errorLog.mock.calls).toHaveLength(0)
  })

  it('fails without adding when the list cannot be read, masking addresses and never the name', async () => {
    fetchMock.mockResolvedValueOnce(token()).mockResolvedValueOnce(json({ message: 'Server Error for old@landly.test' }, 500))
    expect(await updateSubscriberEmail(CHANGE)).toBe('failed')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(logged()).toContain('step=lookup')
    expect(logged()).toContain('"status":500')
    expect(logged()).toContain('Server Error for <email>')
    expect(logged()).toContain('member-1')
    expect(logged()).not.toMatch(/old@landly\.test|new@landly\.test|Dana/i)
  })

  it('gives up on a list it cannot finish reading', async () => {
    fetchMock.mockResolvedValueOnce(token())
    fetchMock.mockImplementation(async () => page([record('someone@landly.test')]))
    expect(await updateSubscriberEmail(CHANGE)).toBe('failed')
    expect(fetchMock).toHaveBeenCalledTimes(51)
    expect(logged()).toContain('"code":"tooManyPages"')
  })

  it('logs a refused add like addSubscriber', async () => {
    fetchMock.mockResolvedValueOnce(token()).mockResolvedValueOnce(page([])).mockResolvedValueOnce(json({ status: false }))
    expect(await updateSubscriberEmail(CHANGE)).toBe('failed')
    expect(logged()).toContain('step=http')
    expect(logged()).toContain('"accepted":false')
  })

  it('aborts after 10 seconds across all calls and reports a timeout', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValueOnce(token())
    fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    }))
    const pending = updateSubscriberEmail(CHANGE)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await pending).toBe('failed')
    expect(logged()).toContain('"code":"timeout"')
  })
})
