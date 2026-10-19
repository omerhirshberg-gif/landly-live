import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'

const authState: { user: { uid: string } | null; loading: boolean } = { user: null, loading: false }
vi.mock('next/navigation', () => ({ usePathname: () => '/about', useRouter: () => ({ push: () => {} }) }))
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }))
vi.mock('@/lib/firebase/config', () => ({ auth: {} }))
vi.mock('@/lib/firebase/users', () => ({ updateUserLanguage: vi.fn() }))
vi.mock('@/lib/firebase/useAuth', () => ({ useAuth: () => authState }))
vi.mock('@/lib/firebase/useWishlist', () => ({ useWishlist: () => ({ wishlistIds: [] }) }))
vi.mock('@/lib/firebase/useMemberProfile', () => ({ useMemberProfile: () => ({ loaded: true, profile: null, firstName: null, initials: '', photoURL: null }) }))

import { FOUNDERS } from '@/lib/about/founders'
import { organizationJsonLd } from '@/lib/seo/jsonLd'
import { metadata } from '@/app/about/layout'
const { default: AboutPage } = await import('@/components/about/AboutPage')
const { default: Navbar } = await import('@/components/layout/Navbar')

// Text as React writes it into markup.
const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function render(lang: Lang, element: ReturnType<typeof createElement>, user: { uid: string } | null = null) {
  authState.user = user
  const t = (key: TranslationKey) => translations[lang][key]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, element))
}

