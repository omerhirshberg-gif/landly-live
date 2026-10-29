import { beforeEach, describe, expect, it, vi } from 'vitest'
import { appleNameCacheKey, appleNamesFromCache, appleNamesFromNative, appleNamesFromWebResult, appleNamesToCache } from '@/lib/auth/appleName'
import { translations, type Lang } from '@/lib/i18n/translations'

// Native Sign in with Apple (landly-mobile/src/auth/appleSignIn.ts) with the
// Expo modules and Firebase stood in for; resolved from the app's own
// node_modules, as Metro would (Firebase by the file Node's import condition picks).
const mocks = vi.hoisted(() => ({
  platform: { OS: 'ios' },
  available: vi.fn(),
  signInAsync: vi.fn(),
  digest: vi.fn(),
  credential: vi.fn(),
  signInWithCredential: vi.fn(),
  finish: vi.fn(),
  store: new Map<string, string>(),
}))
vi.mock('../../landly-mobile/node_modules/react-native', () => ({ Platform: mocks.platform }))
vi.mock('../../landly-mobile/node_modules/expo-apple-authentication', () => ({
  isAvailableAsync: mocks.available,
  signInAsync: mocks.signInAsync,
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}))
vi.mock('../../landly-mobile/node_modules/expo-crypto', () => ({
  getRandomBytes: (n: number) => new Uint8Array(n).fill(171),
  digestStringAsync: mocks.digest,
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}))
vi.mock('../../landly-mobile/node_modules/expo-secure-store', () => ({
  setItemAsync: async (key: string, value: string) => void mocks.store.set(key, value),
  getItemAsync: async (key: string) => mocks.store.get(key) ?? null,
  deleteItemAsync: async (key: string) => void mocks.store.delete(key),
}))
vi.mock('../../landly-mobile/node_modules/firebase/auth/dist/index.mjs', () => ({
  OAuthProvider: class {
    constructor(public providerId: string) {}
    credential(options: unknown) {
      return mocks.credential(this.providerId, options)
    }
  },
  signInWithCredential: mocks.signInWithCredential,
}))
vi.mock('../../landly-mobile/node_modules/firebase/app/dist/index.mjs', () => ({
  FirebaseError: class extends Error {
    constructor(public code: string, message: string) {
      super(message)
    }
  },
}))
// The app's @shared/* alias (landly-mobile/tsconfig.json) points at ../lib.
vi.mock('@shared/firebase/config', () => ({ auth: { name: 'auth' } }))
vi.mock('@shared/auth/signInCustomer', () => ({ finishCustomerOAuthSignIn: mocks.finish }))
vi.mock('@shared/auth/appleName', () => import('@/lib/auth/appleName'))

type AppleModule = {
  isAppleSignInAvailable: () => Promise<boolean>
  signInWithApple: (lang: Lang) => Promise<unknown>
}
// A runtime-only path: a typed import would pull React Native's globals into the root typecheck.
const load = () => import('../../landly-mobile/src/auth/appleSignIn' as string) as Promise<AppleModule>

const RAW_NONCE = 'ab'.repeat(32)
const APPLE_USER = '001234.abcdef0123456789.0567'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.store.clear()
  mocks.platform.OS = 'ios'
  mocks.available.mockResolvedValue(true)
  mocks.digest.mockResolvedValue('hashed-nonce')
  mocks.credential.mockReturnValue({ kind: 'apple-credential' })
  mocks.signInWithCredential.mockResolvedValue({ user: { uid: 'a1' } })
  mocks.finish.mockResolvedValue({ status: 'signedIn' })
})

