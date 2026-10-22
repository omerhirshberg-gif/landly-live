import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, Lang, TranslationKey } from '@/lib/i18n/translations'

const authState: { user: { uid: string; displayName: string | null; photoURL: string | null } | null } = { user: null }
const profileState = { loaded: true, profile: null as unknown, firstName: 'Dana' as string | null, initials: 'DL', photoURL: null as string | null }

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: () => {}, replace: () => {} }) }))
vi.mock('@/lib/firebase/useAuth', () => ({ useAuth: () => ({ user: authState.user, loading: false }) }))
vi.mock('@/components/auth/useOnboardingGuard', () => ({ useOnboardingGuard: () => false }))
vi.mock('@/lib/firebase/useMemberProfile', () => ({ useMemberProfile: () => profileState }))
vi.mock('@/lib/firebase/vouchers', () => ({ subscribeToUserVouchers: () => () => {} }))
vi.mock('@/lib/firebase/offers', () => ({
  getAllOffers: () => new Promise(() => {}),
  sortFeaturedOffers: (o: unknown[]) => o,
  getOfferDiscountPercent: (original: number, price: number) => (original > 0 ? Math.round((1 - price / original) * 100) : 0),
}))
vi.mock('@/lib/firebase/useWishlist', () => ({ useWishlist: () => ({ wishlistIds: [], isWishlisted: () => false, toggleWishlist: () => {} }) }))
// The page's chrome and guest sections render as markers, so the test reads which sections a page composes.
vi.mock('@/components/layout/Navbar', () => ({ default: () => 'NAVBAR' }))
vi.mock('@/components/layout/Footer', () => ({ default: () => 'FOOTER' }))
vi.mock('@/components/home/Hero', () => ({ default: () => 'GUEST_HERO' }))
vi.mock('@/components/home/ValueProps', () => ({ default: () => 'GUEST_VALUE_PROPS' }))
vi.mock('@/components/home/HowItWorks', () => ({ default: () => 'HOW_IT_WORKS' }))
vi.mock('@/components/home/HomeFaqPrompt', () => ({ default: () => 'FAQ_PROMPT' }))

// The client page; app/page.tsx only wraps it with metadata and structured data.
const { default: Home } = await import('@/components/home/HomePage')
const { default: LoggedInHome } = await import('@/components/home/LoggedInHome')
const { default: OfferCard } = await import('@/components/discover/OfferCard')

function withLang(lang: Lang, element: ReturnType<typeof createElement>) {
  const t = (key: TranslationKey) => translations[lang][key]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, element))
}

const member = { uid: 'u1', displayName: 'Dana Levi', photoURL: null }

