import { beforeEach, describe, expect, it, vi } from 'vitest'
import { translations } from '@/lib/i18n/translations'
import { parseWebAuthnConfig } from '@/lib/auth/webauthn/config'
import { isRecentSignIn, RECENT_SIGN_IN_MS } from '@/lib/auth/webauthn/recentSignIn'
import { passkeyName } from '@/lib/auth/webauthn/passkeyNames'

const admin = vi.hoisted(() => ({
  createCustomToken: vi.fn(async (uid: string) => `token-for-${uid}`),
  getUser: vi.fn(),
  businessExists: false,
}))
const store = vi.hoisted(() => ({
  consumeChallenge: vi.fn(),
  saveChallenge: vi.fn(async () => 'challenge-id-0123456789'),
  getPasskey: vi.fn(),
  recordPasskeyUse: vi.fn(async () => {}),
  listPasskeys: vi.fn(async () => []),
  ensureWebAuthnUserId: vi.fn(async () => 'handle'),
}))
const webauthn = vi.hoisted(() => ({
  verifyAuthenticationResponse: vi.fn(),
  generateRegistrationOptions: vi.fn(async () => ({ challenge: 'reg-challenge' })),
  generateAuthenticationOptions: vi.fn(async () => ({ challenge: 'login-challenge' })),
}))
const requester = vi.hoisted(() => ({ decoded: { uid: 'member', auth_time: 0 } as { uid: string; auth_time: number } }))

vi.mock('@/lib/firebase/admin', () => ({
  getAdminAuth: () => ({ createCustomToken: admin.createCustomToken, getUser: admin.getUser }),
  getAdminDb: () => ({ collection: () => ({ doc: () => ({ get: async () => ({ exists: admin.businessExists }) }) }) }),
}))
vi.mock('@/lib/auth/webauthn/challenges', () => ({ consumeChallenge: store.consumeChallenge, saveChallenge: store.saveChallenge }))
vi.mock('@/lib/auth/webauthn/passkeys', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/webauthn/passkeys')>()),
  getPasskey: store.getPasskey,
  recordPasskeyUse: store.recordPasskeyUse,
  listPasskeys: store.listPasskeys,
  ensureWebAuthnUserId: store.ensureWebAuthnUserId,
}))
vi.mock('@simplewebauthn/server', () => webauthn)
vi.mock('@/lib/firebase/verifyRequestUser', () => ({
  RequestAuthError: class extends Error {},
  requireVerifiedCustomer: async () => requester.decoded,
}))

const CREDENTIAL = 'credential-id-0123456789'
const PASSKEY = { uid: 'member', webauthnUserId: 'handle', publicKey: new Uint8Array([1]), counter: 4, transports: ['internal'] }
const post = (body: unknown) => new Request('https://www.golandly.com/api', { method: 'POST', body: JSON.stringify(body) })
const signInBody = (userHandle = 'handle') => ({ challengeId: 'challenge-id-0123456789', response: { id: CREDENTIAL, response: { userHandle } } })

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('WEBAUTHN_RP_ID', 'golandly.com')
  vi.stubEnv('WEBAUTHN_ORIGINS', 'https://www.golandly.com,https://golandly.com')
  admin.businessExists = false
  admin.getUser.mockResolvedValue({ disabled: false, emailVerified: true })
  store.consumeChallenge.mockResolvedValue('login-challenge')
  store.getPasskey.mockResolvedValue(PASSKEY)
  webauthn.verifyAuthenticationResponse.mockResolvedValue({ verified: true, authenticationInfo: { newCounter: 5 } })
})

describe('relying party config', () => {
  it('takes the RP ID and origins from the environment', () => {
    expect(parseWebAuthnConfig({ WEBAUTHN_RP_ID: 'GoLandly.com', WEBAUTHN_ORIGINS: 'https://www.golandly.com/, https://golandly.com' })).toEqual({
      rpID: 'golandly.com',
      rpName: 'Landly',
      origins: ['https://www.golandly.com', 'https://golandly.com'],
    })
  })
  it('falls back to APP_URL for local development and staging', () => {
    expect(parseWebAuthnConfig({ APP_URL: 'http://localhost:3000' })).toEqual({ rpID: 'localhost', rpName: 'Landly', origins: ['http://localhost:3000'] })
  })
  it('is off without a host, and refuses origins outside the RP ID', () => {
    expect(parseWebAuthnConfig({})).toBeNull()
    expect(parseWebAuthnConfig({ WEBAUTHN_RP_ID: 'golandly.com', WEBAUTHN_ORIGINS: 'https://evil-golandly.com' })).toBeNull()
    expect(parseWebAuthnConfig({ WEBAUTHN_RP_ID: 'golandly.com', WEBAUTHN_ORIGINS: 'not a url' })).toBeNull()
  })
})

describe('recent sign-in for adding a passkey', () => {
  const now = Date.UTC(2026, 9, 22, 12)
  it('accepts a sign-in from the last 10 minutes only', () => {
    expect(isRecentSignIn(now / 1000 - 60, now)).toBe(true)
    expect(isRecentSignIn((now - RECENT_SIGN_IN_MS) / 1000 + 1, now)).toBe(true)
    expect(isRecentSignIn((now - RECENT_SIGN_IN_MS) / 1000 - 1, now)).toBe(false)
    expect(isRecentSignIn(undefined, now)).toBe(false)
    expect(isRecentSignIn(now / 1000 + 3600, now)).toBe(false)
  })
})

