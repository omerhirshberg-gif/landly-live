import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  webClientId: 'web-client' as string | undefined,
  configure: vi.fn(),
  hasPlayServices: vi.fn(),
  signIn: vi.fn(),
  credential: vi.fn(),
  signInWithCredential: vi.fn(),
  finish: vi.fn(),
}))

vi.mock('../../landly-mobile/node_modules/expo-constants', () => ({
  default: { get expoConfig() { return { extra: { googleClientIds: { web: mocks.webClientId } } } } },
}))
vi.mock('../../landly-mobile/node_modules/firebase/app/dist/index.mjs', () => ({
  FirebaseError: class FirebaseError extends Error {
    constructor(public code: string, message: string) { super(message) }
  },
}))
vi.mock('../../landly-mobile/node_modules/firebase/auth/dist/index.mjs', () => ({
  GoogleAuthProvider: { credential: mocks.credential },
  signInWithCredential: mocks.signInWithCredential,
}))
vi.mock('../../landly-mobile/node_modules/@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: mocks.configure, hasPlayServices: mocks.hasPlayServices, signIn: mocks.signIn },
  statusCodes: { SIGN_IN_CANCELLED: '12501', IN_PROGRESS: 'IN_PROGRESS', PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE' },
}))
vi.mock('@shared/auth/signInCustomer', () => ({ finishCustomerGoogleSignIn: mocks.finish }))
vi.mock('@shared/firebase/config', () => ({ auth: { name: 'auth' } }))

type GoogleModule = {
  GOOGLE_SIGN_IN_CONFIGURED: boolean
  signInWithGoogle: (lang: 'en' | 'he') => Promise<unknown>
}
// A runtime-only path: a typed import would pull the app's @shared alias and React Native types into the root typecheck.
async function load() {
  vi.resetModules()
  return (await import('../../landly-mobile/src/auth/googleSignIn.android' as string)) as GoogleModule
}

beforeEach(() => {
  mocks.webClientId = 'web-client'
  for (const m of [mocks.configure, mocks.hasPlayServices, mocks.signIn, mocks.credential, mocks.signInWithCredential, mocks.finish]) m.mockReset()
  mocks.hasPlayServices.mockResolvedValue(true)
})

describe('Android native Google sign-in', () => {
  it('is configured only with a web client ID', async () => {
    expect((await load()).GOOGLE_SIGN_IN_CONFIGURED).toBe(true)
    mocks.webClientId = undefined
    expect((await load()).GOOGLE_SIGN_IN_CONFIGURED).toBe(false)
  })

  it('signs the ID token into Firebase and runs the shared customer rules', async () => {
    mocks.signIn.mockResolvedValue({ type: 'success', data: { idToken: 'id-token' } })
    mocks.credential.mockReturnValue('cred')
    mocks.signInWithCredential.mockResolvedValue({ user: 'u' })
    mocks.finish.mockResolvedValue({ status: 'signedIn' })
    const { signInWithGoogle } = await load()
    await expect(signInWithGoogle('he')).resolves.toEqual({ status: 'signedIn' })
    expect(mocks.configure).toHaveBeenCalledWith({ webClientId: 'web-client' })
    expect(mocks.credential).toHaveBeenCalledWith('id-token')
    expect(mocks.signInWithCredential).toHaveBeenCalledWith({ name: 'auth' }, 'cred')
    expect(mocks.finish).toHaveBeenCalledWith({ user: 'u' }, 'he')
  })

  it('configures the SDK once', async () => {
    mocks.signIn.mockResolvedValue({ type: 'cancelled', data: null })
    const { signInWithGoogle } = await load()
    await signInWithGoogle('en').catch(() => undefined)
    await signInWithGoogle('en').catch(() => undefined)
    expect(mocks.configure).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['a cancelled response', () => mocks.signIn.mockResolvedValue({ type: 'cancelled', data: null }), 'auth/popup-closed-by-user'],
    ['SIGN_IN_CANCELLED', () => mocks.signIn.mockRejectedValue({ code: '12501' }), 'auth/popup-closed-by-user'],
    ['IN_PROGRESS', () => mocks.signIn.mockRejectedValue({ code: 'IN_PROGRESS' }), 'auth/cancelled-popup-request'],
    ['PLAY_SERVICES_NOT_AVAILABLE', () => mocks.hasPlayServices.mockRejectedValue({ code: 'PLAY_SERVICES_NOT_AVAILABLE' }), 'auth/google-play-services-unavailable'],
    ['an unknown native error (DEVELOPER_ERROR)', () => mocks.signIn.mockRejectedValue({ code: '10' }), 'auth/internal-error'],
    ['a response with no ID token', () => mocks.signIn.mockResolvedValue({ type: 'success', data: { idToken: null } }), 'auth/internal-error'],
  ])('maps %s to a Firebase-style code', async (_name, arrange, code) => {
    arrange()
    const { signInWithGoogle } = await load()
    await expect(signInWithGoogle('en')).rejects.toMatchObject({ code })
    expect(mocks.signInWithCredential).not.toHaveBeenCalled()
  })

  it('refuses to start without a web client ID', async () => {
    mocks.webClientId = undefined
    const { signInWithGoogle } = await load()
    await expect(signInWithGoogle('en')).rejects.toThrow('not configured')
    expect(mocks.signIn).not.toHaveBeenCalled()
  })
})

describe('Play services error copy', () => {
  it('is said in every language, never in English elsewhere', async () => {
    const { translations } = await import('../../lib/i18n/translations')
    const { describeAuthError } = await import('../../lib/firebase/authErrors')
    const described = describeAuthError({ code: 'auth/google-play-services-unavailable' }, { provider: 'google' })
    expect(described).toEqual({ key: 'autherr_playServices', code: null })
    const en = (translations.en as Record<string, string>).autherr_playServices
    for (const lang of ['he', 'fr', 'es', 'ru']) {
      const text = (translations[lang as 'he'] as Record<string, string>).autherr_playServices
      expect(text).toBeTruthy()
      expect(text).not.toBe(en)
    }
  })
})
