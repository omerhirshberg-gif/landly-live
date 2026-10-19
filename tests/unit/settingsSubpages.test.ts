import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'

const state: { user: Record<string, unknown> | null; profile: Record<string, unknown> | null } = { user: null, profile: null }

vi.mock('next/navigation', () => ({ usePathname: () => '/settings', useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }) }))
vi.mock('@/lib/firebase/useAuth', () => ({ useAuth: () => ({ user: state.user, loading: false }) }))
vi.mock('@/components/auth/useOnboardingGuard', () => ({ useOnboardingGuard: () => false }))
vi.mock('@/lib/firebase/config', () => ({ auth: {}, db: {} }))
vi.mock('@/lib/firebase/users', () => ({
  updateUserLanguage: vi.fn(),
  updateUserRegion: vi.fn(),
  updateUserCountryOfOrigin: vi.fn(),
  getUserDocument: () => new Promise(() => {}),
  updateUserPhone: vi.fn(),
}))
vi.mock('@/lib/firebase/useMemberProfile', () => ({
  useMemberProfile: () => ({ loaded: true, profile: state.profile, firstName: null, initials: '', photoURL: null }),
  invalidateMemberProfile: vi.fn(),
}))
vi.mock('@/components/layout/Navbar', () => ({ default: () => 'NAVBAR' }))
vi.mock('@/components/profile/AvatarUploader', () => ({ default: () => 'AVATAR_UPLOADER' }))

const { default: LanguageRegionPage } = await import('@/app/settings/language-region/page')
const { default: OriginPage } = await import('@/app/settings/language-region/origin/page')
const { default: PrivacySecurityPage } = await import('@/app/settings/privacy-security/page')
const { default: DeleteAccountPage } = await import('@/app/settings/delete-account/page')
const { default: ProfilePage } = await import('@/app/profile/page')
const { revokeAllSessions } = await import('@/lib/account/revokeSessions')

const member = { uid: 'u1', email: 'dana@example.com', providerData: [{ providerId: 'password' }], getIdToken: async () => 'tok' }

function render(lang: Lang, page: () => React.ReactNode, { loggedIn = true, profile = null as Record<string, unknown> | null } = {}) {
  state.user = loggedIn ? member : null
  state.profile = profile
  const t = (key: TranslationKey) => translations[lang][key]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, createElement(page)))
}
const amp = (s: string) => s.replace(/&/g, '&amp;').replace(/'/g, '&#x27;')

describe('settings sub-pages', () => {
  it.each([LanguageRegionPage, OriginPage, PrivacySecurityPage, DeleteAccountPage])('are standalone pages with a back button and no dialog (%#)', (page) => {
    const html = render('he', page)
    expect(html).toContain(`aria-label="${translations.he.settings_back}"`)
    expect(html).toContain('fa-chevron-left rtl:-scale-x-100')
    expect(html).not.toContain('<dialog')
    expect(html).not.toContain('role="dialog"')
  })

  it.each(['en', 'he'] as const)('Language & Region: five languages, the origin row and seven regions (%s)', (lang) => {
    const html = render(lang, LanguageRegionPage, { profile: { countryOfOrigin: 'FR', israelRegion: 'haifa' } })
    const t = translations[lang]
    expect(html).toMatch(new RegExp(`<h1[^>]*>${amp(t.nav_lang_region)}</h1>`))
    const radios = [...html.matchAll(/role="radio" aria-checked="(true|false)"/g)]
    expect(radios).toHaveLength(5 + 7)
    expect(html).toContain('href="/settings/language-region/origin"')
    expect(html).toContain(lang === 'he' ? '🇫🇷 צרפת' : '🇫🇷 France')
    expect(html).toMatch(new RegExp(`aria-checked="true"[^>]*>.*?${amp(t.region_haifa)}`))
  })

  it('Language & Region: guests get only the languages', () => {
    const html = render('en', LanguageRegionPage, { loggedIn: false })
    expect([...html.matchAll(/role="radio"/g)]).toHaveLength(5)
    expect(html).not.toContain('/settings/language-region/origin')
  })

  it('Country of origin: a search field over a listbox of every country, the current one selected', () => {
    const html = render('en', OriginPage, { profile: { countryOfOrigin: 'UA', israelRegion: '' } })
    expect(html).toContain('type="search"')
    expect(html).toContain('role="listbox"')
    expect(html).toMatch(/role="option" aria-selected="true"[^>]*>.*?Ukraine/)
    expect([...html.matchAll(/role="option"/g)].length).toBeGreaterThan(200)
  })

  it('Privacy & Security: sign-in method, change password, sessions and data controls', () => {
    const html = render('en', PrivacySecurityPage)
    const t = translations.en
    const order = [t.security_signin_title, t.profile_change_password_title, t.security_sessions_title, t.security_this_device, t.security_signout_all, t.security_data_title]
      .map((s) => html.indexOf(`>${amp(s)}<`))
    expect(order.every((i) => i > -1)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(html).toContain('href="/settings/delete-account"')
  })

  it('Delete Account: the request form on the page itself', () => {
    const html = render('en', DeleteAccountPage)
    expect(html).toMatch(/<input id="delete-email" type="email" readOnly=""/)
    expect(html).toContain(`>${translations.en.del_submit}<`)
  })
})

describe('/profile', () => {
  it.each(['en', 'he'] as const)('is titled Profile and has no language picker (%s)', (lang) => {
    const html = render(lang, ProfilePage)
    expect(html).toMatch(new RegExp(`<h1[^>]*>${translations[lang].nav_profile}</h1>`))
    expect(html).not.toMatch(/lang="(en|ru|es|fr|he)"/)
    // Origin and region are edited in place behind the single Edit profile button.
    expect(html).toContain(`>${translations[lang].profile_edit_profile_btn}</button>`)
    expect(html).not.toContain('href="/settings/')
  })

  it('redirects /account to /profile permanently', async () => {
    const config = (await import('../../next.config.js')).default as { redirects: () => Promise<unknown[]> }
    expect(await config.redirects()).toContainEqual({ source: '/account', destination: '/profile', permanent: true })
  })
})

describe('browser back gestures', () => {
  it('never blocks sideways overscroll on the page', () => {
    const css = readFileSync('app/globals.css', 'utf8')
    expect(css).toContain('html,body{overscroll-behavior-x:auto;}')
    expect(css).not.toMatch(/overscroll-behavior(-x)?\s*:\s*(none|contain)/)
  })
})

describe('revokeAllSessions', () => {
  afterEach(() => vi.unstubAllGlobals())

  const stub = (res: Partial<Response>) => {
    const fetch = vi.fn(async () => ({ type: 'basic', url: '', status: 200, ok: true, ...res }) as Response)
    vi.stubGlobal('fetch', fetch)
    return fetch
  }

  it('posts the token to the given base', async () => {
    const fetch = stub({ url: 'http://localhost:3000/api/account/revoke-sessions' })
    expect(await revokeAllSessions('tok', 'http://localhost:3000')).toBe('done')
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://localhost:3000/api/account/revoke-sessions')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    expect(init.redirect).toBe('manual')
  })

  it.each([
    [429, 'rateLimited'],
    [401, 'unauthorized'],
    [503, 'failed'],
  ] as const)('maps HTTP %i to %s', async (status, result) => {
    stub({ status, ok: false })
    expect(await revokeAllSessions('tok')).toBe(result)
  })

  it('reports no answer as offline', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Network request failed') }))
    expect(await revokeAllSessions('tok')).toBe('offline')
  })
})
