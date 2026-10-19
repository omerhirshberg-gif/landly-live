import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, Lang, TranslationKey } from '@/lib/i18n/translations'
import { APP_VERSION } from '@/lib/config'

const authState: { user: { uid: string } | null } = { user: null }

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: () => {} }) }))
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }))
vi.mock('@/lib/firebase/config', () => ({ auth: {} }))
vi.mock('@/lib/firebase/users', () => ({ updateUserLanguage: vi.fn() }))
vi.mock('@/lib/firebase/useAuth', () => ({ useAuth: () => ({ user: authState.user, loading: false }) }))
const wishlistState: { wishlistIds: string[] } = { wishlistIds: [] }
// The badges show wishlistCount (saved perks whose offer still exists); here every id resolves.
vi.mock('@/lib/firebase/useWishlist', () => ({ useWishlist: () => ({ ...wishlistState, wishlistCount: wishlistState.wishlistIds.length }) }))

const { default: Navbar } = await import('@/components/layout/Navbar')

function render(lang: Lang, { loggedIn = false } = {}) {
  authState.user = loggedIn ? { uid: 'u1' } : null
  const t = (key: TranslationKey) => translations[lang][key]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(
    createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, createElement(Navbar))
  )
}

// The bar's physical order is fixed in every language: logo left, language
// switcher then hamburger on the right — Hebrew must not mirror it.
describe('navbar layout lock', () => {
  const cases = (['en', 'he'] as const).flatMap((lang) => [false, true].map((loggedIn) => ({ lang, loggedIn })))

  it.each(cases)('keeps logo → language switcher → hamburger left-to-right ($lang, loggedIn=$loggedIn)', ({ lang, loggedIn }) => {
    const html = render(lang, { loggedIn })
    const nav = html.slice(0, html.indexOf('</nav>'))
    expect(nav).toMatch(/<nav[^>]*><div dir="ltr"/)

    const logo = nav.indexOf('alt="Landly"')
    const langSwitch = nav.indexOf('fa-globe')
    const hamburger = nav.indexOf('aria-label="Menu"')
    expect(logo).toBeGreaterThan(-1)
    expect(logo).toBeLessThan(langSwitch)
    expect(langSwitch).toBeLessThan(hamburger)
  })

  it('anchors the language menu under the right-hand trigger in every direction', () => {
    for (const lang of ['en', 'he'] as const) {
      expect(render(lang)).toMatch(/class="lang-menu[^"]*" style="right:0;left:auto"/)
    }
  })

  it('lets the centre links and language menu follow the page direction', () => {
    const he = render('he')
    expect(he).toMatch(/<div dir="rtl" class="hidden lg:flex/)
    expect(he).toMatch(/<div dir="rtl" class="lang-menu/)
    expect(render('en')).toMatch(/<div dir="ltr" class="hidden lg:flex/)
  })

  it('leaves the mobile drawer to the page direction', () => {
    const he = render('he')
    const drawer = he.slice(he.indexOf('</nav>'))
    expect(drawer).toMatch(/^<\/nav><div id="mobile-menu" class="mobile-menu/)
    expect(drawer).not.toContain('dir="ltr"')
  })

  it('never locks the language switcher (the old /business English lock is gone)', () => {
    const html = render('he')
    expect(html).not.toContain('lang-locked')
    expect(html).toContain('>HE<')
    expect(html).toMatch(/<div dir="rtl" class="hidden lg:flex/)
  })
})

describe('desktop Deals link', () => {
  it.each(['en', 'he'] as const)('opens the /categories catalog, not the #deals overview (%s)', (lang) => {
    const nav = render(lang).slice(0, render(lang).indexOf('</nav>'))
    expect(nav).toMatch(new RegExp(`href="/categories">${translations[lang].nav_deals}<`))
    expect(nav).not.toContain('href="/#deals"')
  })
})

describe('mobile drawer', () => {
  const drawer = (lang: Lang, loggedIn = false) => {
    const html = render(lang, { loggedIn })
    return html.slice(html.indexOf('</nav>'))
  }

  it('leads guests with Home, then the consumer links', () => {
    const d = drawer('en')
    const home = d.search(new RegExp(`<a [^>]*href="/"[^>]*>(?:(?!</a>).)*>${translations.en.nav_home}<`))
    expect(home).toBeGreaterThan(-1)
    expect(home).toBeLessThan(d.indexOf('href="/#how"'))
    expect(d.indexOf('href="/#how"')).toBeLessThan(d.indexOf('href="/olim"'))
    expect(d.indexOf('href="/#how"')).toBeLessThan(d.indexOf('href="/olim"'))
    expect(d.indexOf('href="/olim"')).toBeLessThan(d.indexOf('href="/support"'))
    expect(d).not.toContain('href="/#deals"')
  })

  it('sends guests to the /categories catalog from Deals, right after Home', () => {
    const d = drawer('en')
    const deals = d.search(new RegExp(`href="/categories">(?:(?!</a>).)*>${translations.en.nav_deals}<`))
    expect(deals).toBeGreaterThan(-1)
    expect(deals).toBeGreaterThan(d.indexOf(`>${translations.en.nav_home}<`))
    expect(deals).toBeLessThan(d.indexOf('href="/#how"'))
  })

  it.each(['en', 'he'] as const)('lists Partner with Us after Making Aliyah?, before About and Support, styled like its neighbours (%s)', (lang) => {
    const d = drawer(lang)
    const link = d.match(/<a class="([^"]*)" href="\/business">(.*?)<\/a>/)!
    expect(link[2]).toContain('fa-handshake')
    expect(link[2]).toContain(`>${translations[lang].nav_partner}<`)
    expect(link[1]).toBe(d.match(/<a class="([^"]*)" href="\/about">/)![1])
    const partner = d.indexOf('href="/business"')
    expect(partner).toBeGreaterThan(d.indexOf('href="/olim"'))
    expect(partner).toBeLessThan(d.indexOf('href="/about"'))
    expect(d.indexOf('href="/about"')).toBeLessThan(d.indexOf('href="/support"'))
  })

  it('never offers members Partner with Us or any business link', () => {
    const d = drawer('en', true)
    expect(d).not.toContain('href="/business')
    expect(d).not.toContain(`>${translations.en.nav_partner}<`)
  })

  it('offers one Sign In button with a quiet sign-up link, and no Explore Perks button', () => {
    const d = drawer('he')
    expect(d).not.toContain(`>${translations.he.nav_cta}<`)
    expect(d).toMatch(/class="ds-btn ds-btn-primary ds-btn-md w-full" href="\/login">התחברות</)
    expect(d.indexOf('href="/signup"')).toBeGreaterThan(d.indexOf('href="/login"'))
    expect(d).toContain(translations.he.nav_new_to_landly)
  })

  it('spaces the language switcher and the close button apart', () => {
    const html = render('en')
    expect(html).toMatch(/<div class="flex items-center gap-3 flex-shrink-0 justify-self-end">/)
  })
})

describe('header account actions', () => {
  it.each(['en', 'ru', 'es', 'fr', 'he'] as const)('signed out: blue Sign Up pill, then white Sign In pill, then the language switcher (%s)', (lang) => {
    const html = render(lang)
    const nav = html.slice(0, html.indexOf('</nav>'))
    const t = translations[lang]
    expect(nav).not.toContain(`>${t.nav_cta}<`)
    const signUp = nav.search(new RegExp(`class="[^"]*bg-brand text-white[^"]*" href="/signup">${t.signup_title}<`))
    const signIn = nav.search(new RegExp(`class="[^"]*bg-\\[#FFFFFF\\][^"]*" href="/login">${t.nav_login}<`))
    expect(signUp).toBeGreaterThan(-1)
    expect(signIn).toBeGreaterThan(signUp)
    expect(signIn).toBeLessThan(nav.indexOf('fa-globe'))
  })

  it.each(['en', 'he'] as const)('signed in: the bar links are Home, Explore Perks, Wishlist, My Pass, Making Aliyah? and Support (%s)', (lang) => {
    const html = render(lang, { loggedIn: true })
    const nav = html.slice(0, html.indexOf('</nav>'))
    const t = translations[lang]
    const centre = nav.slice(nav.indexOf('class="hidden lg:flex'), nav.indexOf('class="flex items-center gap-3 flex-shrink-0 justify-self-end"'))
    const hrefs = [...centre.matchAll(/href="([^"]*)"/g)].map((m) => m[1])
    expect(hrefs).toEqual(['/', '/categories', '/wishlist', '/member', '/olim', '/support'])
    for (const label of [t.nav_home, t.nav_cta, t.nav_wishlist, t.nav_my_pass, t.nav_olim, t.nav_support]) expect(centre).toContain(`>${label}<`)
    // The avatar menu is the account: no Profile text link in the bar.
    expect(centre).not.toContain(`>${t.nav_profile}<`)
    // On / the Home link is the current page.
    expect(centre).toMatch(new RegExp(`href="/"[^>]*aria-current="page"[^>]*>${t.nav_home}<`))
  })

  it('signed in: the avatar pill hides the first name until xl so five links fit at 1024px', () => {
    const nav = render('en', { loggedIn: true }).split('</nav>')[0]
    const pill = nav.slice(nav.indexOf('aria-haspopup="menu"'), nav.indexOf('</button>', nav.indexOf('aria-haspopup="menu"')))
    expect(pill).toMatch(/<span dir="ltr" class="hidden xl:inline /)
  })

  it('signed out: the bar still offers Home', () => {
    const nav = render('en').slice(0, render('en').indexOf('</nav>'))
    expect(nav).toMatch(new RegExp(`href="/"[^>]*>${translations.en.nav_home}<`))
  })

  it.each(['en', 'he'] as const)('signed in: an avatar pill opens the account menu instead of a plain Sign Out button (%s)', (lang) => {
    const html = render(lang, { loggedIn: true })
    const nav = html.slice(0, html.indexOf('</nav>'))
    const t = translations[lang]
    expect(nav).toMatch(new RegExp(`<button type="button" aria-haspopup="menu" aria-expanded="false" aria-label="${t.account_menu_label}"`))
    expect(nav).toContain('ds-avatar-fallback')
    expect(nav).not.toContain('fa-arrow-right-from-bracket')
    expect(nav).not.toContain(`>${t.nav_logout}<`)
    // The pill sits before the divider and the language picker.
    expect(nav.indexOf('aria-haspopup="menu"')).toBeLessThan(nav.indexOf('fa-globe'))
  })

  it('signed in: drops the How it works link but keeps Making Aliyah', () => {
    const html = render('en', { loggedIn: true })
    const nav = html.slice(0, html.indexOf('</nav>'))
    const drawer = html.slice(html.indexOf('</nav>'))
    for (const part of [nav, drawer]) {
      expect(part).not.toContain('href="/#how"')
      expect(part).toContain('href="/olim"')
    }
  })

  it.each(['en', 'he'] as const)('signed in: the drawer runs member card, Home, My Pass, Explore Perks, Wishlist, Making Aliyah?, then Settings (%s)', (lang) => {
    const html = render(lang, { loggedIn: true })
    const drawer = html.slice(html.indexOf('</nav>'))
    const t = translations[lang]
    expect([...drawer.matchAll(/href="([^"]*)"/g)].map((m) => m[1])).toEqual(['/profile', '/', '/member', '/categories', '/wishlist', '/olim', '/settings'])
    expect(drawer).toContain(`>${t.nav_home}<`)
    expect(drawer).not.toContain(`>${t.nav_perks}<`)
    // Preferences live on /settings now: no accordions, language buttons, security or legal links in the drawer.
    expect(drawer).not.toContain('aria-expanded')
    expect(drawer).not.toMatch(/<button[^>]*lang="[a-z]{2}"/)
    expect(drawer).not.toContain('fa-shield-halved')
    expect(drawer).not.toContain('href="/terms"')
    expect(drawer).not.toContain('fa-bell')
  })

  it.each(['en', 'he'] as const)('signed in: the member card is a soft /profile card with only the avatar and name (%s)', (lang) => {
    const html = render(lang, { loggedIn: true })
    const drawer = html.slice(html.indexOf('</nav>'))
    const card = drawer.match(/<a [^>]*href="\/profile"[^>]*>(.*?)<\/a>/)!
    const cls = card[0].match(/class="([^"]*)"/)![1].split(' ')
    for (const c of ['tap-target', 'rounded-2xl', 'border-slate-100', 'bg-slate-50', 'p-4', 'active:bg-slate-100']) expect(cls).toContain(c)
    expect(card[1]).toContain('ds-avatar-fallback')
    expect(card[1]).toContain('width:44px')
    // The test member has no profile, so the card names the destination instead.
    expect(card[1]).toContain('<span class="min-w-0 flex-1 truncate text-[16px] font-bold text-ink">' + translations[lang].nav_profile + '</span>')
    // No email, badge or chevron.
    expect(card[1]).not.toContain('@')
    expect(card[1]).not.toContain('rounded-full bg-emerald')
    expect(card[1]).not.toContain('fa-chevron')
  })

  it.each(['en', 'ru', 'es', 'fr', 'he'] as const)('signed in: My Pass is a plain link row to /member right under Home, with no promo card (%s)', (lang) => {
    const html = render(lang, { loggedIn: true })
    const drawer = html.slice(html.indexOf('</nav>'))
    const t = translations[lang]
    const home = drawer.match(/<a [^>]*href="\/"[^>]*>.*?<\/a>/)!
    const pass = drawer.match(/<a class="([^"]*)" href="\/member">(.*?)<\/a>/)!
    // Home is immediately followed by My Pass.
    expect(drawer.indexOf(pass[0])).toBe(drawer.indexOf(home[0]) + home[0].length)
    // Same 48px row as the other links: no gradient, no card.
    const homeClass = home[0].match(/class="([^"]*)"/)![1]
    expect(pass[1].replace(/ text-brand bg-brandLight| text-ink/, '')).toBe(homeClass.replace(/ text-brand bg-brandLight| text-ink/, ''))
    for (const c of ['min-h-[48px]', 'rounded-xl', 'active:bg-slate-100']) expect(pass[1].split(' ')).toContain(c)
    expect(pass[2]).toContain('fa-qrcode')
    expect(pass[2]).toContain('>' + t.nav_my_pass + '<')
    const links = drawer.slice(drawer.indexOf(home[0]), drawer.indexOf('href="/settings"'))
    expect(links).toContain('href="/olim"')
    expect(links).not.toContain('fa-chevron')
    expect(drawer).not.toContain('bg-[linear-gradient')
    expect(drawer).not.toContain(t.nav_pass_title)
  })

  it.each(['en', 'he'] as const)('signed in: Sign Out is a red destructive button in the sticky, safe-area footer (%s)', (lang) => {
    const html = render(lang, { loggedIn: true })
    const drawer = html.slice(html.indexOf('</nav>'))
    const footer = drawer.match(/<div class="sticky bottom-0[^"]*" style="padding-bottom:calc\(0\.75rem \+ env\(safe-area-inset-bottom\)\)">(.*?)<\/div>/)!
    const button = footer[1].match(/<button type="button" class="([^"]*)">(.*?)<\/button>/)!
    const cls = button[1].split(' ')
    for (const c of ['h-12', 'w-full', 'rounded-[14px]', 'border-red-200', 'text-red-600', '[@media(hover:hover)]:hover:bg-red-50', 'active:bg-red-100']) expect(cls).toContain(c)
    expect(button[2]).toContain(`${translations[lang].nav_logout}`)
    // Sign Out is the last thing in the drawer: no legal links below it.
    expect(drawer.indexOf('href="/terms"')).toBeLessThan(drawer.indexOf('class="sticky bottom-0'))
  })

  it('signed in: Wishlist is a centre link with no badge while nothing is saved', () => {
    wishlistState.wishlistIds = []
    const nav = render('en', { loggedIn: true }).split('</nav>')[0]
    const link = nav.match(/<a [^>]*href="\/wishlist"[^>]*>(.*?)<\/a>/)!
    expect(link[1]).toBe(`<span class="truncate">${translations.en.nav_wishlist}</span>`)
    expect(nav).not.toContain('fa-heart')
  })

  it('signed in: the Wishlist badge sits beside the label (outside its truncation) and caps at 99+', () => {
    wishlistState.wishlistIds = ['a', 'b', 'c']
    let link = render('en', { loggedIn: true }).match(/<a [^>]*href="\/wishlist"[^>]*>(.*?)<\/a>/)!
    expect(link[0]).toMatch(/class="inline-flex min-w-0 items-center gap-1.5 /)
    expect(link[1]).toMatch(/^<span class="truncate">[^<]*<\/span><span class="flex-shrink-0 [^"]*bg-brand[^"]*">3<\/span>$/)
    wishlistState.wishlistIds = Array.from({ length: 120 }, (_, i) => String(i))
    link = render('he', { loggedIn: true }).match(/<a [^>]*href="\/wishlist"[^>]*>(.*?)<\/a>/)!
    expect(link[1]).toContain('>99+</span>')
    wishlistState.wishlistIds = []
  })

  it('signed in: from lg the bar is three columns with equal outer columns, so the links sit in the true centre', () => {
    const nav = render('en', { loggedIn: true }).split('</nav>')[0]
    expect(nav).toMatch(/<div dir="ltr" class="[^"]*lg:grid lg:grid-cols-\[1fr_minmax\(0,max-content\)_1fr\][^"]*">/)
    expect(nav).toMatch(/<a href="\/" class="[^"]*justify-self-start[^"]*">/)
    expect(nav).toContain('class="flex items-center gap-3 flex-shrink-0 justify-self-end"')
  })

  it('signed in: no dialogs are mounted (Privacy & Security is its own page, /settings/privacy-security)', () => {
    const html = render('en', { loggedIn: true })
    expect(html).not.toContain('<dialog')
  })
})

describe('header has no business icon', () => {
  it.each([false, true])('no store icon or business-login shortcut (loggedIn=%s)', (loggedIn) => {
    const html = render('en', { loggedIn })
    const nav = html.slice(0, html.indexOf('</nav>'))
    expect(nav).not.toContain('fa-store')
    expect(nav).not.toContain('href="/business/login"')
    if (!loggedIn) expect(nav).toContain('href="/business"')
  })
})

describe('button hierarchy', () => {
  it('navbar: blue Sign Up pill and white Sign In pill, same size and shape, gap-4 apart', () => {
    const html = render('en')
    const nav = html.slice(0, html.indexOf('</nav>'))
    expect(nav).toMatch(/<div class="hidden lg:flex items-center gap-4"><a class="[^"]*" href="\/signup">/)
    const signUp = nav.match(/<a class="([^"]*)" href="\/signup">([^<]*)<\/a>/)!
    const signIn = nav.match(/<a class="([^"]*)" href="\/login">([^<]*)<\/a>/)!
    expect(signUp[2]).toBe('Sign Up')
    expect(signIn[2]).toBe('Sign In')
    const upClasses = signUp[1].split(' ')
    const inClasses = signIn[1].split(' ')
    for (const c of ['bg-brand', 'text-white', 'font-bold', '[@media(hover:hover)]:hover:bg-brandDark', 'border-transparent']) expect(upClasses).toContain(c)
    for (const c of ['bg-[#FFFFFF]', 'text-[#0B1B3D]', 'border-[#E2E8F0]', '[@media(hover:hover)]:hover:border-slate-300', '[@media(hover:hover)]:hover:text-brand']) expect(inClasses).toContain(c)
    // Identical box: same padding, text size, radius and a 1px border on both.
    for (const c of ['px-4', 'py-2', 'text-[13px]', 'rounded-full', 'border']) {
      expect(upClasses).toContain(c)
      expect(inClasses).toContain(c)
    }
  })

  it('hero: Explore Perks and Sign In share height, padding and radius', async () => {
    const { default: Hero } = await import('@/components/home/Hero')
    const t = (key: TranslationKey) => translations.he[key]
    const html = renderToStaticMarkup(
      createElement(LangContext.Provider, { value: { lang: 'he', setLang: () => {}, t, isRtl: true } }, createElement(Hero))
    )
    const primary = html.match(/<a class="([^"]*)" href="\/signup">/)![1]
    const secondary = html.match(/<a class="([^"]*)" href="\/login">/)![1]
    for (const shared of ['min-h-[52px]', 'px-8', 'py-3.5', 'rounded-full', 'border', '[@media(hover:hover)]:hover:-translate-y-0.5']) {
      expect(primary.split(' ')).toContain(shared)
      expect(secondary.split(' ')).toContain(shared)
    }
    // Whole class names, so two classes run together (a lost space) fail here.
    for (const c of ['bg-brand', 'hover:bg-brandDark']) expect(primary.split(' ')).toContain(c)
    for (const c of ['bg-[#FFFFFF]', 'border-[#E2E8F0]', 'text-[#0B1B3D]', 'hover:bg-slate-50', 'hover:border-slate-300']) {
      expect(secondary.split(' ')).toContain(c)
    }
    // "Get Started" (בואו נתחיל), with its arrow mirrored for right-to-left.
    expect(html).toContain('>בואו נתחיל<')
    expect(html).toContain('fa-arrow-right text-sm rtl:-scale-x-100')
  })
})