describe('passkey names', () => {
  it('names synced passkeys by their password manager, others by browser and OS', () => {
    expect(passkeyName('FBFC3007-154E-4ECC-8C0B-6E020557D7BD', '')).toBe('iCloud Keychain')
    expect(passkeyName('ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4', '')).toBe('Google Password Manager')
    const chromeMac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
    expect(passkeyName('00000000-0000-0000-0000-000000000000', chromeMac)).toBe('Chrome · macOS')
    expect(passkeyName(null, null)).toBe('Passkey')
  })
})

describe('passkey sign-in (login-verify)', () => {
  const route = () => import('@/app/api/auth/passkey/login-verify/route')

  it('mints a custom token for a verified customer and records the new counter', async () => {
    const res = await (await route()).POST(post(signInBody()))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ customToken: 'token-for-member' })
    expect(store.recordPasskeyUse).toHaveBeenCalledWith(CREDENTIAL, 5)
    expect(webauthn.verifyAuthenticationResponse).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRPID: 'golandly.com', expectedOrigin: ['https://www.golandly.com', 'https://golandly.com'], requireUserVerification: true })
    )
  })

  it('refuses a used or expired challenge before looking at the passkey', async () => {
    store.consumeChallenge.mockResolvedValue(null)
    const res = await (await route()).POST(post(signInBody()))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('challenge_expired')
    expect(store.getPasskey).not.toHaveBeenCalled()
  })

  it('tells the browser about a passkey the server no longer has', async () => {
    store.getPasskey.mockResolvedValue(null)
    const res = await (await route()).POST(post(signInBody()))
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'unknown_credential', rpId: 'golandly.com' })
  })

  it('rejects a response whose user handle belongs to another account', async () => {
    const res = await (await route()).POST(post(signInBody('someone-else')))
    expect(res.status).toBe(400)
    expect(webauthn.verifyAuthenticationResponse).not.toHaveBeenCalled()
  })

  it('rejects a failed signature check', async () => {
    webauthn.verifyAuthenticationResponse.mockRejectedValue(new Error('Response counter value 3 was lower than expected 4'))
    const res = await (await route()).POST(post(signInBody()))
    expect(res.status).toBe(400)
    expect(admin.createCustomToken).not.toHaveBeenCalled()
  })

  it.each([
    ['business_account', () => { admin.businessExists = true }],
    ['unverified', () => admin.getUser.mockResolvedValue({ disabled: false, emailVerified: false })],
    ['account_disabled', () => admin.getUser.mockResolvedValue({ disabled: true, emailVerified: true })],
  ])('applies the customer sign-in rules: %s', async (error, arrange) => {
    arrange()
    const res = await (await route()).POST(post(signInBody()))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe(error)
    expect(admin.createCustomToken).not.toHaveBeenCalled()
  })

  it('answers 503 when passkeys are not configured', async () => {
    vi.stubEnv('WEBAUTHN_RP_ID', '')
    vi.stubEnv('WEBAUTHN_ORIGINS', '')
    vi.stubEnv('APP_URL', '')
    const res = await (await route()).POST(post(signInBody()))
    expect(res.status).toBe(503)
  })
})

describe('adding a passkey (register-options)', () => {
  const route = () => import('@/app/api/auth/passkey/register-options/route')

  it('asks for a fresh sign-in when the session is older than 10 minutes', async () => {
    requester.decoded = { uid: 'stale-member', auth_time: Math.floor((Date.now() - RECENT_SIGN_IN_MS - 60_000) / 1000) }
    const res = await (await route()).POST(post({}))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('reauth_required')
    expect(webauthn.generateRegistrationOptions).not.toHaveBeenCalled()
  })

  it('issues discoverable, user-verified options bound to the member', async () => {
    requester.decoded = { uid: 'fresh-member', auth_time: Math.floor(Date.now() / 1000) - 30 }
    admin.getUser.mockResolvedValue({ email: 'dana@example.com', displayName: 'Dana' })
    const res = await (await route()).POST(post({}))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ challengeId: 'challenge-id-0123456789', optionsJSON: { challenge: 'reg-challenge' } })
    expect(webauthn.generateRegistrationOptions).toHaveBeenCalledWith(
      expect.objectContaining({ rpID: 'golandly.com', userName: 'dana@example.com', authenticatorSelection: { residentKey: 'required', userVerification: 'required' } })
    )
    expect(store.saveChallenge).toHaveBeenCalledWith('reg-challenge', 'register', 'fresh-member')
  })
})

describe('passkey and app-lock copy', () => {
  const keys = Object.keys(translations.en).filter((k) => /^(login_passkey|passkey_|passkeys_|passkeyEmail_|applock_|security_signout_all_passkeys)/.test(k))
  it.each(Object.keys(translations) as (keyof typeof translations)[])('is complete in %s', (lang) => {
    expect(keys.length).toBeGreaterThan(50)
    for (const key of keys) expect((translations[lang] as Record<string, string>)[key], `${lang}.${key}`).toBeTruthy()
  })
  it('uses the agreed passkey wording on the sign-in button', () => {
    expect(translations.en.login_passkeyBtn).toBe('Sign in with a passkey')
    expect(translations.he.login_passkeyBtn).toBe('כניסה עם מפתח גישה (Passkey)')
  })
})
