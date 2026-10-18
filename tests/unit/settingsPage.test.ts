import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, Lang, TranslationKey } from '@/lib/i18n/translations'

const authState: { user: Record<string, unknown> | null; held: boolean } = { user: null, held: false }

vi.mock('next/navigation', () => ({ usePathname: () => '/settings', useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }) }))
vi.mock('@/lib/firebase/useAuth', () => ({ useAuth: () => ({ user: authState.user, loading: false }) }))
vi.mock('@/components/auth/useOnboardingGuard', () => ({ useOnboardingGuard: () => authState.held }))
vi.mock('@/lib/firebase/users', () => ({ updateUserLanguage: vi.fn() }))
vi.mock('@/lib/firebase/useMemberProfile', () => ({ useMemberProfile: () => ({ loaded: true, profile: null, firstName: null, initials: '', photoURL: null }) }))
vi.mock('@/components/layout/Navbar', () => ({ default: () => 'NAVBAR' }))

const { default: SettingsPage } = await import('@/app/settings/page')
const { default: DeleteAccountForm } = await import('@/components/settings/DeleteAccountForm')
const { requestAccountDeletion } = await import('@/lib/account/requestAccountDeletion')

const member = { uid: 'u1', email: 'dana@example.com', providerData: [{ providerId: 'password' }], getIdToken: async () => 'tok' }