describe('mobile drawer: signed-out layout', () => {
  const drawer = (lang: Lang, loggedIn = false) => {
    const html = render(lang, { loggedIn })
    return html.slice(html.indexOf('</nav>'))
  }

  it.each(['en', 'he'] as const)('gives every guest link a Font Awesome icon tile, with no images (%s)', (lang) => {
    const d = drawer(lang)
    const links = d.slice(0, d.indexOf('href="/settings"'))
    for (const icon of ['fa-house', 'fa-gift', 'fa-list-check', 'fa-plane-departure', 'fa-handshake', 'fa-circle-info', 'fa-headset']) expect(links).toContain(`fa-solid ${icon}`)
    expect(d).not.toContain('<svg')
    expect(d).not.toContain('<img')
  })

  it('gives every menu item a 48px rounded touch target', () => {
    const d = drawer('en')
    for (const href of ['/#how', '/olim', '/support', '/business']) {
      const cls = d.match(new RegExp(`class="([^"]*)" href="${href}"`))![1]
      expect(cls).toContain('min-h-[48px]')
      expect(cls).toContain('rounded-xl')
      expect(cls).toContain('active:bg-slate-100')
    }
  })

  it.each(['en', 'he'] as const)('runs links, then Settings, then Sign In, Sign Up and the contact line, with no promo card (%s)', (lang) => {
    const d = drawer(lang)
    const t = translations[lang]
    expect(d).not.toContain('bg-[#F0F7FF]')
    expect(d).not.toContain('Live Israel Like a Local')
    expect(d).toMatch(/class="ds-btn ds-btn-primary ds-btn-md w-full" href="\/login">/)
    expect(d.indexOf('href="/settings"')).toBeGreaterThan(d.indexOf('href="/business"'))
    expect(d.indexOf('href="/login"')).toBeGreaterThan(d.indexOf('href="/settings"'))
    expect(d.indexOf('href="/signup"')).toBeGreaterThan(d.indexOf('href="/login"'))
    expect(d.indexOf('team.landly@gmail.com')).toBeGreaterThan(d.indexOf('href="/signup"'))
    expect(d).toContain('<bdi>Landly</bdi>')
    expect(d).not.toContain('Ltd')
    // Guests get no Sign Out, and no loose legal links (they're on /settings).
    expect(d).not.toContain(`>${t.nav_logout}<`)
    expect(d).not.toContain('href="/terms"')
  })
})