describe('home page composition', () => {
  it('guests get the marketing sections', () => {
    authState.user = null
    const html = withLang('en', createElement(Home))
    for (const marker of ['GUEST_HERO', 'GUEST_VALUE_PROPS', 'HOW_IT_WORKS', 'FAQ_PROMPT', 'FOOTER']) expect(html).toContain(marker)
  })

  it('guests get the partner marquee under the hero, then the top savings under What\'s inside, not the perk examples or the members\' curated rail', () => {
    authState.user = null
    const offers = ['Cafe Nadi', 'Surf Club', 'Spa Yam', 'Bike Hub', 'Book Nook', 'Gym Tov'].map((businessName, i) => ({
      id: `o${i}`, businessName, title: `Perk ${i}`, category: 'Restaurants and Cafes', originalPrice: 100 + i * 10, offerPrice: 60,
    }))
    const html = withLang('en', createElement(Home, { showcase: { offers } }))
    expect(html).not.toContain(translations.en.home_curated_title)
    expect(html).not.toContain('id="home-examples-title"')
    const marquee = html.indexOf('class="marquee ')
    expect(marquee).toBeGreaterThan(html.indexOf('GUEST_HERO'))
    expect(marquee).toBeLessThan(html.indexOf('GUEST_VALUE_PROPS'))
    const savings = html.indexOf('id="home-savings-title"')
    expect(savings).toBeGreaterThan(html.indexOf('GUEST_VALUE_PROPS'))
    // How it works, then the member pass it leads to.
    expect(savings).toBeLessThan(html.indexOf('HOW_IT_WORKS'))
    expect(html.indexOf('HOW_IT_WORKS')).toBeLessThan(html.indexOf('id="home-pass-title"'))
  })

  it('guests without enough discounted offers get no savings section, no doubled hairline and the category marquee', () => {
    authState.user = null
    const html = withLang('en', createElement(Home))
    expect(html).not.toContain('id="home-savings-title"')
    expect(html).toContain(translations.en.landing_marquee_categories)
  })

  it('members get only their dashboard: no hero, value props, How it works or Aliyah card', () => {
    authState.user = member
    const html = withLang('en', createElement(Home))
    for (const marker of ['GUEST_HERO', 'GUEST_VALUE_PROPS', 'HOW_IT_WORKS']) expect(html).not.toContain(marker)
    expect(html).not.toContain('href="/olim"')
    expect(html).not.toContain('id="how"')
    expect(html).toContain(translations.en.home_curated_title)
  })

  it('members get no marketing footer: support closes the dashboard, with safe-area bottom padding', () => {
    authState.user = member
    const html = withLang('en', createElement(Home))
    expect(html).not.toContain('FOOTER')
    expect(html).not.toContain('FAQ_PROMPT')
    expect(html).toContain('href="/support"')
    expect(html).toContain('pb-[env(safe-area-inset-bottom)]')
    // Support is pinned to the foot of the screen, not floating under short content.
    expect(html).toContain('<div class="mt-auto pt-10 pb-6"><p class="text-center text-sm text-body">')
    expect(html.indexOf('href="/support"')).toBeGreaterThan(html.indexOf(translations.en.home_curated_title))
  })
})

