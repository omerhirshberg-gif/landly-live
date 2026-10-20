import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addSubscriber } from '@/lib/responder/addSubscriber'

const MEMBER = { uid: 'member-1', email: 'member@landly.test', firstName: ' Dana ' }
const BASE = 'https://graph.responder.live/v2'
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
// The shapes Responder Live answered with in the live check.
const token = () => json({ id: 1, token: 'jwt-token', expire: '2026-10-21 00:00:00' })
const created = () => json({ status: true, duplicate: false, createdId: '24136180', capacity: true })
const duplicate = () => json({ status: true, duplicate: true, createdId: 24136180, capacity: true })

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
  return { url, init, body: JSON.parse(init.body as string) }
}

describe('addSubscriber', () => {
  it('exchanges the credentials for a token, then creates the subscriber in the list', async () => {
    fetchMock.mockResolvedValueOnce(token()).mockResolvedValueOnce(created())
    expect(await addSubscriber(MEMBER)).toBe('created')
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const auth = call(0)
    expect(auth.url).toBe(`${BASE}/oauth/token`)
    expect(auth.init.method).toBe('POST')
    expect(auth.init.headers).not.toHaveProperty('Authorization')
    expect(auth.body).toEqual({ client_id: '123', client_secret: 'client-secret', user_token: 'user-token', grant_type: 'client_credentials' })

    const create = call(1)
    expect(create.url).toBe(`${BASE}/subscribers`)
    expect(create.init.method).toBe('POST')
    expect(create.init.headers).toMatchObject({ Authorization: 'Bearer jwt-token', 'Content-Type': 'application/json' })
    expect(create.init.signal).toBeInstanceOf(AbortSignal)
    expect(create.body).toEqual({ email: 'member@landly.test', first: 'Dana', list_ids: [125246] })
    expect(errorLog.mock.calls).toHaveLength(0)
  })

  it('prefers RESPONDER_CLIENT_ID and honours an overridden API base', async () => {
    vi.stubEnv('RESPONDER_CLIENT_ID', '456')
    vi.stubEnv('RESPONDER_API_BASE', 'https://api.example.test/v3/')
    fetchMock.mockResolvedValueOnce(token()).mockResolvedValueOnce(created())
    expect(await addSubscriber(MEMBER)).toBe('created')
    expect(call(0).body.client_id).toBe('456')
    expect(call(0).url).toBe('https://api.example.test/v3/oauth/token')
    expect(call(1).url).toBe('https://api.example.test/v3/subscribers')
  })

  it('is a silent no-op when any setting is missing', async () => {
    for (const name of Object.keys(SETTINGS)) {
      vi.stubEnv(name, '')
      expect(await addSubscriber(MEMBER), name).toBe('skipped')
      vi.stubEnv(name, SETTINGS[name as keyof typeof SETTINGS])
    }
    vi.stubEnv('RESPONDER_LIST_ID', 'not-a-number')
    expect(await addSubscriber(MEMBER)).toBe('skipped')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(errorLog.mock.calls).toHaveLength(0)
  })

  it('treats an address already in the list as success', async () => {
    fetchMock.mockResolvedValueOnce(token()).mockResolvedValueOnce(duplicate())
    expect(await addSubscriber(MEMBER)).toBe('existing')
    expect(errorLog.mock.calls).toHaveLength(0)
  })

  it('fails on a 200 that Responder marks {status: false}', async () => {
    fetchMock.mockResolvedValueOnce(token()).mockResolvedValueOnce(json({ status: false }))
    expect(await addSubscriber(MEMBER)).toBe('failed')
    expect(logged()).toContain('step=http')
    expect(logged()).toContain('"status":200')
    expect(logged()).toContain('"accepted":false')
  })

  it('logs a refused token with Responder\'s message and stops', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: 'Could not authenticate user' }, 401))
    expect(await addSubscriber(MEMBER)).toBe('failed')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(logged()).toContain('step=token')
    expect(logged()).toContain('"status":401')
    expect(logged()).toContain('Could not authenticate user')
  })

  it('logs a 400 with Responder\'s message, masking addresses and never the name', async () => {
    fetchMock.mockResolvedValueOnce(token()).mockResolvedValueOnce(json({
      type: 'App\\Exceptions\\ResponderException', status: false, data: ['Email address member@landly.test is invalid'], message: '', code: 400,
    }, 400))
    expect(await addSubscriber(MEMBER)).toBe('failed')
    expect(logged()).toContain('step=http')
    expect(logged()).toContain('"status":400')
    expect(logged()).toContain('Email address <email> is invalid')
    expect(logged()).toContain('"code":400')
    expect(logged()).toContain('member-1')
    expect(logged()).not.toContain('member@landly.test')
    expect(logged()).not.toContain('Dana')
  })

  it('logs a plain-text error body', async () => {
    fetchMock.mockResolvedValueOnce(token()).mockResolvedValueOnce(new Response('"Invalid consumer key"', { status: 400 }))
    expect(await addSubscriber(MEMBER)).toBe('failed')
    expect(logged()).toContain('Invalid consumer key')
  })

  it('swallows a network error', async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new TypeError('fetch failed'), { code: 'ECONNRESET' }))
    await expect(addSubscriber(MEMBER)).resolves.toBe('failed')
    expect(logged()).toContain('step=request')
    expect(logged()).toContain('ECONNRESET')
  })

  it('aborts after 10 seconds across both calls and reports a timeout', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementationOnce(async () => {
      await new Promise((resolve) => setTimeout(resolve, 6_000))
      return token()
    })
    fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    }))
    const pending = addSubscriber(MEMBER)
    await vi.advanceTimersByTimeAsync(9_999)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(errorLog.mock.calls).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(await pending).toBe('failed')
    expect(logged()).toContain('"code":"timeout"')
  })
})
