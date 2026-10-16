import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, Lang, TranslationKey } from '@/lib/i18n/translations'

const authState: { user: { uid: string } | null } = { user: null }

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: () => {} }) }))
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }))
vi.mock('@/lib/firebase/config', () => ({ auth: {} }))
vi.mock('@/lib/firebase/users', () => ({ updateUserLanguage: vi.fn() }))
vi.mock('@/lib/firebase/useAuth', () => ({ useAuth: () => ({ user: authState.user, loading: false }) }))
vi.mock('@/lib/firebase/useWishlist', () => ({ useWishlist: () => ({ wishlistIds: [] }) }))

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
    expect(drawer).toMatch(/^<\/nav><div class="mobile-menu/)
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
    const home = d.search(new RegExp(`<a [^>]*href="/"[^>]*>${translations.en.nav_home}<`))
    expect(home).toBeGreaterThan(-1)
    expect(home).toBeLessThan(d.indexOf('href="/#how"'))
    expect(d.indexOf('href="/#how"')).toBeLessThan(d.indexOf('href="/olim"'))
    expect(d.indexOf('href="/#how"')).toBeLessThan(d.indexOf('href="/olim"'))
    expect(d.indexOf('href="/olim"')).toBeLessThan(d.indexOf('href="/support"'))
    expect(d).not.toContain('href="/#deals"')
  })

  it('sends guests to the /categories catalog from Deals, right after Home', () => {
    const d = drawer('en')
    const deals = d.indexOf(`href="/categories">${translations.en.nav_deals}<`)
    expect(deals).toBeGreaterThan(d.indexOf(`>${translations.en.nav_home}<`))
    expect(deals).toBeLessThan(d.indexOf('href="/#how"'))
  })

  it('puts For Businesses under a divider, after the consumer links', () => {
    const d = drawer('en')
    const divider = d.indexOf('border-t border-slate-100')
    expect(divider).toBeGreaterThan(d.indexOf('href="/support"'))
    expect(d.indexOf('href="/business"')).toBeGreaterThan(divider)
  })

  it('offers one Sign In button with a quiet sign-up link, and no Explore Perks button', () => {
    const d = drawer('he')
    expect(d).not.toContain(`>${translations.he.nav_cta}<`)
    expect(d).toMatch(/class="[^"]*bg-brand[^"]*" href="\/login">התחברות</)
    expect(d.indexOf('href="/signup"')).toBeGreaterThan(d.indexOf('href="/login"'))
    expect(d).toContain(translations.he.nav_new_to_landly)
  })

  it('spaces the language switcher and the close button apart', () => {
    const html = render('en')
    expect(html).toMatch(/<div class="flex items-center gap-3 flex-shrink-0">/)
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

  it.each(['en', 'he'] as const)('signed in: the bar links are Explore Perks, Making Aliyah? and Support only (%s)', (lang) => {
    const html = render(lang, { loggedIn: true })
    const nav = html.slice(0, html.indexOf('</nav>'))
    const t = translations[lang]
    const centre = nav.slice(nav.indexOf('class="hidden lg:flex'), nav.indexOf('class="flex items-center gap-3 flex-shrink-0"'))
    const hrefs = [...centre.matchAll(/href="([^"]*)"/g)].map((m) => m[1])
    expect(hrefs).toEqual(['/categories', '/olim', '/support'])
    expect(centre).toContain(`>${t.nav_cta}<`)
    // The logo is Home and the avatar menu is the account: no text links for either.
    expect(centre).not.toContain(`>${t.nav_home}<`)
    expect(centre).not.toContain(`>${t.nav_account}<`)
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

  it.each(['en', 'he'] as const)('signed in: the drawer opens with the member card, then Explore Perks, Wishlist, Making Aliyah?, Support and Privacy & Security (%s)', (lang) => {
    const html = render(lang, { loggedIn: true })
    const drawer = html.slice(html.indexOf('</nav>'))
    const t = translations[lang]
    const links = drawer.slice(0, drawer.indexOf('mt-auto'))
    expect([...links.matchAll(/href="([^"]*)"/g)].map((m) => m[1])).toEqual(['/account', '/categories', '/wishlist', '/olim', '/support', '/member'])
    // Privacy & Security is a button (it opens the dialog), after Support and before the pass banner.
    const security = links.indexOf(`>${t.nav_security.replace('&', '&amp;')}<`)
    expect(security).toBeGreaterThan(links.indexOf('href="/support"'))
    expect(security).toBeLessThan(links.indexOf('href="/member"'))
    expect(links).toContain('fa-shield-halved')
    expect(drawer).not.toContain(`>${t.nav_home}<`)
    expect(drawer).not.toContain(`>${t.nav_perks}<`)
  })

  it('signed in: the member card is an interactive /account link with a Profile cue', () => {
    const html = render('en', { loggedIn: true })
    const drawer = html.slice(html.indexOf('</nav>'))
    const card = drawer.match(/<a [^>]*href="\/account"[^>]*>(.*?)<\/a>/)!
    expect(card[0]).toContain('rounded-[14px]')
    expect(card[0]).toContain('active:bg-slate-50')
    expect(card[1]).toContain('ds-avatar-fallback')
    expect(card[1]).toContain(`<span class="sr-only">${translations.en.nav_account}: </span>`)
    expect(card[1]).toContain(`>${translations.en.dash_tab_profile}<i class="fa-solid fa-chevron-right`)
  })

  it('signed in: the My Digital Pass banner opens /member, then Sign Out and the legal links sit at the bottom', () => {
    const html = render('en', { loggedIn: true })
    const drawer = html.slice(html.indexOf('</nav>'))
    const t = translations.en
    const banner = drawer.match(/<a [^>]*href="\/member"[^>]*>(.*?)<\/a>/)!
    expect(banner[0]).toContain('bg-gradient-to-br from-brand to-brandDark')
    expect(banner[1]).toContain('fa-qrcode')
    expect(banner[1]).toContain(t.nav_pass_title)
    expect(banner[1]).toContain(t.nav_pass_sub.replace('&', '&amp;'))
    const footer = drawer.slice(drawer.indexOf('mt-auto'))
    expect(footer).toMatch(/<button type="button" class="ds-btn ds-btn-secondary w-full">Sign Out<\/button>/)
    expect(footer.indexOf('href="/terms"')).toBeGreaterThan(footer.indexOf('>Sign Out<'))
    expect(footer.indexOf('href="/privacy"')).toBeGreaterThan(footer.indexOf('href="/terms"'))
  })

  it('signed in: the wishlist heart is desktop-only (hidden below lg)', () => {
    const html = render('en', { loggedIn: true })
    const nav = html.slice(0, html.indexOf('</nav>'))
    expect(nav).toMatch(/class="tap-target relative hidden lg:flex[^"]*" href="\/wishlist"/)
  })

  it('signed in: the Privacy & Security dialog is mounted, closed, for the menus to open', () => {
    // The menu itself renders only when open; its trigger and the dialog shell are always there.
    const html = render('en', { loggedIn: true })
    expect(html).toContain('<dialog dir="ltr" aria-labelledby="security-dialog-title"')
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
    expect(nav).toMatch(/<div class="hidden sm:flex items-center gap-4"><a class="[^"]*" href="\/signup">/)
    const signUp = nav.match(/<a class="([^"]*)" href="\/signup">([^<]*)<\/a>/)!
    const signIn = nav.match(/<a class="([^"]*)" href="\/login">([^<]*)<\/a>/)!
    expect(signUp[2]).toBe('Sign Up')
    expect(signIn[2]).toBe('Sign In')
    const upClasses = signUp[1].split(' ')
    const inClasses = signIn[1].split(' ')
    for (const c of ['bg-brand', 'text-white', 'font-bold', 'hover:bg-brandDark', 'border-transparent']) expect(upClasses).toContain(c)
    for (const c of ['bg-[#FFFFFF]', 'text-[#0B1B3D]', 'border-[#E2E8F0]', 'hover:border-slate-300', 'hover:text-brand']) expect(inClasses).toContain(c)
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

describe('mobile drawer: signed-out text-only layout', () => {
  const drawer = (lang: Lang, loggedIn = false) => {
    const html = render(lang, { loggedIn })
    return html.slice(html.indexOf('</nav>'))
  }

  it.each(['en', 'he'] as const)('renders no icons when signed out (%s)', (lang) => {
    const d = drawer(lang)
    expect(d).not.toContain('<i ')
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

  it.each(['en', 'he'] as const)('shows Sign In, Sign Up, the legal links and the contact line in order, with no promo card (%s)', (lang) => {
    const d = drawer(lang)
    const t = translations[lang]
    expect(d).not.toContain('bg-[#F0F7FF]')
    expect(d).not.toContain('Live Israel Like a Local')
    expect(d).toMatch(/class="[^"]*min-h-\[48px\] bg-brand text-white[^"]*rounded-xl[^"]*" href="\/login">/)
    expect(d.indexOf('href="/login"')).toBeGreaterThan(d.indexOf('href="/business"'))
    expect(d.indexOf('href="/signup"')).toBeGreaterThan(d.indexOf('href="/login"'))
    expect(d.indexOf('href="/terms"')).toBeGreaterThan(d.indexOf('href="/signup"'))
    expect(d.indexOf('href="/privacy"')).toBeGreaterThan(d.indexOf('href="/terms"'))
    expect(d.indexOf('team.landly@gmail.com')).toBeGreaterThan(d.indexOf('href="/privacy"'))
    expect(d).toContain('<bdi>Landly</bdi>')
    expect(d).not.toContain('Ltd')
    expect(d).toContain(`>${t.nav_terms_link}</a>`)
    expect(d).toContain(`>${t.nav_privacy_link}</a>`)
  })

  it.each(['en', 'ru', 'es', 'fr', 'he'] as const)('styles the legal links as small muted text with a dot between (%s)', (lang) => {
    const d = drawer(lang)
    const legal = d.match(/<p class="mt-4 text-center text-xs text-slate-400">(.*?)<\/p>/)![1]
    const links = [...legal.matchAll(/<a class="([^"]*)" href="(\/terms|\/privacy)">([^<]*)<\/a>/g)]
    expect(links.map((m) => m[2])).toEqual(['/terms', '/privacy'])
    for (const [, cls] of links) for (const c of ['text-slate-400', 'hover:text-slate-600', 'transition-colors']) expect(cls.split(' ')).toContain(c)
    expect(legal).toContain('<span aria-hidden="true"> · </span>')
    // React escapes the apostrophe in "Conditions d'utilisation".
    expect(links.map((m) => m[3].replace(/&#x27;/g, "'"))).toEqual([translations[lang].nav_terms_link, translations[lang].nav_privacy_link])
  })
})

describe('mobile drawer: Home link', () => {
  it.each(['en', 'ru', 'es', 'fr', 'he'] as const)('is the first item, text-only, styled like the others (%s)', (lang) => {
    const html = render(lang)
    const d = html.slice(html.indexOf('</nav>'))
    // Attribute order differs between <a> and <Link>, so read href/class separately.
    const firstTag = d.match(/<a [^>]*>([^<]*)<\/a>/)!
    expect(firstTag[0]).toContain('href="/"')
    expect(firstTag[1]).toBe(translations[lang].nav_home)
    const homeClass = firstTag[0].match(/class="([^"]*)"/)![1]
    const how = d.match(/<a class="([^"]*)" href="\/#how">/)![1]
    expect(homeClass).toContain('min-h-[48px]')
    expect(homeClass.replace(/ text-brand bg-brandLight| text-\[#0B1B3D\]/, '')).toBe(how.replace(/ text-brand bg-brandLight| text-\[#0B1B3D\]/, ''))
  })
})

describe('account capsules, divider and language picker', () => {
  const navOf = (lang: Lang, loggedIn = false) => {
    const html = render(lang, { loggedIn })
    return html.slice(0, html.indexOf('</nav>'))
  }

  it.each([false, true])('puts a hairline divider between the account buttons and the language picker (loggedIn=%s)', (loggedIn) => {
    const nav = navOf('en', loggedIn)
    const divider = nav.indexOf('<div class="hidden sm:block h-4 w-[1px] bg-slate-200 mx-1" aria-hidden="true"></div>')
    expect(divider).toBeGreaterThan(nav.indexOf(loggedIn ? 'aria-haspopup="menu"' : 'href="/login"'))
    expect(divider).toBeLessThan(nav.indexOf('fa-globe'))
  })

  it('styles the language trigger as a plain, non-capsule control', () => {
    const trigger = navOf('en').match(/<button type="button" aria-expanded="false" aria-haspopup="true" class="([^"]*)">/)![1].split(' ')
    for (const c of ['hover:bg-slate-100', 'rounded-lg', 'px-2.5', 'py-1.5']) expect(trigger).toContain(c)
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
  it.each([false, true])('stays in the top bar at every width, just before the hamburger (loggedIn=%s)', (loggedIn) => {
    const html = render('en', { loggedIn })
    const nav = html.slice(0, html.indexOf('</nav>'))
    // No breakpoint class: visible on phones too.
    expect(nav).toContain('<div class="lang-dropdown">')
    const trigger = nav.match(/<button type="button" aria-expanded="false" aria-haspopup="true" class="([^"]*)">/)![1].split(' ')
    for (const c of ['hover:bg-slate-100', 'rounded-lg', 'px-2.5', 'py-1.5']) expect(trigger).toContain(c)
    expect(nav.indexOf('fa-globe')).toBeLessThan(nav.indexOf('aria-label="Menu"'))
    // The trailing controls sit gap-3 apart.
    expect(nav).toContain('<div class="flex items-center gap-3 flex-shrink-0">')
    // The divider only shows alongside the account buttons (sm+).
    expect(nav).toContain('class="hidden sm:block h-4 w-[1px] bg-slate-200 mx-1"')
  })

  it.each(['en', 'he'] as const)('the drawer has no language section (%s)', (lang) => {
    const html = render(lang, { loggedIn: false })
    const drawer = html.slice(html.indexOf('</nav>'))
    expect(drawer).not.toContain('drawer-language-label')
    expect(drawer).not.toMatch(/<button[^>]*lang="[a-z]{2}"/)
    // The links and the account block remain.
    expect(drawer).toContain('href="/support"')
    expect(drawer).toContain('href="/login"')
  })
})