describe('member dashboard', () => {
  it.each(['en', 'he'] as const)('greets by first name at the design-system size (%s)', (lang) => {
    profileState.firstName = 'Dana'
    const html = withLang(lang, createElement(LoggedInHome, { user: member as never }))
    expect(html).toMatch(new RegExp(`<h1 id="home-welcome" class="text-\\[26px\\] sm:text-\\[28px\\] lg:text-3xl leading-tight font-bold text-ink[^"]*">${translations[lang].home_welcome.replace('{name}', 'Dana')}</h1>`))
  })

  it('shows the monogram fallback when there is no photo, and the photo when there is', () => {
    profileState.photoURL = null
    let html = withLang('en', createElement(LoggedInHome, { user: member as never }))
    expect(html).toContain('ds-avatar-fallback')
    expect(html).toContain('>DL<')
    profileState.photoURL = 'https://cdn.example/avatar.jpg?v=1'
    html = withLang('en', createElement(LoggedInHome, { user: member as never }))
    expect(html).toContain('src="https://cdn.example/avatar.jpg?v=1"')
    profileState.photoURL = null
  })

  it('holds a dash for the active-pass count until the live snapshot arrives', () => {
    const html = withLang('en', createElement(LoggedInHome, { user: member as never }))
    expect(html).toMatch(/aria-live="polite">–</)
  })

  it('uses the 1240px member column and toolbar-aware canvas', () => {
    const html = withLang('en', createElement(LoggedInHome, { user: member as never }))
    expect(html).toContain('member-canvas')
    expect(html).toContain('max-w-member')
  })

  it('titles the sections and makes the whole pass card the way into My Pass', () => {
    const html = withLang('en', createElement(LoggedInHome, { user: member as never }))
    expect(html).toMatch(new RegExp(`<h2 id="home-deals-title" class="text-xl font-bold text-ink[^"]*">${translations.en.home_deals_title}</h2>`))
    expect(html).toMatch(/<a aria-labelledby="home-pass-count home-pass-cta" class="[^"]*" href="\/member">/)
    expect(html).toMatch(/<span>Open My Pass<\/span><i class="fa-solid fa-arrow-right text-xs rtl:-scale-x-100"/)
  })

  it('leads with the greeting, then the blue pass card, the curated perks and the categories', () => {
    const html = withLang('en', createElement(LoggedInHome, { user: member as never }))
    const order = ['<h1 id="home-welcome"', 'class="segment-badge"', 'href="/member"', 'id="home-curated-title"', 'id="home-deals-title"', 'href="/support"'].map((s) => html.indexOf(s))
    expect(order.every((i) => i > -1)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(html).toContain(`<span>${translations.en.dash_segment_value_unset}</span>`)
    const card = html.match(/<a aria-labelledby="home-pass-count home-pass-cta" class="([^"]*)"/)!
    for (const c of ['bg-[#0038B8]', 'rounded-2xl', 'overflow-hidden', 'text-white']) expect(card[1].split(' ')).toContain(c)
    // The Expo card's two background layers, 1:1: the 200px 8% glow disc off the top end corner, then the 88x86 emblem at 15%.
    expect(html).toContain('<span aria-hidden="true" class="pointer-events-none absolute -top-[70px] -end-[50px] z-0 h-[200px] w-[200px] rounded-full bg-white/[0.08]"></span>')
    expect(html).toMatch(/<svg viewBox="0 0 526 512" aria-hidden="true" focusable="false" class="pointer-events-none absolute top-3 end-3\.5 z-0 h-\[86px\] w-\[88px\] text-white\/15"/)
    expect(html).not.toContain('bg-[radial-gradient(')
    expect(html).not.toContain('rounded-full border border-white/20')
    // The count line stays clear of the emblem, as on native (paddingEnd 72).
    expect(html).toContain('id="home-pass-count" class="relative z-10 mt-4 md:mb-5 flex items-center gap-3 sm:gap-4 pe-[72px]"')
    for (const id of ['home-pass-count', 'home-pass-cta']) expect(html).toMatch(new RegExp(`id="${id}" class="relative z-10 `))
    expect(html).toContain(translations.en.home_vouchers_message.replace('{count}', '0'))
    expect(html).not.toContain(translations.en.home_discover_title)
  })

  it('fits phones: dynamic viewport height, no sideways drift, a full-width My Pass button and a tap-target avatar', () => {
    const html = withLang('he', createElement(LoggedInHome, { user: member as never }))
    expect(html).toContain('min-h-[100dvh] overflow-x-clip')
    expect(html).toMatch(/<span id="home-pass-cta" class="[^"]*\bh-12 w-full sm:w-auto\b/)
    expect(html).toMatch(/<a aria-label="[^"]*" class="tap-target flex-shrink-0 rounded-full" href="\/profile">/)
  })

  it('shows the member’s persona in its colour', async () => {
    const { CUSTOMER_TYPES } = await import('@/lib/customerTypes')
    const option = CUSTOMER_TYPES[0]
    const prev = profileState.profile
    profileState.profile = { customerType: option.value, customerTypeOther: '' } as never
    const html = withLang('en', createElement(LoggedInHome, { user: member as never }))
    expect(html).toContain(`<span class="segment-badge" style="background:${option.color}"><span>${translations.en[option.labelKey]}</span></span>`)
    profileState.profile = prev
  })
})