describe('mobile drawer: Settings link', () => {
  it.each(['en', 'ru', 'es', 'fr', 'he'] as const)('is one gear row with a direction-aware chevron that opens /settings, for guests and members (%s)', (lang) => {
    const t = translations[lang]
    for (const loggedIn of [false, true]) {
      const html = render(lang, { loggedIn })
      const d = html.slice(html.indexOf('</nav>'))
      const link = d.match(/<a class="([^"]*)" href="\/settings">(.*?)<\/a>/)!
      for (const c of ['min-h-[48px]', 'rounded-xl', '[@media(hover:hover)]:hover:bg-slate-50', 'active:bg-slate-100']) expect(link[1].split(' ')).toContain(c)
      expect(link[2]).toContain('fa-gear')
      expect(link[2]).toContain('>' + t.nav_settings_heading + '<')
      expect(link[2]).toMatch(/fa-chevron-right[^"]*rtl:-scale-x-100/)
      expect(d).not.toContain('<h2')
    }
  })
})

describe('mobile drawer: Home link', () => {
  it.each(['en', 'ru', 'es', 'fr', 'he'] as const)('is the first item, styled like the others (%s)', (lang) => {
    const html = render(lang)
    const d = html.slice(html.indexOf('</nav>'))
    const firstTag = d.match(/<a [^>]*>(?:(?!<\/a>).)*<\/a>/)![0]
    expect(firstTag).toContain('href="/"')
    expect(firstTag).toContain('fa-house')
    expect(firstTag).toContain(`<span class="min-w-0 flex-1">${translations[lang].nav_home}</span>`)
    const homeClass = firstTag.match(/class="([^"]*)"/)![1]
    const how = d.match(/<a class="([^"]*)" href="\/#how">/)![1]
    expect(homeClass).toContain('min-h-[48px]')
    expect(homeClass.replace(/ text-brand bg-brandLight| text-ink/, '')).toBe(how.replace(/ text-brand bg-brandLight| text-ink/, ''))
  })
})

