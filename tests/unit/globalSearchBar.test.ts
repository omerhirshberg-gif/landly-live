import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: () => {} }), useSearchParams: () => new URLSearchParams() }))
vi.mock('@/lib/firebase/config', () => ({ auth: {}, db: {} }))

const { default: GlobalPerkSearchBar } = await import('@/components/discover/GlobalPerkSearchBar')
const { default: MemberPageShell } = await import('@/components/layout/MemberPageShell')

const read = (path: string) => readFileSync(path, 'utf8')
const LANGS = ['en', 'he', 'ru', 'fr', 'es'] as const

function render(lang: Lang, element: ReturnType<typeof createElement>) {
  const t = (key: TranslationKey) => translations[lang][key]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, element))
}

describe('GlobalPerkSearchBar', () => {
  it.each(LANGS)('is one row: the search pill, then Near Me, then Filter (%s)', (lang) => {
    const html = render(lang, createElement(GlobalPerkSearchBar))
    const search = html.indexOf('role="search"')
    const near = html.indexOf(`aria-label="${translations[lang].geo_near_me_btn}"`)
    const filter = html.indexOf(`aria-label="${translations[lang].cats_filter_button}"`)
    expect(html).toContain('data-global-search=""')
    expect(search).toBeGreaterThan(-1)
    expect(near).toBeGreaterThan(search)
    expect(filter).toBeGreaterThan(near)
    expect(html.match(/role="search"/g)).toHaveLength(1)
  })

  it('is a 48px pill with start-edge icon spacing only (logical properties)', () => {
    const html = render('he', createElement(GlobalPerkSearchBar))
    expect(html).toContain('h-12 w-full rounded-full')
    expect(html).toMatch(/ps-12 pe-12/)
    expect(html).not.toMatch(/\b(pl|pr|ml|mr)-\d/)
  })
})

describe('the shell places it', () => {
  it('first in the column when globalSearch is on, and not otherwise', () => {
    const on = render('en', createElement(MemberPageShell, { globalSearch: true, children: 'CONTENT' }))
    expect(on.indexOf('data-global-search')).toBeGreaterThan(-1)
    expect(on.indexOf('data-global-search')).toBeLessThan(on.indexOf('CONTENT'))
    expect(render('en', createElement(MemberPageShell, { children: 'CONTENT' }))).not.toContain('data-global-search')
  })

  it.each([
    ['components/home/LoggedInHome.tsx', true],
    ['app/categories/page.tsx', true],
    ['app/wishlist/page.tsx', false],
    ['app/member/page.tsx', false],
    ['app/support/page.tsx', false],
    ['app/profile/page.tsx', false],
  ] as const)('%s uses it: %s', (path, uses) => {
    expect(read(path).includes('globalSearch')).toBe(uses)
  })

  it('renders on the offer page (from 600px) and in the New, Best Sellers and category lists', () => {
    const offer = read('app/offers/[offerId]/page.tsx')
    expect(offer).toContain('<GlobalPerkSearchRow />')
    expect(offer).toContain('hidden fold:block')
    expect(read('components/discover/OfferListView.tsx')).toContain('<GlobalPerkSearchRow wide />')
  })
})

describe('/categories', () => {
  const page = read('app/categories/page.tsx')

  it('has a single search bar: the shell\'s, sharing the page\'s URL state', () => {
    expect(page).not.toContain('PerksSearchBar')
    expect(page).not.toContain('NearMeButton')
    expect(page).toContain('<PerksUrlStateProvider>')
    expect(read('components/perks/PerksToolbar.tsx')).not.toContain('PerksSearchBar')
  })

  it('offers Back inside a selected category, which clears it and keeps the rest', () => {
    expect(page).toContain("onBack={() => setCategory('all')}")
    expect(page).toContain("label={t('nav_back')}")
    expect(page.indexOf('{selectedTile && (')).toBeLessThan(page.indexOf('<PageHeading title={pageTitle} />'))
    for (const lang of LANGS) expect(translations[lang].nav_back.length).toBeGreaterThan(0)
    expect(translations.he.nav_back).toBe('חזרה')
  })

  it('keeps Near Me in memory, never in the URL', () => {
    expect(read('lib/perks/PerksSearchProvider.tsx')).not.toMatch(/searchParams|replaceState|URLSearchParams/)
    expect(read('components/discover/GlobalPerkSearchBar.tsx')).not.toMatch(/lat|lng|coords.*params/i)
  })
})

describe('native tab bar', () => {
  const order = (source: string, pattern: RegExp) => [...source.matchAll(pattern)].map((m) => m[1])
  it('declares all five tabs, in order, on iOS/Android and on web', () => {
    const native = read('landly-mobile/src/app/(tabs)/_layout.tsx')
    expect(order(native, /<NativeTabs\.Trigger name="(\w+)"/g)).toEqual(['index', 'perks', 'wishlist', 'wallet', 'profile'])
    expect(native).toContain('wishlistCount > 0 &&')
    const web = read('landly-mobile/src/app/(tabs)/_layout.web.tsx')
    expect(order(web, /<Tabs\.Screen\s+name="(\w+)"/g)).toEqual(['index', 'perks', 'wishlist', 'wallet', 'profile'])
    expect(web).toContain('wishlistCount > 0 ? wishlistCount : undefined')
  })

  it('names every tab in all five languages', () => {
    for (const lang of LANGS) {
      for (const key of ['mobile_tab_home', 'mobile_tab_perks', 'wishlist_title', 'mobile_tab_wallet', 'nav_profile'] as const) {
        expect(translations[lang][key], `${lang}.${key}`).toBeTruthy()
      }
    }
  })
})