describe('member dashboard: category rail and perk cards', () => {
  it('shows the categories as round icon tiles in an edge-faded rail ending in "View all"', () => {
    const html = withLang('en', createElement(LoggedInHome, { user: member as never }))
    expect(html).toMatch(/<ul class="edge-fade [^"]*overflow-x-auto[^"]*">/)
    expect(html).toMatch(/<a class="rail-tile group" href="\/categories\?cat=Restaurants\+and\+Cafes"><span aria-hidden="true" class="rail-tile-icon"><i class="fa-solid fa-utensils"><\/i><\/span><span class="rail-tile-label">Restaurants/)
    const rail = html.slice(html.indexOf('<ul class="edge-fade'), html.indexOf('</ul>'))
    const viewAll = rail.lastIndexOf('href="/categories"')
    expect(rail.slice(viewAll)).toContain(`<span class="rail-tile-label !text-brand">${translations.en.cats_view_all}</span>`)
    expect(viewAll).toBeGreaterThan(rail.lastIndexOf('href="/categories/Cars%20and%20Transport"'))
  })

  const offer = {
    id: 'o1',
    businessId: 'b1',
    businessName: 'Cafe Nadi',
    location: 'Tel Aviv',
    imageUrl: '',
    title: 'Two coffees',
    description: '',
    originalPrice: 40,
    offerPrice: 34,
    category: 'Restaurants and Cafes',
    createdAt: null,
    isBestseller: false,
    expiryDate: null,
    totalQuantity: null,
    claimedCount: 0,
    validityDays: 180,
    redemptionTerms: '',
    redemptionMethod: 'in_store' as const,
    redemptionInstructions: '',
  }

  it.each(['en', 'he'] as const)('a perk card shows merchant, category badge, "% OFF" banner and the CTA line (%s)', (lang) => {
    const t = translations[lang]
    const html = withLang(lang, createElement(OfferCard, { offer }))
    expect(html).toContain('href="/offers/o1"')
    expect(html).toContain('>Cafe Nadi<')
    expect(html).toContain(`>${t.row_restaurants}<`)
    expect(html).toContain(`>${t.offer_percent_off.replace('{n}', '15')}<`)
    expect(html).toContain(`<span>${t.offer_view_cta}</span>`)
  })

  it('shows how the perk is redeemed, and a branded panel instead of a broken image when there is no photo', () => {
    const html = withLang('he', createElement(OfferCard, { offer: { ...offer, imageUrl: '', redemptionMethod: 'phone_booking' as const } }))
    expect(html).toContain(translations.he.redeem_method_phone_booking)
    expect(html).toContain('🍽️')
    expect(html).not.toContain('fa-image')
    expect(html).not.toContain('<img')
  })

  it('drops the banner and the struck-through price when there is no discount', () => {
    const html = withLang('en', createElement(OfferCard, { offer: { ...offer, offerPrice: 40 } }))
    expect(html).not.toContain('% OFF')
    expect(html).not.toContain('line-through')
  })
})

describe('guest home section dividers', () => {
  const divider = '<div aria-hidden="true" class="section-divider max-w-6xl mx-auto px-4 sm:px-6"><div class="h-px w-full bg-gradient-to-r from-transparent via-brand/25 to-transparent"></div></div>'
  const showcase = {
    offers: ['Cafe Nadi', 'Surf Club', 'Spa Yam'].map((businessName, i) => ({ id: `o${i}`, businessName, title: `Perk ${i}`, category: 'Beach and Sea', originalPrice: 120, offerPrice: 90 })),
  }

  it('puts a soft, symmetrical hairline at each of the five section boundaries', () => {
    authState.user = null
    const html = withLang('en', createElement(Home, { showcase }))
    expect(html.split(divider)).toHaveLength(6)
    const at = (marker: string) => html.indexOf(marker)
    const between = (a: string, b: string) => {
      const d = html.indexOf(divider, at(a))
      return d > at(a) && d < at(b)
    }
    expect(between('class="marquee ', 'GUEST_VALUE_PROPS')).toBe(true)
    expect(between('GUEST_VALUE_PROPS', 'id="home-savings-title"')).toBe(true)
    expect(between('id="home-savings-title"', 'HOW_IT_WORKS')).toBe(true)
    expect(between('HOW_IT_WORKS', 'id="home-pass-title"')).toBe(true)
    expect(between('id="home-pass-title"', 'FOOTER')).toBe(true)
  })

  it('drops the savings section with its hairline, so two never meet', () => {
    authState.user = null
    const html = withLang('en', createElement(Home))
    expect(html.split(divider)).toHaveLength(5)
    expect(html).not.toContain(divider + divider)
  })

  it('never doubles up when a section between two lines renders nothing', async () => {
    const { readFileSync } = await import('node:fs')
    expect(readFileSync('app/globals.css', 'utf8')).toContain('.section-divider + .section-divider{display:none;}')
  })
})