describe('account capsules, divider and language picker', () => {
  const navOf = (lang: Lang, loggedIn = false) => {
    const html = render(lang, { loggedIn })
    return html.slice(0, html.indexOf('</nav>'))
  }

  it.each([false, true])('puts a hairline divider between the account buttons and the language picker (loggedIn=%s)', (loggedIn) => {
    const nav = navOf('en', loggedIn)
    const divider = nav.indexOf('<div class="hidden lg:block h-4 w-[1px] bg-slate-200 mx-1" aria-hidden="true"></div>')
    expect(divider).toBeGreaterThan(nav.indexOf(loggedIn ? 'aria-haspopup="menu"' : 'href="/login"'))
    expect(divider).toBeLessThan(nav.indexOf('fa-globe'))
  })

  it('styles the language trigger as a plain, non-capsule control', () => {
    const trigger = navOf('en').match(/<button type="button" aria-expanded="false" aria-haspopup="true" class="([^"]*)">/)![1].split(' ')
    for (const c of ['[@media(hover:hover)]:hover:bg-slate-100', 'rounded-lg', 'px-2.5', 'py-1.5']) expect(trigger).toContain(c)
    expect(trigger).not.toContain('rounded-full')
    expect(trigger.filter((c) => c === 'border' || c.startsWith('border-'))).toEqual([])
  })

  it.each(['en', 'he'] as const)('lists all five languages as keyboard-reachable buttons, marking the current one (%s)', (lang) => {
    const nav = navOf(lang)
    const items = [...nav.matchAll(/<button type="button" lang="([a-z]{2})"( aria-current="true")? class="lang-item/g)]
    expect(items.map((m) => m[1])).toEqual(['en', 'ru', 'es', 'fr', 'he'])
    expect(items.filter((m) => m[2]).map((m) => m[1])).toEqual([lang])
    expect(nav).toContain(`>${lang.toUpperCase()}<`)
  })
})

describe('language picker placement', () => {
  it.each([false, true])('below lg the bar is only the logo and the hamburger (loggedIn=%s)', (loggedIn) => {
    const html = render('en', { loggedIn })
    const nav = html.slice(0, html.indexOf('</nav>'))
    // Everything between the logo and the hamburger is desktop-only.
    expect(nav).toContain('<div class="lang-dropdown hidden lg:block">')
    expect(nav).toContain('class="hidden lg:block h-4 w-[1px] bg-slate-200 mx-1"')
    expect(nav).toContain('<div class="hidden lg:flex items-center gap-4">')
    expect(nav).not.toMatch(/class="[^"]*\bsm:(flex|block)\b/)
    // No heart button in the bar any more: Wishlist is a centre link.
    expect(nav).not.toContain('fa-heart')
    expect(nav).toMatch(/<button type="button" class="lg:hidden [^"]*" aria-label="Menu" aria-expanded="false" aria-controls="mobile-menu">/)
    expect(nav.indexOf('fa-globe')).toBeLessThan(nav.indexOf('aria-label="Menu"'))
    expect(nav).toContain('<div class="flex items-center gap-3 flex-shrink-0 justify-self-end">')
  })

  it.each(['en', 'he'] as const)('the drawer has no language controls: they are on /settings (%s)', (lang) => {
    for (const loggedIn of [false, true]) {
      const html = render(lang, { loggedIn })
      const drawer = html.slice(html.indexOf('</nav>'))
      expect(drawer).not.toMatch(/<button[^>]*lang="[a-z]{2}"/)
      expect(drawer).toContain('href="/settings"')
    }
  })
})
