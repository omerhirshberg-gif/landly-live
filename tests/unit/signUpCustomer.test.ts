import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  getIdToken: vi.fn(),
}))

vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: mocks.createUserWithEmailAndPassword,
  signOut: mocks.signOut,
}))
vi.mock('@/lib/firebase/config', () => ({ auth: { name: 'test-auth' } }))

import { signUpCustomer } from '@/lib/auth/signUpCustomer'
import { requestVerificationEmail, VERIFICATION_SEND_TIMEOUT_MS } from '@/lib/auth/requestVerificationEmail'
import { normalizeApiBaseUrl } from '@/lib/apiOrigin'

const fetchMock = vi.fn()
const NAMES = { firstName: ' Dana ', lastName: 'Levi' }

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  mocks.getIdToken.mockResolvedValue('id-token')
  mocks.createUserWithEmailAndPassword.mockResolvedValue({
    user: { email: 'new@example.com', getIdToken: mocks.getIdToken },
  })
  mocks.signOut.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('signUpCustomer', () => {
  it('returns as soon as the account exists, with the email request still in flight', async () => {
    // A send that never settles: sign-up must not wait for it.
    fetchMock.mockReturnValue(new Promise(() => {}))
    const result = await signUpCustomer(NAMES, 'new@example.com', 'secret123', 'he', 'https://api.test')

    expect(result.email).toBe('new@example.com')
    expect(result.idToken).toBe('id-token')
    expect(result.send).toBeInstanceOf(Promise)
    expect(mocks.signOut).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/api/auth/send-verification',
      expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer id-token' }) })
    )
  })

  it('sends the normalized first and last name with the first verification request', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}))
    await signUpCustomer(NAMES, 'new@example.com', 'secret123', 'fr', 'https://api.test')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(JSON.parse(init.body as string)).toEqual({ lang: 'fr', firstName: 'Dana', lastName: 'Levi', agreedToTerms: false })
  })

  it('passes the Terms/Privacy consent along with the names', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}))
    await signUpCustomer({ ...NAMES, agreedToTerms: true }, 'new@example.com', 'secret123', 'en', 'https://api.test')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(JSON.parse(init.body as string)).toMatchObject({ agreedToTerms: true })
  })

  it('takes the token before signing out, and the send still completes', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, type: 'basic', url: '/api/auth/send-verification' })
    const order: string[] = []
    mocks.getIdToken.mockImplementation(async () => {
      order.push('token')
      return 'id-token'
    })
    mocks.signOut.mockImplementation(async () => {
      order.push('signOut')
    })

    const result = await signUpCustomer(NAMES, 'new@example.com', 'secret123', 'en')
    expect(order).toEqual(['token', 'signOut'])
    await expect(result.send).resolves.toBe('sent')
  })

  it('still signs out when the token cannot be read', async () => {
    mocks.getIdToken.mockRejectedValue(new Error('network'))
    await expect(signUpCustomer(NAMES, 'new@example.com', 'secret123', 'en')).rejects.toThrow('network')
    expect(mocks.signOut).toHaveBeenCalledTimes(1)
  })

  it('leaves no session behind when Firebase rejects the account', async () => {
    mocks.createUserWithEmailAndPassword.mockRejectedValue(Object.assign(new Error('taken'), { code: 'auth/email-already-in-use' }))
    await expect(signUpCustomer(NAMES, 'new@example.com', 'secret123', 'en')).rejects.toThrow('taken')
    expect(mocks.signOut).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('requestVerificationEmail', () => {
  it('sends only the language on a resend (no names)', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, type: 'basic', url: '/api/auth/send-verification' })
    await requestVerificationEmail('id-token', 'he')
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ lang: 'he' })
  })

  it('gives up and reports no connection once the timeout passes', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.useFakeTimers()
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        })
    )
    const pending = requestVerificationEmail('id-token', 'en')
    await vi.advanceTimersByTimeAsync(VERIFICATION_SEND_TIMEOUT_MS - 1)
    let settled = false
    void pending.then(() => (settled = true))
    await Promise.resolve()
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await expect(pending).resolves.toBe('offline')
  })

  it('reports a network error as no connection', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    fetchMock.mockRejectedValue(new TypeError('Network request failed'))
    await expect(requestVerificationEmail('id-token', 'en', 'https://www.api.test')).resolves.toBe('offline')
  })

  it('rewrites an apex golandly.com base to the www host before sending', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, type: 'default', url: 'https://www.golandly.com/api/auth/send-verification' })
    for (const base of ['https://golandly.com', 'http://golandly.com/', 'https://GOLANDLY.com']) {
      await expect(requestVerificationEmail('id-token', 'en', base)).resolves.toBe('sent')
      expect(fetchMock).toHaveBeenLastCalledWith('https://www.golandly.com/api/auth/send-verification', expect.anything())
    }
    expect(normalizeApiBaseUrl('https://www.golandly.com/')).toBe('https://www.golandly.com')
    expect(normalizeApiBaseUrl('https://notgolandly.com')).toBe('https://notgolandly.com')
    expect(normalizeApiBaseUrl('http://192.168.1.20:3000')).toBe('http://192.168.1.20:3000')
    expect(normalizeApiBaseUrl('')).toBe('')
  })

  it('retries once at the production host, token included, when a remote base redirects', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    // React Native's fetch follows the redirect and lands on another URL without the token.
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 401, type: 'default', url: 'https://tunnel.example/api/auth/send-verification' })
      .mockResolvedValueOnce({ ok: true, status: 200, type: 'default', url: 'https://www.golandly.com/api/auth/send-verification' })
    await expect(requestVerificationEmail('id-token', 'en', 'https://old.example')).resolves.toBe('sent')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://www.golandly.com/api/auth/send-verification',
      expect.objectContaining({ redirect: 'manual', headers: expect.objectContaining({ Authorization: 'Bearer id-token' }) })
    )
  })

  it('reports misconfigured only when the fallback redirects too, without a console error', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error')
    fetchMock.mockResolvedValue({ ok: false, status: 0, type: 'opaqueredirect', url: '' })
    await expect(requestVerificationEmail('id-token', 'en', 'https://api.test')).resolves.toBe('misconfigured')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(warn).toHaveBeenCalled()
    // React Native shows console.error as a redbox.
    expect(error).not.toHaveBeenCalled()
  })

  it('does not fall back to production for same-origin web calls', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    fetchMock.mockResolvedValue({ ok: false, status: 0, type: 'opaqueredirect', url: '' })
    await expect(requestVerificationEmail('id-token', 'en')).resolves.toBe('misconfigured')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('logs every unsuccessful send in development, with URL, status and body but never the token', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const url = 'http://192.168.7.57:3000/api/auth/send-verification'
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      type: 'default',
      url,
      text: async () => JSON.stringify({ error: 'Could not send verification email.', reason: 'provider' }),
    })
    await expect(requestVerificationEmail('secret-id-token', 'en', 'http://192.168.7.57:3000')).resolves.toBe('failed')
    expect(warn).toHaveBeenCalledWith(`[verification] POST ${url} -> 502 failed`, { error: 'Could not send verification email.', reason: 'provider' })

    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, type: 'default', url, text: async () => 'Unauthorized' })
    await requestVerificationEmail('secret-id-token', 'en', 'http://192.168.7.57:3000')
    expect(warn).toHaveBeenLastCalledWith(`[verification] POST ${url} -> 401 unauthorized`, 'Unauthorized')

    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'))
    await requestVerificationEmail('secret-id-token', 'en', 'http://192.168.7.57:3000')
    expect(warn).toHaveBeenLastCalledWith(`[verification] POST ${url} -> no response (network error): offline`, 'TypeError: Network request failed')

    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret-id-token')
  })

  it('stays quiet when the email is sent', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    fetchMock.mockResolvedValue({ ok: true, status: 200, type: 'default', url: 'https://www.golandly.com/api/auth/send-verification' })
    await expect(requestVerificationEmail('id-token', 'en', 'https://www.golandly.com')).resolves.toBe('sent')
    expect(warn).not.toHaveBeenCalled()
  })

  it('maps response statuses', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    for (const [status, ok, expected] of [
      [200, true, 'sent'],
      [429, false, 'rateLimited'],
      [401, false, 'unauthorized'],
      [502, false, 'failed'],
    ] as const) {
      fetchMock.mockResolvedValueOnce({ ok, status, type: 'default', url: 'https://www.api.test/api/auth/send-verification' })
      await expect(requestVerificationEmail('id-token', 'en', 'https://www.api.test')).resolves.toBe(expected)
    }
  })
})
