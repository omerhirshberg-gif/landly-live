import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'
import { consentParts } from '@/lib/legal/consentText'

const mocks = vi.hoisted(() => ({
  getDoc: vi.fn(), setDoc: vi.fn(), ensure: vi.fn(), businessSignOut: vi.fn(), resolveLang: vi.fn(),
}))

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => path.join('/'),
  getDoc: mocks.getDoc,
  setDoc: mocks.setDoc,
  serverTimestamp: () => 'SERVER_TS',
  updateDoc: vi.fn(), arrayUnion: vi.fn(), arrayRemove: vi.fn(),
}))
vi.mock('@/lib/firebase/config', () => ({ auth: {}, db: {} }))
vi.mock('firebase/auth', () => ({ signInWithEmailAndPassword: vi.fn(), signOut: vi.fn() }))
vi.mock('@/lib/firebase/businesses', () => ({ signOutIfBusinessAccount: mocks.businessSignOut }))
vi.mock('@/lib/i18n/preferredLanguage', () => ({ resolvePreferredLanguage: mocks.resolveLang }))

const LANGS = Object.keys(translations) as Lang[]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getDoc.mockResolvedValue({ exists: () => false })
  mocks.setDoc.mockResolvedValue(undefined)
  mocks.businessSignOut.mockResolvedValue(false)
  mocks.resolveLang.mockResolvedValue(null)
})

describe('consent text templates', () => {
  it('splits a sentence into text and the two links, in the language\'s own order', () => {
    expect(consentParts(translations.en.signup_terms_agree)).toEqual([
      { text: "I confirm I'm 16 or older and agree to the " }, { link: 'terms' }, { text: ' and ' }, { link: 'privacy' },
    ])
    // Hebrew attaches "ו" (and) directly to the second link.
    expect(consentParts(translations.he.signup_terms_agree)).toEqual([
      { text: 'אני מאשר/ת שמלאו לי 16 ומעלה ומאשר/ת את ' }, { link: 'terms' }, { text: ' ו' }, { link: 'privacy' },
    ])
  })

  it.each(LANGS)('every consent sentence has exactly one Terms and one Privacy link (%s)', (lang) => {
    for (const key of ['signup_terms_agree', 'auth_google_disclosure'] as const) {
      const links = consentParts(translations[lang][key]).filter((p) => 'link' in p)
      expect(links, `${lang}.${key}`).toEqual([{ link: 'terms' }, { link: 'privacy' }])
    }
    for (const key of ['legal_terms_link', 'legal_privacy_link', 'signup_termsRequired'] as const) {
      expect(translations[lang][key], `${lang}.${key}`).toBeTruthy()
    }
  })

  it('uses the requested Hebrew wording', () => {
    const he = translations.he
    const render = (s: string) => consentParts(s).map((p) => ('link' in p ? (p.link === 'terms' ? he.legal_terms_link : he.legal_privacy_link) : p.text)).join('')
    expect(render(he.signup_terms_agree)).toBe('אני מאשר/ת שמלאו לי 16 ומעלה ומאשר/ת את תנאי השימוש ומדיניות הפרטיות')
    expect(render(he.auth_google_disclosure)).toBe('בהמשך ההרשמה עם Google, הינך מאשר/ת שמלאו לך 16 ומעלה ואת תנאי השימוש ומדיניות הפרטיות של Landly.')
  })

  it.each(LANGS)('every sign-up consent sentence states the 16+ age requirement (%s)', (lang) => {
    for (const key of ['signup_terms_agree', 'auth_google_disclosure', 'signup_termsRequired'] as const) {
      expect(translations[lang][key], `${lang}.${key}`).toContain('16')
    }
  })

  it.each(LANGS)('the checkout consent links only the Terms, which hold the refund policy (%s)', (lang) => {
    const links = consentParts(translations[lang].checkout_agree).filter((p) => 'link' in p)
    expect(links).toEqual([{ link: 'terms' }])
  })
})

describe('web ConsentText', () => {
  it.each(['en', 'he'] as const)('links to /terms and /privacy in a new tab (%s)', async (lang) => {
    const { default: ConsentText } = await import('@/components/auth/entrance/ConsentText')
    const t = (key: TranslationKey) => translations[lang][key]
    const html = renderToStaticMarkup(createElement(ConsentText, { template: t('signup_terms_agree'), t }))
    expect(html).toMatch(new RegExp(`<a href="/terms" target="_blank" rel="noopener noreferrer"[^>]*>${t('legal_terms_link')}</a>`))
    expect(html).toMatch(new RegExp(`<a href="/privacy" target="_blank" rel="noopener noreferrer"[^>]*>${t('legal_privacy_link')}</a>`))
    expect(html.indexOf('/terms')).toBeLessThan(html.indexOf('/privacy'))
  })

  it('marks the checkbox invalid and links it to the error', async () => {
    const { default: Checkbox } = await import('@/components/auth/entrance/Checkbox')
    const html = renderToStaticMarkup(createElement(Checkbox, { label: 'x', checked: false, onChange: () => {}, invalid: true, describedBy: 'err' }))
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('aria-describedby="err"')
    expect(html).toContain('border-red-500')
  })
})

describe('recording consent on the user document', () => {
  const user = { uid: 'u1', email: 'g@example.com', displayName: 'Gal Cohen' } as never

  it('stores agreedToTerms and termsAgreedAt for a new Google account', async () => {
    const { finishCustomerGoogleSignIn } = await import('@/lib/auth/signInCustomer')
    await finishCustomerGoogleSignIn({ user } as never, 'he')
    expect(mocks.setDoc).toHaveBeenCalledTimes(1)
    const [path, data] = mocks.setDoc.mock.calls[0]
    expect(path).toBe('users/u1')
    expect(data).toMatchObject({ email: 'g@example.com', preferredLanguage: 'he', agreedToTerms: true, isAgeConfirmed: true, termsAgreedAt: 'SERVER_TS' })
  })

  it('leaves an existing account\'s document untouched', async () => {
    mocks.getDoc.mockResolvedValue({ exists: () => true })
    const { finishCustomerGoogleSignIn } = await import('@/lib/auth/signInCustomer')
    await finishCustomerGoogleSignIn({ user } as never, 'en')
    expect(mocks.setDoc).not.toHaveBeenCalled()
  })

  it('does not claim consent where no disclosure was shown', async () => {
    const { ensureUserDocument } = await import('@/lib/firebase/users')
    await ensureUserDocument(user)
    const data = mocks.setDoc.mock.calls[0][1]
    expect(data).not.toHaveProperty('agreedToTerms')
    expect(data).not.toHaveProperty('termsAgreedAt')
    expect(data).not.toHaveProperty('isAgeConfirmed')
  })
})