describe('native Sign in with Apple', () => {
  it('is offered on iOS when the device supports it', async () => {
    const { isAppleSignInAvailable } = await load()
    expect(await isAppleSignInAvailable()).toBe(true)
    mocks.available.mockRejectedValue(new Error('no module'))
    expect(await isAppleSignInAvailable()).toBe(false)
  })

  it('is never offered on Android, without touching the native module', async () => {
    mocks.platform.OS = 'android'
    const { isAppleSignInAvailable } = await load()
    expect(await isAppleSignInAvailable()).toBe(false)
    expect(mocks.available).not.toHaveBeenCalled()
  })

  it('sends Apple the hashed nonce and Firebase the raw one, then runs the shared rules with the name', async () => {
    mocks.signInAsync.mockResolvedValue({ user: APPLE_USER, identityToken: 'id-token', fullName: { givenName: 'נועה', familyName: 'לוי' } })
    const { signInWithApple } = await load()
    expect(await signInWithApple('he')).toEqual({ status: 'signedIn' })
    expect(mocks.digest).toHaveBeenCalledWith('SHA-256', RAW_NONCE)
    expect(mocks.signInAsync).toHaveBeenCalledWith({ requestedScopes: [0, 1], nonce: 'hashed-nonce' })
    expect(mocks.credential).toHaveBeenCalledWith('apple.com', { idToken: 'id-token', rawNonce: RAW_NONCE })
    expect(mocks.signInWithCredential).toHaveBeenCalledWith({ name: 'auth' }, { kind: 'apple-credential' })
    expect(mocks.finish).toHaveBeenCalledWith({ user: { uid: 'a1' } }, 'he', { names: { firstName: 'נועה', lastName: 'לוי' } })
    // Stored, so nothing is kept on the device.
    expect(mocks.store.size).toBe(0)
  })

  it("keeps Apple's one-time name through a failed sign-in and uses it on the next", async () => {
    mocks.signInAsync.mockResolvedValueOnce({ user: APPLE_USER, identityToken: 'id-token', fullName: { givenName: 'Noa', familyName: 'Levi' } })
    mocks.signInWithCredential.mockRejectedValueOnce(Object.assign(new Error('audience'), { code: 'auth/invalid-credential' }))
    const { signInWithApple } = await load()
    await expect(signInWithApple('en')).rejects.toMatchObject({ code: 'auth/invalid-credential' })
    expect(mocks.store.get(appleNameCacheKey(APPLE_USER))).toBe(appleNamesToCache({ firstName: 'Noa', lastName: 'Levi' }))
    // Apple sends no name the second time; the kept one goes to the profile, then is dropped.
    mocks.signInAsync.mockResolvedValueOnce({ user: APPLE_USER, identityToken: 'id-token', fullName: { givenName: null, familyName: null } })
    await signInWithApple('en')
    expect(mocks.finish).toHaveBeenLastCalledWith({ user: { uid: 'a1' } }, 'en', { names: { firstName: 'Noa', lastName: 'Levi' } })
    expect(mocks.store.size).toBe(0)
  })

  it('keeps the name when the profile write fails after Firebase signed in', async () => {
    mocks.signInAsync.mockResolvedValue({ user: APPLE_USER, identityToken: 'id-token', fullName: { givenName: 'Noa', familyName: 'Levi' } })
    mocks.finish.mockRejectedValueOnce(new Error('offline'))
    const { signInWithApple } = await load()
    await expect(signInWithApple('en')).rejects.toThrow('offline')
    expect(mocks.store.has(appleNameCacheKey(APPLE_USER))).toBe(true)
  })

  it('passes no name on a returning sign-in', async () => {
    mocks.signInAsync.mockResolvedValue({ user: APPLE_USER, identityToken: 'id-token', fullName: { givenName: null, familyName: null } })
    const { signInWithApple } = await load()
    await signInWithApple('en')
    expect(mocks.finish).toHaveBeenCalledWith({ user: { uid: 'a1' } }, 'en', { names: null })
  })

  it('reports a cancelled sheet as a cancelled sign-in', async () => {
    mocks.signInAsync.mockRejectedValue(Object.assign(new Error('canceled'), { code: 'ERR_REQUEST_CANCELED' }))
    const { signInWithApple } = await load()
    await expect(signInWithApple('en')).rejects.toMatchObject({ code: 'auth/popup-closed-by-user' })
    expect(mocks.signInWithCredential).not.toHaveBeenCalled()
  })

  it('refuses a response without an identity token', async () => {
    mocks.signInAsync.mockResolvedValue({ user: APPLE_USER, identityToken: null, fullName: null })
    const { signInWithApple } = await load()
    await expect(signInWithApple('en')).rejects.toThrow('no identity token')
    expect(mocks.signInWithCredential).not.toHaveBeenCalled()
  })
})

describe('Apple names', () => {
  it('reads the first-time name from a web result, as parts or as a whole', () => {
    expect(appleNamesFromWebResult({ _tokenResponse: { firstName: '  Noa\n', lastName: 'Levi ' } })).toEqual({ firstName: 'Noa', lastName: 'Levi' })
    expect(appleNamesFromWebResult({ _tokenResponse: { fullName: 'Dana Bat Cohen' } })).toEqual({ firstName: 'Dana', lastName: 'Bat Cohen' })
    expect(appleNamesFromWebResult({ _tokenResponse: { displayName: 'Yael' } })).toEqual({ firstName: 'Yael', lastName: '' })
  })

  it('gives null when Apple sent no name', () => {
    expect(appleNamesFromWebResult({ _tokenResponse: {} })).toBeNull()
    expect(appleNamesFromWebResult({ _tokenResponse: { firstName: '   ' } })).toBeNull()
    expect(appleNamesFromWebResult({})).toBeNull()
    expect(appleNamesFromWebResult(null)).toBeNull()
    expect(appleNamesFromNative(null)).toBeNull()
    expect(appleNamesFromNative({ givenName: null, familyName: null })).toBeNull()
  })

  it('never takes an email for a name', () => {
    expect(appleNamesFromWebResult({ _tokenResponse: { displayName: 'x7@privaterelay.appleid.com' } })).toBeNull()
    expect(appleNamesFromNative({ givenName: 'a@b.com', familyName: 'Levi' })).toEqual({ firstName: '', lastName: 'Levi' })
  })

  it('reads a kept name back only when it is well formed', () => {
    expect(appleNamesFromCache(appleNamesToCache({ firstName: 'נועה', lastName: 'לוי' }))).toEqual({ firstName: 'נועה', lastName: 'לוי' })
    expect(appleNamesFromCache(JSON.stringify({ firstName: '  Noa\n', lastName: 7 }))).toEqual({ firstName: 'Noa', lastName: '' })
    for (const raw of [null, undefined, '', '{', 'null', '[]', '"Noa"', JSON.stringify({ firstName: 'x@privaterelay.appleid.com' })]) {
      expect(appleNamesFromCache(raw), String(raw)).toBeNull()
    }
    // SecureStore keys allow only letters, digits, '.', '-' and '_'.
    expect(appleNameCacheKey('001234.abc/def 0567')).toBe('apple.name.001234.abc_def_0567')
  })

  it('caps a long name like a typed one', () => {
    expect(appleNamesFromNative({ givenName: 'A'.repeat(80), familyName: 'B' })?.firstName).toHaveLength(50)
  })
})

describe('Apple strings', () => {
  it.each(Object.keys(translations) as Lang[])('every language has the Apple sign-in copy, naming Apple in Latin script (%s)', (lang) => {
    const t = translations[lang]
    for (const key of ['login_appleBtn', 'signup_appleBtn', 'auth_appleFinishing', 'auth_inAppBrowser_appleBody', 'passkeys_reauth_appleBtn', 'profile_email_apple_locked', 'auth_google_disclosure'] as const) {
      expect(t[key], `${lang}.${key}`).toContain('Apple')
    }
  })
})