describe('/about', () => {
  it.each(Object.keys(translations) as Lang[])('tells the story, introduces both founders and explains the mission (%s)', (lang) => {
    const t = translations[lang]
    const html = render(lang, createElement(AboutPage))
    expect(html).toContain(`<h1 id="about-title"`)
    expect(html).toContain(`>${esc(t.about_title)}</h1>`)
    expect(html).toContain(esc(t.about_sub))
    expect(html).toContain(`>${esc(t.about_founders_title)}</h2>`)
    for (const founder of FOUNDERS) {
      expect(html).toContain(`<h3 id="founder-${founder.id}" class="font-display text-xl font-extrabold text-ink">${esc(t[founder.nameKey])}</h3>`)
      expect(html).toContain(esc(t[founder.bioKey]))
    }
    expect(html.split(`>${esc(t.about_role_cofounder)}</p>`)).toHaveLength(3)
    expect(html).toContain(`>${esc(t.about_mission_title)}</h2>`)
    expect(html).toContain(esc(t.about_mission_text))
    expect(html).toContain(`>${esc(t.about_cta_title)}</h2>`)
    expect(html.split('class="section-divider')).toHaveLength(4)
  })

  it('uses the approved names, roles and placeholder bios', () => {
    expect(FOUNDERS.map((f) => f.name)).toEqual(['Amit Bar-David', 'Omer Hirshberg'])
    expect(translations.he.about_name_amit).toBe('עמית בר-דוד')
    expect(translations.he.about_name_omer).toBe('עומר הירשברג')
    expect(translations.en.about_bio_amit).toBe('More about Amit coming soon.')
    expect(translations.en.about_bio_omer).toBe('More about Omer coming soon.')
    expect(translations.he.about_bio_amit).toBe('פרטים נוספים על עמית יתווספו בקרוב.')
    expect(translations.he.about_bio_omer).toBe('פרטים נוספים על עומר יתווספו בקרוב.')
    expect(translations.he.footer_about).toBe('אודות')
    expect(translations.he.nav_about).toBe('אודות')
    expect(translations.en.about_title).toBe('Our Story')
    expect(translations.he.about_title).toBe('הסיפור שלנו')
    expect(translations.en.about_role_cofounder).toBe('Co-Founder')
  })

  it('stacks the founder cards on phones and puts them side by side from md, in the specified card style', () => {
    const html = render('en', createElement(AboutPage))
    expect(html).toContain('<div class="grid grid-cols-1 md:grid-cols-2 gap-5">')
    const cards = html.match(/<article aria-labelledby="founder-[^"]+" class="([^"]*)"/g) ?? []
    expect(cards).toHaveLength(2)
    for (const card of cards) {
      for (const c of ['h-full', 'bg-white', 'rounded-2xl', 'p-6', 'sm:p-8', 'border', 'border-slate-200/80', 'shadow-sm', 'before:h-1', 'before:from-brand', '[@media(hover:hover)]:hover:-translate-y-1', '[@media(hover:hover)]:hover:shadow-md']) {
        expect(card.split('"')[3].split(' ')).toContain(c)
      }
    }
  })

  it('holds a fixed 96px rounded-square portrait, showing initials until a photo is set, and the role as a pill', () => {
    const html = render('en', createElement(AboutPage))
    expect(html.split('<div class="h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl ')).toHaveLength(3)
    expect(html.split(`rounded-full border border-brand/15 bg-brandTint px-2.5 py-0.5 text-xs font-bold text-brand">${translations.en.about_role_cofounder}</p>`)).toHaveLength(3)
    expect(html).toContain('>AB</span>')
    expect(html).toContain('>OH</span>')
    expect(FOUNDERS.every((f) => f.photo === null)).toBe(true)
  })

  it('invites guests to sign up or sign in, and sends members to the perks', () => {
    const guest = render('en', createElement(AboutPage))
    expect(guest).toContain(`href="/signup"`)
    expect(guest).toMatch(new RegExp(`href="/signup"[^>]*>${translations.en.signup_title}</a>`))
    expect(guest).toMatch(new RegExp(`href="/login"[^>]*>${translations.en.nav_login}</a>`))
    const member = render('en', createElement(AboutPage), { uid: 'u1' })
    const cta = member.slice(member.indexOf('id="about-cta-title"'))
    expect(cta).toMatch(new RegExp(`href="/categories"[^>]*>${translations.en.nav_cta}</a>`))
    expect(cta).not.toContain('href="/signup"')
  })

  it('reads right to left in Hebrew, with start/end spacing so the cards mirror', () => {
    const html = render('he', createElement(AboutPage))
    // The page's own content (the navbar and footer have their own tests).
    const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'))
    expect(main).toContain('sm:text-start')
    expect(main).toContain(translations.he.about_name_amit)
    expect(main).not.toMatch(/\b(ml|mr|pl|pr|left|right)-\d/)
  })

  it('has its own title, description, canonical URL and share card', () => {
    expect(metadata).toMatchObject({
      title: 'About Us',
      alternates: { canonical: '/about' },
      openGraph: { url: '/about', title: 'About Us' },
    })
    expect(String(metadata.description)).toContain('Amit Bar-David and Omer Hirshberg')
  })
})

describe('About in the navigation', () => {
  const desktop = (html: string) => html.slice(html.indexOf('class="hidden lg:flex'), html.indexOf('class="flex items-center gap-3 flex-shrink-0 justify-self-end"'))
  const drawer = (html: string) => html.slice(html.indexOf('</nav>'))

  it.each(['en', 'he'] as const)('guests see About after Making Aliyah? in the bar and the drawer (%s)', (lang) => {
    const t = translations[lang]
    const html = render(lang, createElement(Navbar))
    const bar = desktop(html)
    expect(bar).toContain(`href="/about"`)
    expect(bar.indexOf('href="/about"')).toBeGreaterThan(bar.indexOf('href="/olim"'))
    expect(bar.indexOf('href="/about"')).toBeLessThan(bar.indexOf('href="/business"'))
    expect(bar).toMatch(new RegExp(`href="/about"[^>]*>${t.nav_about}</a>`))
    // Desktop bar from 1280px only, so it never crowds the account buttons at 1024px.
    const tag = bar.match(/<a [^>]*href="\/about"[^>]*>/)?.[0] ?? ''
    expect(tag).toMatch(/class="[^"]*\bhidden xl:inline"/)
    const d = drawer(html)
    expect(d.indexOf('href="/about"')).toBeGreaterThan(d.indexOf('href="/olim"'))
    expect(d.indexOf('href="/about"')).toBeLessThan(d.indexOf('href="/support"'))
  })

  it('marks About as the current page on /about', () => {
    expect(desktop(render('en', createElement(Navbar)))).toMatch(/href="\/about" aria-current="page"|aria-current="page"[^>]*href="\/about"/)
  })

  it('members do not get it in their bar or drawer', () => {
    expect(render('en', createElement(Navbar), { uid: 'u1' })).not.toContain('href="/about"')
  })
})

describe('founders in structured data', () => {
  it('lists both co-founders on the Organization', () => {
    expect(organizationJsonLd().founder).toEqual([
      { '@type': 'Person', name: 'Amit Bar-David' },
      { '@type': 'Person', name: 'Omer Hirshberg' },
    ])
  })
})
