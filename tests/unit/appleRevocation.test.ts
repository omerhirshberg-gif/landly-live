import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  confirmAndRevokeWithPopup,
  confirmationFailure,
  hasAppleSignIn,
  isAppleRevocation,
  revokeAppleAuthorizationCode,
} from '@/lib/account/appleRevocation'
import { translations, type Lang } from '@/lib/i18n/translations'

// Revoking Sign in with Apple tokens when a member asks for deletion
// (App Store Review Guideline 5.1.1(v)), on every platform.
const read = (path: string) => readFileSync(path, 'utf8')
const codeError = (code: string) => Object.assign(new Error(code), { code })

describe('shared rules', () => {
  it('knows the three outcomes and which accounts have Apple tokens', () => {
    expect(['revoked', 'failed', 'unavailable'].every(isAppleRevocation)).toBe(true)
    expect(isAppleRevocation('done')).toBe(false)
    expect(hasAppleSignIn({ providerData: [{ providerId: 'apple.com' }] })).toBe(true)
    expect(hasAppleSignIn({ providerData: [{ providerId: 'google.com' }, { providerId: 'password' }] })).toBe(false)
  })

  it.each([
    ['auth/popup-closed-by-user', { status: 'cancelled' }],
    ['auth/cancelled-popup-request', { status: 'cancelled' }],
    ['auth/user-mismatch', { status: 'mismatch' }],
    ['auth/popup-blocked', { status: 'done', appleRevocation: 'unavailable' }],
    ['auth/operation-not-supported-in-this-environment', { status: 'done', appleRevocation: 'unavailable' }],
    ['auth/network-request-failed', { status: 'done', appleRevocation: 'failed' }],
  ])('sorts a failed confirmation (%s): only backing out or another Apple ID stops the request', (code, expected) => {
    expect(confirmationFailure(codeError(code))).toEqual(expected)
  })
})

describe('browser path: Apple popup, then Firebase revokes the access token', () => {
  const result = { user: { uid: 'a1' } } as never

  it('confirms first, then revokes the fresh access token', async () => {
    const order: string[] = []
    const revoke = vi.fn(async () => void order.push('revoke'))
    const outcome = await confirmAndRevokeWithPopup({
      reauthenticate: async () => (order.push('confirm'), result),
      accessTokenOf: () => 'apple-access-token',
      revoke,
    })
    expect(outcome).toEqual({ status: 'done', appleRevocation: 'revoked' })
    expect(order).toEqual(['confirm', 'revoke'])
    expect(revoke).toHaveBeenCalledWith('apple-access-token')
  })

  it.each([
    ['auth/popup-closed-by-user', { status: 'cancelled' }],
    ['auth/user-mismatch', { status: 'mismatch' }],
  ])('revokes nothing when the confirmation ends with %s', async (code, expected) => {
    const revoke = vi.fn()
    expect(await confirmAndRevokeWithPopup({ reauthenticate: async () => Promise.reject(codeError(code)), accessTokenOf: () => 'x', revoke })).toEqual(expected)
    expect(revoke).not.toHaveBeenCalled()
  })

  it('still lets the request go when there is no token or the revoke fails', async () => {
    const base = { reauthenticate: async () => result }
    expect(await confirmAndRevokeWithPopup({ ...base, accessTokenOf: () => null, revoke: vi.fn() })).toEqual({ status: 'done', appleRevocation: 'failed' })
    expect(
      await confirmAndRevokeWithPopup({ ...base, accessTokenOf: () => 'x', revoke: async () => Promise.reject(new Error('500')) })
    ).toEqual({ status: 'done', appleRevocation: 'failed' })
  })
})

