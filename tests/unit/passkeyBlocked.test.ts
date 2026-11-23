import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const browser = vi.hoisted(() => ({
  startAuthentication: vi.fn(),
  startRegistration: vi.fn(),
}))

vi.mock('@simplewebauthn/browser', () => ({
  browserSupportsWebAuthn: () => true,
  browserSupportsWebAuthnAutofill: async () => true,
  sendSignal: vi.fn(),
  startAuthentication: browser.startAuthentication,
  startRegistration: browser.startRegistration,
  WebAuthnAbortService: { cancelCeremony: vi.fn() },
}))
vi.mock('firebase/auth', () => ({ setPersistence: vi.fn() }))
vi.mock('@/lib/firebase/config', () => ({ auth: {} }))
vi.mock('@/lib/auth/signInCustomer', () => ({ signInCustomerWithCustomToken: vi.fn() }))

import { addPasskey, signInWithPasskey } from '@/lib/auth/passkeyClient'

const notAllowed = () => Object.assign(new Error('refused'), { name: 'NotAllowedError' })
const user = { getIdToken: async () => 'token' } as never

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ status: 200, json: async () => ({ challengeId: 'c', optionsJSON: {} }) })),
  )
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('passkey refused by the browser', () => {
  it('reports blocked when adding is refused at once', async () => {
    browser.startRegistration.mockRejectedValue(notAllowed())
    expect(await addPasskey(user)).toEqual({ kind: 'error', code: 'blocked' })
  })

  it('stays silent when the member closes the sheet after a while', async () => {
    browser.startRegistration.mockImplementation(async () => {
      vi.advanceTimersByTime(5000)
      throw notAllowed()
    })
    expect(await addPasskey(user)).toEqual({ kind: 'cancelled' })
  })

  it('reports blocked for an instant refusal on the sign-in button', async () => {
    browser.startAuthentication.mockRejectedValue(notAllowed())
    const outcome = await signInWithPasskey({ autofill: false, lang: 'en', persistence: (() => null) as never })
    expect(outcome).toEqual({ kind: 'error', code: 'blocked' })
  })

  it('never reports blocked for the email-field autofill', async () => {
    browser.startAuthentication.mockRejectedValue(notAllowed())
    const outcome = await signInWithPasskey({ autofill: true, lang: 'en', persistence: (() => null) as never })
    expect(outcome).toEqual({ kind: 'cancelled' })
  })
})