function wrap(lang: Lang, el: ReturnType<typeof createElement>) {
  const t = (key: TranslationKey) => translations[lang][key]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, el))
}
function render(lang: Lang, { loggedIn = false, held = false } = {}) {
  authState.user = loggedIn ? member : null
  authState.held = held
  return wrap(lang, createElement(SettingsPage))
}
const amp = (s: string) => s.replace(/&/g, '&amp;').replace(/'/g, '&#x27;')

describe('/settings', () => {
  it.each(['en', 'he'] as const)('has a back button and a centred title (%s)', (lang) => {
    const html = render(lang, { loggedIn: true })
    const t = translations[lang]
    expect(html).toMatch(new RegExp(`<div class="grid grid-cols-\\[48px_1fr_48px\\][^"]*"><button type="button" aria-label="${t.settings_back}"`))
    expect(html).toContain('fa-chevron-left rtl:-scale-x-100')
    expect(html).toMatch(new RegExp(`<h1 class="text-center [^"]*">${t.nav_settings_heading}</h1><span aria-hidden="true"></span>`))
  })

  it.each(['en', 'ru', 'es', 'fr', 'he'] as const)('shows members every group in order, with mirrored chevrons and no Sign Out (%s)', (lang) => {
    const html = render(lang, { loggedIn: true })
    const t = translations[lang]
    const order = [t.settings_group_prefs, t.nav_lang_region, t.settings_group_account, t.nav_security, t.settings_group_help, t.nav_support_title, t.nav_terms_link, t.nav_privacy_link, t.settings_group_danger, t.del_row_title]
      .map((s) => html.indexOf(`>${amp(s)}<`))
    expect(order.every((i) => i > -1)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    // The current language's native name is the row's subtitle.
    expect(html).toContain(`>${{ en: 'English', ru: 'Русский', es: 'Español', fr: 'Français', he: 'עברית' }[lang]}<`)
    expect(html).toContain('href="/support?from=settings"')
    expect(html).toContain('href="/terms?from=settings"')
    expect(html).toContain('href="/privacy?from=settings"')
    expect(html).toContain('<bdi>1.0.0</bdi>')
    for (const m of html.matchAll(/fa-chevron-right[^"]*/g)) expect(m[0]).toContain('rtl:-scale-x-100')
    expect(html).not.toContain(`>${t.nav_logout}<`)
  })

  it('opens every row as its own page, never a sheet or dialog', () => {
    const html = render('en', { loggedIn: true })
    for (const href of ['/settings/language-region', '/settings/privacy-security', '/settings/delete-account']) expect(html).toContain(`href="${href}"`)
    expect(html).not.toContain('<dialog')
    expect(html).not.toMatch(/<button type="button" class="tap-target flex w-full/)
  })

  it('styles Delete Account as a red, destructive row', () => {
    const html = render('en', { loggedIn: true })
    const row = html.match(/<a class="([^"]*)" href="\/settings\/delete-account">(<span[^>]*><i class="fa-solid fa-trash-can[^"]*"><\/i><\/span>.*?)<\/a>/)!
    expect(row[1].split(' ')).toContain('text-red-600')
    expect(row[2]).toContain('bg-red-50 text-red-600')
    expect(row[2]).toContain(`>${translations.en.del_row_sub}<`)
  })

  it.each(['en', 'he'] as const)('gives guests only Language and Help & legal (%s)', (lang) => {
    const html = render(lang)
    const t = translations[lang]
    expect(html).toContain(`>${amp(t.nav_lang_region)}<`)
    expect(html).toContain('href="/terms?from=settings"')
    expect(html).not.toContain(`>${amp(t.nav_security)}<`)
    expect(html).not.toContain(`>${t.del_row_title}<`)
    expect(html).not.toContain('fa-trash-can')
  })

  it('treats a member mid-onboarding as a guest until the guard settles', () => {
    const html = render('en', { loggedIn: true, held: true })
    expect(html).not.toContain('fa-trash-can')
    expect(html).not.toContain('fa-shield-halved')
  })
})

describe('DeleteAccountForm', () => {
  const dialog = (lang: Lang) => wrap(lang, createElement(DeleteAccountForm, { onLeave: () => {}, user: member as never }))

  it.each(['en', 'he'] as const)('shows the email read-only, an optional reason and note, and a required confirmation (%s)', (lang) => {
    const html = dialog(lang)
    const t = translations[lang]
    expect(html).not.toContain('<dialog')
    expect(html).toMatch(/<input id="delete-email" type="email" readOnly="" dir="ltr"[^>]*value="dana@example.com"/)
    // The empty choice is selected by default: no reason given.
    expect(html).toContain(`<option value="" selected="">${amp(t.del_reason_placeholder)}</option>`)
    expect([...html.matchAll(/<option value="([a-z_]+)">/g)].map((m) => m[1])).toEqual(['not_using', 'missing_perks', 'privacy', 'moving', 'other'])
    expect(html).toMatch(/<textarea id="delete-details" rows="3" dir="auto" maxLength="1000"/)
    expect(html).toMatch(/<input type="checkbox" required=""/)
    expect(html).toContain(amp(t.del_confirm))
  })

  it('keeps the red submit disabled until the box is ticked', () => {
    const submit = dialog('en').match(/<button type="submit" disabled="" class="([^"]*)">([^<]*)<\/button>/)!
    expect(submit[1].split(' ')).toContain('bg-red-600')
    expect(submit[2]).toBe(translations.en.del_submit)
  })
})

describe('requestAccountDeletion', () => {
  afterEach(() => vi.unstubAllGlobals())

  const stub = (res: Partial<Response>) => {
    const fetch = vi.fn(async () => ({ type: 'basic', url: '', status: 200, ok: true, ...res }) as Response)
    vi.stubGlobal('fetch', fetch)
    return fetch
  }

  it('posts the token and the form, never the email, to the given base', async () => {
    const fetch = stub({ url: 'http://localhost:3000/api/account/delete-request' })
    expect(await requestAccountDeletion('tok', { reason: 'privacy', details: 'bye', lang: 'he' }, 'http://localhost:3000')).toBe('sent')
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://localhost:3000/api/account/delete-request')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    expect(JSON.parse(init.body as string)).toEqual({ confirm: true, reason: 'privacy', details: 'bye', lang: 'he' })
    expect(init.redirect).toBe('manual')
  })

  it.each([
    [429, 'rateLimited'],
    [401, 'unauthorized'],
    [400, 'failed'],
    [502, 'failed'],
  ] as const)('maps HTTP %i to %s', async (status, result) => {
    stub({ status, ok: false })
    expect(await requestAccountDeletion('tok', { reason: null, details: '', lang: 'en' })).toBe(result)
  })

  it('reports a redirect as failed (it would drop the token)', async () => {
    stub({ type: 'opaqueredirect', status: 0, ok: false })
    expect(await requestAccountDeletion('tok', { reason: null, details: '', lang: 'en' })).toBe('failed')
  })

  it('reports no answer as offline', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Network request failed') }))
    expect(await requestAccountDeletion('tok', { reason: null, details: '', lang: 'en' })).toBe('offline')
  })
})
