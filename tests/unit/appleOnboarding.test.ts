import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isOnboardingComplete, sessionOnboardingStatus } from '@/lib/auth/onboardingStatus'

// Apple (and Google) sign-ins reach the same onboarding wizard as email:
// the profile doc a new account gets is "incomplete", a session whose doc was
// never written is repaired before the wizard, and a session a provider
// didn't verify is refused.
const mocks = vi.hoisted(() => ({
  getDoc: vi.fn(), setDoc: vi.fn(), updateDoc: vi.fn(), signOut: vi.fn(), updateProfile: vi.fn(),
  businessSignOut: vi.fn(), resolveLang: vi.fn(),
}))
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => path.join('/'),
  getDoc: mocks.getDoc,
  setDoc: mocks.setDoc,
  updateDoc: mocks.updateDoc,
  serverTimestamp: () => 'SERVER_TS',
  onSnapshot: vi.fn(), arrayUnion: vi.fn(), arrayRemove: vi.fn(),
}))
vi.mock('@/lib/firebase/config', () => ({ auth: { name: 'auth' }, db: {} }))
vi.mock('firebase/auth', () => ({ signInWithEmailAndPassword: vi.fn(), signInWithCustomToken: vi.fn(), signOut: mocks.signOut, updateProfile: mocks.updateProfile }))
vi.mock('@/lib/firebase/businesses', () => ({ signOutIfBusinessAccount: mocks.businessSignOut }))
vi.mock('@/lib/i18n/preferredLanguage', () => ({ resolvePreferredLanguage: mocks.resolveLang }))

const read = (path: string) => readFileSync(path, 'utf8')
const appleUser = (overrides: Record<string, unknown> = {}) =>
  ({ uid: 'a1', email: 'x7@privaterelay.appleid.com', displayName: null, emailVerified: true, providerData: [{ providerId: 'apple.com' }], ...overrides }) as never
const snap = (data: Record<string, unknown> | null) => ({ exists: () => data !== null, data: () => data })
// users/{uid} as ensureUserDocument writes it for a new Apple account.
const freshAppleDoc = { email: 'x7@privaterelay.appleid.com', firstName: 'Noa', lastName: 'Levi', displayName: 'Noa Levi', phone: '', customerType: '' }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getDoc.mockResolvedValue(snap(null))
  mocks.setDoc.mockResolvedValue(undefined)
  mocks.businessSignOut.mockResolvedValue(false)
  mocks.resolveLang.mockResolvedValue(null)
  mocks.updateProfile.mockResolvedValue(undefined)
})

describe('sessionOnboardingStatus', () => {
  it.each([['apple.com'], ['google.com']])('owes onboarding for a %s session whose doc was never written', (provider) => {
    expect(sessionOnboardingStatus(null, [provider])).toBe(false)
    expect(sessionOnboardingStatus(null, ['password', provider])).toBe(false)
  })

  it('leaves a password session without a doc ungated (a business, or an email sign-in still creating it)', () => {
    expect(sessionOnboardingStatus(null, ['password'])).toBe(true)
    expect(sessionOnboardingStatus(null, [])).toBe(true)
  })

  it('goes by the doc when there is one, whatever the provider', () => {
    expect(sessionOnboardingStatus(freshAppleDoc, ['apple.com'])).toBe(false)
    expect(sessionOnboardingStatus({ ...freshAppleDoc, onboardingCompleted: true }, ['apple.com'])).toBe(true)
    // Members from before the wizard: persona and phone already set.
    expect(sessionOnboardingStatus({ ...freshAppleDoc, phone: '+972501234567', customerType: 'student' }, ['apple.com'])).toBe(true)
  })

  it('treats a fresh Apple profile as incomplete until the wizard stamps it (a skipped WhatsApp number included)', () => {
    expect(isOnboardingComplete(freshAppleDoc)).toBe(false)
    expect(isOnboardingComplete({ ...freshAppleDoc, customerType: 'taglit' })).toBe(false)
    expect(isOnboardingComplete({ ...freshAppleDoc, customerType: 'taglit', onboardingCompleted: true })).toBe(true)
  })
})

describe('a new Apple account lands in the wizard', () => {
  it('writes a profile that owes onboarding, with the name and no password step', async () => {
    const { finishCustomerOAuthSignIn } = await import('@/lib/auth/signInCustomer')
    const result = await finishCustomerOAuthSignIn({ user: appleUser() }, 'en', { names: { firstName: 'Noa', lastName: 'Levi' } })
    expect(result).toMatchObject({ status: 'signedIn' })
    const written = mocks.setDoc.mock.calls[0][1]
    expect(written).toMatchObject({ firstName: 'Noa', lastName: 'Levi', phone: '', customerType: '', agreedToTerms: true })
    expect(written).not.toHaveProperty('onboardingCompletedAt')
    expect(isOnboardingComplete(written)).toBe(false)
  })
})