describe('revokeAppleAuthorizationCode (Firebase endpoint, token type CODE)', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('posts the code with the member\'s ID token to this project\'s Firebase, no Apple secret involved', async () => {
    fetchMock.mockResolvedValue({ ok: true })
    expect(await revokeAppleAuthorizationCode({ apiKey: 'key-1', idToken: 'id-1', authorizationCode: 'code-1' })).toBe(true)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://identitytoolkit.googleapis.com/v2/accounts:revokeToken?key=key-1')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ providerId: 'apple.com', tokenType: 'CODE', token: 'code-1', idToken: 'id-1' })
  })

  it('reports false on a refusal or no connection', async () => {
    fetchMock.mockResolvedValue({ ok: false })
    expect(await revokeAppleAuthorizationCode({ apiKey: 'k', idToken: 'i', authorizationCode: 'c' })).toBe(false)
    fetchMock.mockRejectedValue(new Error('offline'))
    expect(await revokeAppleAuthorizationCode({ apiKey: 'k', idToken: 'i', authorizationCode: 'c' })).toBe(false)
  })
})

// The app's native module, with Expo and Firebase stood in for (resolved from
// the app's node_modules, Firebase by the file Node's import condition picks).
const native = vi.hoisted(() => ({
  platform: { OS: 'ios' },
  available: vi.fn(),
  signInAsync: vi.fn(),
  digest: vi.fn(),
  credential: vi.fn(),
  reauth: vi.fn(),
  revoke: vi.fn(),
}))
vi.mock('../../landly-mobile/node_modules/react-native', () => ({ Platform: native.platform }))
vi.mock('../../landly-mobile/node_modules/expo-apple-authentication', () => ({ isAvailableAsync: native.available, signInAsync: native.signInAsync }))
vi.mock('../../landly-mobile/node_modules/expo-crypto', () => ({
  getRandomBytes: (n: number) => new Uint8Array(n).fill(171),
  digestStringAsync: native.digest,
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}))
vi.mock('../../landly-mobile/node_modules/firebase/auth/dist/index.mjs', () => ({
  OAuthProvider: class {
    constructor(public providerId: string) {}
    credential(options: unknown) {
      return native.credential(this.providerId, options)
    }
  },
  reauthenticateWithCredential: native.reauth,
}))
vi.mock('@shared/firebase/config', () => ({ auth: { app: { options: { apiKey: 'project-api-key' } } } }))
vi.mock('@shared/account/appleRevocation', async () => {
  const real = await import('@/lib/account/appleRevocation')
  return { ...real, revokeAppleAuthorizationCode: native.revoke }
})

type NativeModule = { confirmAndRevokeApple: (user: unknown, lang: Lang) => Promise<unknown> }
// A runtime-only path: a typed import would pull React Native's globals into the root typecheck.
const loadNative = () => import('../../landly-mobile/src/auth/appleRevocation' as string) as Promise<NativeModule>
const member = { uid: 'a1', getIdToken: async () => 'member-id-token' }
const RAW_NONCE = 'ab'.repeat(32)

