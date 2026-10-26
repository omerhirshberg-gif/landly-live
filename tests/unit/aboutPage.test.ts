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
      expect(html).toContain(`>${esc(t[founder.roleKey])}</p>`)
    }
    expect(html).toContain(`>${esc(t.about_mission_title)}</h2>`)
    expect(html).toContain(esc(t.about_mission_text))
    expect(html).toContain(`>${esc(t.about_cta_title)}</h2>`)
    expect(html.split('class="section-divider')).toHaveLength(4)
  })

  it('uses the approved names, roles and bios', () => {
    expect(FOUNDERS.map((f) => f.name)).toEqual(['Omer Hirshberg', 'Amit Bar-David'])
    expect(translations.he.about_name_amit).toBe('עמית בר-דוד')
    expect(translations.he.about_name_omer).toBe('עומר הירשברג')
    expect(translations.en.about_bio_amit).toBe('Former IDF Armored Corps tank commander and Computer Science student. Co-founded Landly as CTO to ease the financial landing for Olim and empower Olim-owned businesses through accessible digital commerce.')
    expect(translations.en.about_bio_omer).toBe('Former Israeli Navy officer and Economics student. Co-founded Landly to ease the financial landing for Olim and empower Olim-owned businesses through accessible digital commerce.')
    expect(translations.he.about_bio_amit).toBe('סטודנט למדעי המחשב ומפקד טנק בחיל השריון לשעבר. שותף-מייסד ו-CTO ב-Landly מתוך מטרה להקל על הנחיתה הכלכלית של עולים חדשים ולהעצים עסקים בבעלות עולים באמצעות מסחר דיגיטלי נגיש.')
    expect(translations.he.about_bio_omer).toBe('קצין חיל הים לשעבר וסטודנט לכלכלה. שותף-מייסד ב-Landly מתוך מטרה להקל על הנחיתה הכלכלית של עולים חדשים ולהעצים עסקים בבעלות עולים באמצעות מסחר דיגיטלי נגיש.')
    expect(translations.he.footer_about).toBe('אודות')
    expect(translations.he.nav_about).toBe('אודות')
    expect(translations.en.about_title).toBe('Our Story')
    expect(translations.he.about_title).toBe('הסיפור שלנו')
    expect(translations.en.about_role_cofounder).toBe('Co-Founder')
    expect(translations.en.about_role_cofounder_cto).toBe('Co-Founder & CTO')
    expect(translations.he.about_role_cofounder_cto).toBe('שותף-מייסד ו-CTO')
    expect(FOUNDERS.map((f) => f.roleKey)).toEqual(['about_role_cofounder', 'about_role_cofounder_cto'])
  })

  it('stacks the founder cards on phones and puts them side by side from md, in the specified card style', () => {
    const html = render('en', createElement(AboutPage))
    expect(html).toContain('<div class="grid grid-cols-1 md:grid-cols-2 gap-5">')
    const cards = html.match(/<article aria-labelledby="founder-[^"]+" class="([^"]*)"/g) ?? []
    expect(cards).toHaveLength(2)
    for (const card of cards) {
      for (const c of ['h-full', 'bg-white', 'rounded-2xl', 'p-6', 'sm:p-8', 'border', 'border-slate-200/80', 'shadow-card', 'before:h-1', 'before:from-brand', '[@media(hover:hover)]:hover:-translate-y-1', '[@media(hover:hover)]:hover:shadow-card-hover']) {
        expect(card.split('"')[3].split(' ')).toContain(c)
      }
    }
  })

  it("holds a fixed 128px round portrait: Omer's photo, Amit's slate monogram until his is set, and the role as an editorial subtitle", async () => {
    const html = render('en', createElement(AboutPage))
    expect(html.split('<div class="h-32 w-32 flex-shrink-0 overflow-hidden rounded-full border border-line ')).toHaveLength(3)
    const subtitle = '<p class="mt-1.5 mb-3 text-xs sm:text-sm font-semibold uppercase tracking-[0.18em] rtl:tracking-normal text-brand">'
    expect(html).toContain(`${subtitle}${translations.en.about_role_cofounder}</p>`)
    expect(html).toContain(`${subtitle}${esc(translations.en.about_role_cofounder_cto)}</p>`)
    // No capsule: the role carries no pill background or border.
    expect(html).not.toContain('bg-brandTint px-2.5')
    expect(html).toMatch(/from-slate-100 to-slate-200[^"]*text-slate-700[^"]*">AB<\/span>/)
    expect(html).not.toContain('ds-avatar-fallback')
    expect(html).not.toContain('>OH</span>')
    expect(html).toContain('<img src="/images/team/omer-hirshberg.jpg" alt="Omer Hirshberg - Co-Founder" width="128" height="128" class="h-full w-full object-cover"/>')
    const { existsSync } = await import('node:fs')
    expect(existsSync('public/images/team/omer-hirshberg.jpg')).toBe(true)
  })

  it.each([
    ['omer', 'omerhirshberg', 'Omer Hirshberg'],
    ['amit', 'amit-bar-david-a934a034b', 'Amit Bar-David'],
  ])('links %s to LinkedIn in a new tab, with a translated accessible name', (id, slug, name) => {
    const en = render('en', createElement(AboutPage))
    const card = en.slice(en.indexOf(`id="founder-${id}"`), en.indexOf('</article>', en.indexOf(`id="founder-${id}"`)))
    expect(card).toMatch(new RegExp(`<a href="https://www\\.linkedin\\.com/in/${slug}" target="_blank" rel="noopener noreferrer" aria-label="${name} LinkedIn profile" class="[^"]*min-h-\\[38px\\][^"]*focus-visible:outline[^"]*"><svg [^>]*stroke-width="1.75"[^>]*class="h-4 w-4"[^>]*>.*?</svg><span>LinkedIn</span></a>`))
    const he = render('he', createElement(AboutPage))
    const nameKey = id === 'omer' ? 'about_name_omer' : 'about_name_amit'
    expect(he).toContain(`aria-label="${translations.he.about_linkedin_label.replace('{name}', translations.he[nameKey])}"`)
  })

  it('gives both cards the same LinkedIn button, anchored to the card foot so they share a baseline', () => {
    const en = render('en', createElement(AboutPage))
    // The text column stretches to the card's height; the button row takes the slack above it.
    expect(en.split('<div class="flex min-w-0 flex-1 flex-col self-stretch">')).toHaveLength(3)
    expect(en.match(/<div class="mt-auto pt-6"><a href="https:\/\/www\.linkedin\.com\/in\//g)).toHaveLength(2)
    // A 38px pill with a 44px hit area (3px either side), like every tap target on the site.
    expect(en).toContain("min-h-[38px]")
    expect(en).toContain("before:-inset-y-[3px]")
    const buttons = en.match(/<a href="https:\/\/www\.linkedin\.com\/in\/[^"]+" target="_blank" rel="noopener noreferrer" aria-label="[^"]*" class="([^"]*)"/g) ?? []
    expect(buttons).toHaveLength(2)
    expect(new Set(buttons.map((b) => b.split('class="')[1])).size).toBe(1)
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

  it('introduces Omer first, then Amit', () => {
    const html = render('en', createElement(AboutPage))
    expect(html.indexOf('id="founder-omer"')).toBeGreaterThan(-1)
    expect(html.indexOf('id="founder-omer"')).toBeLessThan(html.indexOf('id="founder-amit"'))
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
  const desktop = (html: string) => html.slice(html.indexOf('class="hidden lg:flex'), html.indexOf('class="flex items-center gap-2.5 lg:gap-3 flex-shrink-0 justify-self-end"'))
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
      { '@type': 'Person', name: 'Omer Hirshberg' },
      { '@type': 'Person', name: 'Amit Bar-David' },
    ])
  })
})