describe('the unverified-session guard', () => {
  it('signs an unverified Apple session straight back out with a clear error, writing nothing', async () => {
    const { finishCustomerOAuthSignIn } = await import('@/lib/auth/signInCustomer')
    await expect(finishCustomerOAuthSignIn({ user: appleUser({ emailVerified: false }) }, 'en')).rejects.toMatchObject({
      code: 'auth/unverified-provider-email',
    })
    expect(mocks.signOut).toHaveBeenCalledWith({ name: 'auth' })
    expect(mocks.businessSignOut).not.toHaveBeenCalled()
    expect(mocks.setDoc).not.toHaveBeenCalled()
  })

  it('has a message for it', async () => {
    const { getAuthErrorMessage } = await import('@/lib/firebase/authErrors')
    const { FirebaseError } = await import('firebase/app')
    expect(getAuthErrorMessage(new FirebaseError('auth/unverified-provider-email', 'x'))).toMatch(/couldn't confirm your email/)
  })
})

describe('resumeCustomerSession', () => {
  it('resumes with the existing doc and touches nothing else', async () => {
    mocks.getDoc.mockResolvedValue(snap(freshAppleDoc))
    const { resumeCustomerSession } = await import('@/lib/auth/signInCustomer')
    const resumed = await resumeCustomerSession(appleUser(), 'he')
    expect(resumed).toMatchObject({ status: 'resume', doc: { firstName: 'Noa' } })
    expect(mocks.setDoc).not.toHaveBeenCalled()
    expect(mocks.businessSignOut).not.toHaveBeenCalled()
  })

  it('recreates a missing Apple profile through the customer rules, then resumes with it', async () => {
    mocks.getDoc
      .mockResolvedValueOnce(snap(null)) // the screen's read
      .mockResolvedValueOnce(snap(null)) // ensureUserDocument's read
      .mockResolvedValueOnce(snap({ ...freshAppleDoc, firstName: '', lastName: '', displayName: '' }))
    const { resumeCustomerSession } = await import('@/lib/auth/signInCustomer')
    const resumed = await resumeCustomerSession(appleUser(), 'en')
    expect(mocks.businessSignOut).toHaveBeenCalledWith('a1')
    expect(mocks.setDoc).toHaveBeenCalledTimes(1)
    expect(mocks.setDoc.mock.calls[0][1]).toMatchObject({ email: 'x7@privaterelay.appleid.com', agreedToTerms: true })
    expect(resumed).toMatchObject({ status: 'resume', doc: { email: 'x7@privaterelay.appleid.com' } })
  })

  it('reports a business instead of creating a customer profile for it', async () => {
    mocks.businessSignOut.mockResolvedValue(true)
    const { resumeCustomerSession } = await import('@/lib/auth/signInCustomer')
    expect(await resumeCustomerSession(appleUser(), 'en')).toEqual({ status: 'businessAccount' })
    expect(mocks.setDoc).not.toHaveBeenCalled()
  })

  it('never creates a profile for a password session without one', async () => {
    const { resumeCustomerSession } = await import('@/lib/auth/signInCustomer')
    expect(await resumeCustomerSession(appleUser({ providerData: [{ providerId: 'password' }] }), 'en')).toEqual({ status: 'resume', doc: null })
    expect(mocks.setDoc).not.toHaveBeenCalled()
  })

  it('opens the wizard as before when the doc cannot be read (never guesses it is missing)', async () => {
    mocks.getDoc.mockRejectedValue(new Error('offline'))
    const { resumeCustomerSession } = await import('@/lib/auth/signInCustomer')
    expect(await resumeCustomerSession(appleUser(), 'en')).toEqual({ status: 'resume', doc: null })
    expect(mocks.setDoc).not.toHaveBeenCalled()
  })
})

describe('the app\'s tabs stay closed until onboarding is done', () => {
  type Gate = (s: { verified: boolean; checking: boolean; onboarding: boolean; onboardingComplete: boolean | null }) => boolean
  // A runtime-only path: a typed import would pull React Native's globals into the root typecheck.
  const load = async () => ((await import('../../landly-mobile/src/auth/SignInGate' as string)) as { rootSignedIn: Gate }).rootSignedIn

  it('holds through every step of a first Apple sign-in, and opens after the celebration', async () => {
    const rootSignedIn = await load()
    const steps = [
      // Apple sheet done, customer rules running (the auth provider's first read may already say "owed").
      { verified: true, checking: true, onboarding: false, onboardingComplete: false },
      // afterSignIn: onboarding held before the check is released.
      { verified: true, checking: true, onboarding: true, onboardingComplete: false },
      { verified: true, checking: false, onboarding: true, onboardingComplete: false },
      // A stale "no doc yet" answer never opens the gate while the wizard is up.
      { verified: true, checking: false, onboarding: true, onboardingComplete: true },
    ]
    for (const step of steps) expect(rootSignedIn(step), JSON.stringify(step)).toBe(false)
    // "Let's explore": the wizard stamped the doc and released the hold.
    expect(rootSignedIn({ verified: true, checking: false, onboarding: false, onboardingComplete: true })).toBe(true)
  })

  it('keeps a relaunched session with onboarding owed on the login screen', async () => {
    const rootSignedIn = await load()
    expect(rootSignedIn({ verified: true, checking: false, onboarding: false, onboardingComplete: false })).toBe(false)
    expect(rootSignedIn({ verified: false, checking: false, onboarding: false, onboardingComplete: true })).toBe(false)
  })
})

describe('both screens route Apple through the same post-sign-in step', () => {
  const web = read('components/auth/entrance/AuthScreen.tsx')
  const app = read('landly-mobile/src/app/(auth)/login.tsx')

  it('website: Apple popup and redirect results go through afterSignIn, which opens the wizard when owed', () => {
    expect(web).toMatch(/const handleOAuthResult = async \(provider: OAuthWebProvider[\s\S]*?await afterSignIn\(/)
    expect(web).toMatch(/const afterSignIn = [\s\S]*?isOnboardingComplete\(doc\)[\s\S]*?openWizard\(uid\)/)
    expect(web).toContain('resumeCustomerSession(user, lang)')
  })

  it('app: Apple goes through handleOAuth, whose afterSignIn holds onboarding before the check is released', () => {
    expect(app).toContain("const handleApple = () => handleOAuth('apple', signInWithApple)")
    expect(app).toMatch(/const afterSignIn = [\s\S]*?if \(complete\) return\s*\n\s*setOnboarding\(true\)/)
    expect(app).toMatch(/const handleOAuth = [\s\S]*?await afterSignIn\([\s\S]*?finally \{\s*setChecking\(false\)/)
    expect(app).toContain('resumeCustomerSession(user, lang)')
  })

  it('names no Firebase project in the onboarding gate (DEV and PROD behave the same)', () => {
    for (const file of ['lib/auth/onboardingStatus.ts', 'lib/firebase/AuthProvider.tsx', 'lib/auth/signInCustomer.ts']) {
      expect(read(file), file).not.toMatch(/landly-dev|landly-be752|com\.amitbd\.landlyapp/)
    }
  })
})

// A member Apple sent no name for (hidden, or a first authorization that was
// lost) adds one on the profile screen, website and app alike.
describe('adding a name on the profile', () => {
  it('requires both parts once there is a name, and lets a nameless member skip it', async () => {
    const { profileNameErrors } = await import('@/lib/auth/names')
    expect(profileNameErrors({ firstName: '', lastName: '' }, { hadName: false })).toEqual({})
    expect(profileNameErrors({ firstName: '  ', lastName: '' }, { hadName: false })).toEqual({})
    expect(profileNameErrors({ firstName: 'Noa', lastName: '' }, { hadName: false })).toEqual({ lastName: 'form_fieldRequired' })
    expect(profileNameErrors({ firstName: '', lastName: '' }, { hadName: true })).toEqual({ firstName: 'form_fieldRequired', lastName: 'form_fieldRequired' })
    expect(profileNameErrors({ firstName: 'נועה', lastName: 'לוי' }, { hadName: true })).toEqual({})
  })

  it('writes the parts and the joined name to users/{uid}, then the Auth record', async () => {
    const { updateUserName } = await import('@/lib/firebase/users')
    const user = appleUser()
    await updateUserName(user, { firstName: '  נועה ', lastName: 'לוי\n' })
    expect(mocks.updateDoc).toHaveBeenCalledWith('users/a1', { firstName: 'נועה', lastName: 'לוי', displayName: 'נועה לוי' })
    expect(mocks.updateProfile).toHaveBeenCalledWith(user, { displayName: 'נועה לוי' })
    // An Auth hiccup doesn't fail the save: the doc is what the profile reads.
    mocks.updateProfile.mockRejectedValueOnce(new Error('network'))
    await expect(updateUserName(appleUser(), { firstName: 'Noa', lastName: 'Levi' })).resolves.toBeUndefined()
    // Already the Auth name: no second write.
    mocks.updateProfile.mockClear()
    await updateUserName(appleUser({ displayName: 'Noa Levi' }), { firstName: 'Noa', lastName: 'Levi' })
    expect(mocks.updateProfile).not.toHaveBeenCalled()
  })

  it('offers "Add your name" and the two name fields in both profile editors, never from the email', async () => {
    for (const file of ['components/profile/ProfileSection.tsx', 'landly-mobile/src/app/(tabs)/profile.tsx']) {
      const source = read(file)
      expect(source, file).toContain("t('profile_add_name')")
      expect(source, file).toContain('startEdit(true)')
      expect(source, file).toContain('profileNameErrors(names, { hadName: ')
      expect(source, file).toContain('if (nameChanged) await updateUserName(user, names)')
      expect(source, file).toMatch(/given-name[\s\S]*family-name/)
      expect(source, file).not.toMatch(/email\.split\('@'\)/)
    }
    const { translations } = await import('@/lib/i18n/translations')
    for (const lang of Object.keys(translations) as (keyof typeof translations)[]) expect(translations[lang].profile_add_name, lang).toBeTruthy()
    expect(translations.he.profile_add_name).toBe('הוסיפו את השם שלכם')
  })
})