describe('app: iOS sheet, then the code is revoked; Android sends the request marked unavailable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    native.platform.OS = 'ios'
    native.available.mockResolvedValue(true)
    native.digest.mockResolvedValue('hashed')
    native.credential.mockReturnValue({ kind: 'apple' })
    native.reauth.mockResolvedValue({})
    native.revoke.mockResolvedValue(true)
    native.signInAsync.mockResolvedValue({ identityToken: 'apple-id-token', authorizationCode: 'apple-code' })
  })

  it('confirms the same account, then revokes its authorization code through Firebase', async () => {
    const { confirmAndRevokeApple } = await loadNative()
    expect(await confirmAndRevokeApple(member, 'he')).toEqual({ status: 'done', appleRevocation: 'revoked' })
    expect(native.signInAsync).toHaveBeenCalledWith({ requestedScopes: [], nonce: 'hashed' })
    expect(native.credential).toHaveBeenCalledWith('apple.com', { idToken: 'apple-id-token', rawNonce: RAW_NONCE })
    expect(native.reauth).toHaveBeenCalledWith(member, { kind: 'apple' })
    expect(native.revoke).toHaveBeenCalledWith({ apiKey: 'project-api-key', idToken: 'member-id-token', authorizationCode: 'apple-code' })
    expect(native.reauth.mock.invocationCallOrder[0]).toBeLessThan(native.revoke.mock.invocationCallOrder[0])
  })

  it('is unavailable on Android, without touching Apple', async () => {
    native.platform.OS = 'android'
    const { confirmAndRevokeApple } = await loadNative()
    expect(await confirmAndRevokeApple(member, 'en')).toEqual({ status: 'done', appleRevocation: 'unavailable' })
    expect(native.available).not.toHaveBeenCalled()
    expect(native.signInAsync).not.toHaveBeenCalled()
  })

  it('sends nothing when the member backs out of the sheet', async () => {
    native.signInAsync.mockRejectedValue(codeError('ERR_REQUEST_CANCELED'))
    const { confirmAndRevokeApple } = await loadNative()
    expect(await confirmAndRevokeApple(member, 'en')).toEqual({ status: 'cancelled' })
    expect(native.revoke).not.toHaveBeenCalled()
  })

  it('never revokes another Apple ID\'s code', async () => {
    native.reauth.mockRejectedValue(codeError('auth/user-mismatch'))
    const { confirmAndRevokeApple } = await loadNative()
    expect(await confirmAndRevokeApple(member, 'en')).toEqual({ status: 'mismatch' })
    expect(native.revoke).not.toHaveBeenCalled()
  })

  it('reports failed (and the request still goes) when the code is missing or Firebase refuses', async () => {
    const { confirmAndRevokeApple } = await loadNative()
    native.revoke.mockResolvedValue(false)
    expect(await confirmAndRevokeApple(member, 'en')).toEqual({ status: 'done', appleRevocation: 'failed' })
    native.signInAsync.mockResolvedValue({ identityToken: 'apple-id-token', authorizationCode: null })
    expect(await confirmAndRevokeApple(member, 'en')).toEqual({ status: 'done', appleRevocation: 'failed' })
  })
})

describe('the deletion forms', () => {
  const web = read('components/settings/DeleteAccountForm.tsx')
  const app = read('landly-mobile/src/components/DeleteAccountSheet.tsx')

  it('website: Apple accounts confirm with Apple before the request, which carries the outcome', () => {
    expect(web).toContain('const appleAccount = hasAppleSignIn(user)')
    expect(web).toMatch(/if \(appleAccount\) \{[\s\S]*?confirmAndRevokeAppleOnWeb\(user, lang\)[\s\S]*?if \(apple\.status !== 'done'\)[\s\S]*?return[\s\S]*?requestAccountDeletion\(/)
    expect(web).toContain('appleRevocation: revocation,')
    expect(web).toContain("t(appleAccount ? 'del_submit_apple' : 'del_submit')")
  })

  it('app: the same, with the plain button on Android and the Apple Account note when tokens remain', () => {
    expect(app).toContain("const confirmWithApple = appleAccount && Platform.OS !== 'android'")
    expect(app).toMatch(/if \(appleAccount\) \{[\s\S]*?confirmAndRevokeApple\(user, lang\)[\s\S]*?requestAccountDeletion\(idToken, \{ reason, details: details\.trim\(\), lang, appleRevocation: revocation \}/)
    expect(app).toContain("revocation && revocation !== 'revoked' ? `${t('del_success_body')}\\n\\n${t('del_apple_manual')}`")
  })

  it('names no Firebase project or Apple ID anywhere in the revocation code (DEV and PROD behave the same)', () => {
    for (const file of ['lib/account/appleRevocation.ts', 'lib/auth/appleWebRevocation.ts', 'landly-mobile/src/auth/appleRevocation.ts', 'landly-mobile/src/auth/appleRevocation.web.ts']) {
      expect(read(file), file).not.toMatch(/landly-dev|landly-be752|com\.amitbd|Q9PZFLL6GY|3299RTLRNH|BEGIN PRIVATE KEY/)
    }
  })

  it.each(Object.keys(translations) as Lang[])('has the Apple deletion copy, naming Apple (%s)', (lang) => {
    for (const key of ['del_submit_apple', 'del_apple_note', 'del_apple_mismatch', 'del_apple_manual'] as const) {
      expect(translations[lang][key], `${lang}.${key}`).toContain('Apple')
    }
  })
})
