import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addSubscriber } from '@/lib/responder/addSubscriber'

const MEMBER = { uid: 'member-1', email: 'member@landly.test', firstName: ' Dana ' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const created = () => json({ SUBSCRIBERS_CREATED: [123], EMAILS_INVALID: [], EMAILS_EXISTING: [], EMAILS_BANNED: [], ERRORS: [] })

let fetchMock: ReturnType<typeof vi.fn>
let errorLog: { mock: { calls: unknown[][] } }

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('RESPONDER_LIST_ID', '125246')
  vi.stubEnv('RESPONDER_USER_TOKEN', 'user-token')
  vi.stubEnv('RESPONDER_CLIENT_ID', '')
  vi.stubEnv('RESPONDER_CLIENT_SECRET', '')
  vi.stubEnv('RESPONDER_USER_SECRET', '')
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

describe('addSubscriber', () => {
  it('posts the member to the list as a form-encoded subscribers array with a Bearer token', async () => {
    fetchMock.mockResolvedValueOnce(created())
    expect(await addSubscriber(MEMBER)).toBe('created')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.responder.co.il/main/lists/125246/subscribers')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer user-token', 'Content-Type': 'application/x-www-form-urlencoded' })
    expect(init.signal).toBeInstanceOf(AbortSignal)
    const subscribers = JSON.parse((init.body as URLSearchParams).get('subscribers')!)
    expect(subscribers).toEqual([{ EMAIL: 'member@landly.test', NAME: 'Dana', NOTIFY: 0 }])
    expect(errorLog).not.toHaveBeenCalled()
  })

  it('accepts a 201 and an overridden API base', async () => {
    vi.stubEnv('RESPONDER_API_BASE', 'https://api.example.test/v2/')
    fetchMock.mockResolvedValueOnce(json({ SUBSCRIBERS_CREATED: [9] }, 201))
    expect(await addSubscriber(MEMBER)).toBe('created')
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.test/v2/lists/125246/subscribers')
  })

  it('is a silent no-op without the list id or user token', async () => {
    vi.stubEnv('RESPONDER_LIST_ID', '')
    expect(await addSubscriber(MEMBER)).toBe('skipped')
    vi.stubEnv('RESPONDER_LIST_ID', '125246')
    vi.stubEnv('RESPONDER_USER_TOKEN', '')
    expect(await addSubscriber(MEMBER)).toBe('skipped')
    vi.stubEnv('RESPONDER_USER_TOKEN', 'user-token')
    vi.stubEnv('RESPONDER_LIST_ID', 'not-a-number')
    expect(await addSubscriber(MEMBER)).toBe('skipped')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(errorLog).not.toHaveBeenCalled()
  })

  it('treats an existing subscriber as success, in the body or as a 409', async () => {
    fetchMock.mockResolvedValueOnce(json({ SUBSCRIBERS_CREATED: [], EMAILS_EXISTING: ['member@landly.test'] }))
    expect(await addSubscriber(MEMBER)).toBe('existing')
    fetchMock.mockResolvedValueOnce(json({ message: 'already exists' }, 409))
    expect(await addSubscriber(MEMBER)).toBe('existing')
    expect(errorLog).not.toHaveBeenCalled()
  })

  it('logs an HTTP error with the uid and status only', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: 'member@landly.test is bad' }, 500))
    expect(await addSubscriber(MEMBER)).toBe('failed')
    expect(logged()).toContain('step=http')
    expect(logged()).toContain('"status":500')
    expect(logged()).toContain('member-1')
    expect(logged()).not.toContain('member@landly.test')
  })

  it('logs a rejected address by bucket counts, never the address', async () => {
    fetchMock.mockResolvedValueOnce(json({ SUBSCRIBERS_CREATED: [], EMAILS_INVALID: ['member@landly.test'], EMAILS_EXISTING: [] }))
    expect(await addSubscriber(MEMBER)).toBe('failed')
    expect(logged()).toContain('step=rejected')
    expect(logged()).toContain('"invalid":1')
    expect(logged()).not.toContain('member@landly.test')
  })

  it('swallows a network error', async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new TypeError('fetch failed'), { code: 'ECONNRESET' }))
    await expect(addSubscriber(MEMBER)).resolves.toBe('failed')
    expect(logged()).toContain('step=request')
    expect(logged()).toContain('ECONNRESET')
  })

  it('aborts after 10 seconds and reports a timeout', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    }))
    const pending = addSubscriber(MEMBER)
    await vi.advanceTimersByTimeAsync(9_999)
    expect(errorLog).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(await pending).toBe('failed')
    expect(logged()).toContain('"code":"timeout"')
  })

  it('retries a refused Bearer once with the signed header when the full key set is configured', async () => {
    vi.stubEnv('RESPONDER_CLIENT_ID', 'client-id')
    vi.stubEnv('RESPONDER_CLIENT_SECRET', 'client-secret')
    vi.stubEnv('RESPONDER_USER_SECRET', 'user-secret')
    fetchMock.mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(created())
    expect(await addSubscriber(MEMBER)).toBe('created')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const auth = (fetchMock.mock.calls[1][1] as RequestInit & { headers: Record<string, string> }).headers.Authorization
    const parts = Object.fromEntries(auth.split(',').map((p) => p.split('=').map(decodeURIComponent)))
    expect(parts).toMatchObject({ c_key: 'client-id', u_key: 'user-token' })
    expect(parts.nonce).toMatch(/^[0-9a-f]{32}$/)
    expect(parts.timestamp).toMatch(/^\d{10}$/)
    expect(parts.c_secret).toBe(createHash('md5').update('client-secret' + parts.nonce).digest('hex'))
    expect(parts.u_secret).toBe(createHash('md5').update('user-secret' + parts.nonce).digest('hex'))
  })

  it('does not retry a refused Bearer without the full key set', async () => {
    vi.stubEnv('RESPONDER_CLIENT_ID', 'client-id')
    vi.stubEnv('RESPONDER_CLIENT_SECRET', 'client-secret')
    fetchMock.mockResolvedValueOnce(json({}, 401))
    expect(await addSubscriber(MEMBER)).toBe('failed')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(logged()).toContain('"status":401')
  })
})
