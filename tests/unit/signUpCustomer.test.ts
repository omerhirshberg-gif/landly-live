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
  it('returns as soon as the account exists, with the code request still in flight', async () => {
    // A send that never settles: sign-up must not wait for it.
    fetchMock.mockReturnValue(new Promise(() => {}))
    const result = await signUpCustomer(NAMES, 'new@example.com', 'secret123', 'he', 'https://api.test')

    expect(result.email).toBe('new@example.com')
    expect(result.idToken).toBe('id-token')
    expect(result.send).toBeInstanceOf(Promise)
    expect(mocks.signOut).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/api/auth/send-signup-otp',
      expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer id-token' }) })
    )
  })

  it('sends the normalized first and last name with the first code request', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}))
    await signUpCustomer(NAMES, 'new@example.com', 'secret123', 'fr', 'https://api.test')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(JSON.parse(init.body as string)).toEqual({ lang: 'fr', firstName: 'Dana', lastName: 'Levi', agreedToTerms: false, marketingOptIn: false })
  })

  it('sends the marketing opt-in only when the box was ticked', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}))
    await signUpCustomer({ ...NAMES, agreedToTerms: true, marketingOptIn: true }, 'new@example.com', 'secret123', 'he', 'https://api.test')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(JSON.parse(init.body as string)).toMatchObject({ agreedToTerms: true, marketingOptIn: true })
  })

  it('passes the Terms/Privacy consent along with the names', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}))
    await signUpCustomer({ ...NAMES, agreedToTerms: true }, 'new@example.com', 'secret123', 'en', 'https://api.test')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(JSON.parse(init.body as string)).toMatchObject({ agreedToTerms: true })
  })

  it('takes the token before signing out, and the send still completes', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, type: 'basic', url: '/api/auth/send-signup-otp', json: async () => ({ ok: true, resendIn: 60 }) })
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
    await expect(result.send).resolves.toEqual({ ok: true, resendIn: 60 })
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
