import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LangContext } from '@/lib/i18n/LangProvider'
import { toLandingData } from '@/lib/home/landingData'
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
vi.mock('@/components/landing/LandingHero', () => ({ default: () => 'GUEST_HERO' }))
vi.mock('@/components/landing/AudienceCards', () => ({ default: () => 'AUDIENCES' }))
vi.mock('@/components/landing/LiveDeals', () => ({ default: () => 'LIVE_DEALS' }))
vi.mock('@/components/landing/BottomCta', () => ({ default: () => 'BOTTOM_CTA' }))
vi.mock('@/components/home/HowItWorks', () => ({ default: () => 'HOW_IT_WORKS' }))
vi.mock('@/components/home/Faq', () => ({ default: () => 'FAQ_SECTION' }))

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
  const landing = toLandingData(['Cafe Nadi', 'Surf Club', 'Spa Yam', 'Bike Hub', 'Book Nook', 'Gym Tov'].map((businessName, i) => ({
    id: `o${i}`, businessName, title: `Perk ${i}`, description: '', category: 'Restaurants and Cafes', imageUrl: '', originalPrice: 100 + i * 10, offerPrice: 60, createdAt: null, expiryDate: null,
  })))

  it('guests get the landing in its order, ending on the questions', () => {
    authState.user = null
    const html = withLang('en', createElement(Home, { landing }))
    const order = ['GUEST_HERO', 'LIVE_DEALS', 'AUDIENCES', 'HOW_IT_WORKS', 'id="home-pass-title"', 'BOTTOM_CTA', 'FAQ_SECTION', 'FOOTER'].map((marker) => html.indexOf(marker))
    expect(order).not.toContain(-1)
    expect(order).toEqual([...order].sort((x, y) => x - y))
    expect(html).not.toContain(translations.en.home_curated_title)
  })

  it('leaves out the partners and deals with nothing live to show', () => {
    authState.user = null
    const html = withLang('en', createElement(Home))
    expect(html).not.toContain('LIVE_DEALS')
    for (const marker of ['GUEST_HERO', 'AUDIENCES', 'HOW_IT_WORKS', 'FAQ_SECTION', 'BOTTOM_CTA']) expect(html).toContain(marker)
  })

  it('members get only their dashboard: no hero, value props, How it works or Aliyah card', () => {
    authState.user = member
    const html = withLang('en', createElement(Home))
    for (const marker of ['GUEST_HERO', 'AUDIENCES', 'HOW_IT_WORKS']) expect(html).not.toContain(marker)
    expect(html).not.toContain('href="/olim"')
    expect(html).not.toContain('id="how"')
    expect(html).toContain(translations.en.home_curated_title)
  })

  it('members get no marketing footer: support closes the dashboard, with safe-area bottom padding', () => {
    authState.user = member
    const html = withLang('en', createElement(Home))
    expect(html).not.toContain('FOOTER')
    expect(html).not.toContain('FAQ_SECTION')
    expect(html).toContain('href="/support"')
    expect(html).toContain('pb-[env(safe-area-inset-bottom)]')
    // Support is pinned to the foot of the screen, not floating under short content.
    expect(html).toMatch(/<div class="max-w-member [^"]*mt-auto w-full pt-10 pb-6"><p class="text-center text-sm text-body">/)
    expect(html.indexOf('href="/support"')).toBeGreaterThan(html.indexOf(translations.en.home_curated_title))
  })
})

describe('member dashboard', () => {
  it.each(['en', 'he'] as const)('greets by first name at the design-system size (%s)', (lang) => {
    profileState.firstName = 'Dana'
    const html = withLang(lang, createElement(LoggedInHome, { user: member as never }))
    expect(html).toMatch(new RegExp(`<h1 id="home-welcome" class="text-page max-\\[379px\\]:text-2xl sm:text-page-lg lg:text-3xl leading-tight font-bold text-ink[^"]*">${translations[lang].home_welcome.replace('{name}', 'Dana')}</h1>`))
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

  it('holds a dash for the active-pass count until the live snapshot arrives, with no fake 0 in words', () => {
    const html = withLang('en', createElement(LoggedInHome, { user: member as never }))
    expect(html).toMatch(/aria-live="polite">–</)
    expect(html).toMatch(/<span class="[^"]*\binvisible\b[^"]*">You have 0 active vouchers/)
  })

  it('uses the 1240px member column and toolbar-aware canvas', () => {
    const html = withLang('en', createElement(LoggedInHome, { user: member as never }))
    expect(html).toContain('member-canvas')
    expect(html).toContain('max-w-member')
  })

  it('leads with the greeting, then the always-present pass card, the recommended perks and support', () => {
    const html = withLang('en', createElement(LoggedInHome, { user: member as never }))
    const order = ['<h1 id="home-welcome"', 'class="segment-badge"', 'href="/member"', 'id="home-curated-title"', 'href="/support"'].map((s) => html.indexOf(s))
    expect(order.every((i) => i > -1)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(html).toContain(`<span>${translations.en.dash_segment_value_unset}</span>`)
    expect(html).toMatch(/<a aria-labelledby="home-pass-count home-pass-cta" class="[^"]*" href="\/member">/)
    const card = html.match(/<a aria-labelledby="home-pass-count home-pass-cta" class="([^"]*)"/)!
    for (const c of ['bg-brand', 'rounded-2xl', 'overflow-hidden', 'text-white', 'md:grid-cols-[minmax(0,1fr)_auto]']) expect(card[1].split(' ')).toContain(c)
    // The Expo card's two background layers, 1:1: the 200px 8% glow disc off the top end corner, then the 88x86 emblem at 15%.
    expect(html).toContain('<span aria-hidden="true" class="pointer-events-none absolute -top-[70px] -end-[50px] z-0 h-[200px] w-[200px] rounded-full bg-white/[0.08]"></span>')
    expect(html).toMatch(/<svg viewBox="0 0 526 512" aria-hidden="true" focusable="false" class="pointer-events-none absolute top-3 end-3\.5 z-0 h-\[86px\] w-\[88px\] text-white\/15/)
    expect(html).toMatch(/<span>Open My Pass<\/span><svg [^>]*class="lucide lucide-arrow-right h-3\.5 w-3\.5 rtl:-scale-x-100"/)
    // A ticket's perforation on phones: two notches around a dashed tear line, gone from 768px.
    expect(html).toMatch(/<span aria-hidden="true" class="relative z-10 -mx-5 my-4 flex items-center sm:-mx-6 md:hidden">.*border-dashed border-white\/35/)
    // The clump beside the rail and the fixed category tiles are gone.
    expect(html).not.toContain('lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]')
    // The curated rail holds its shape on the full-width row while offers load.
    expect(html).toContain('member-bleed flex gap-3 overflow-hidden')
  })

  it('fits phones: dynamic viewport height, no sideways drift, a full-width My Pass button and a tap-target avatar', () => {
    const html = withLang('he', createElement(LoggedInHome, { user: member as never }))
    expect(html).toContain('min-h-[100dvh] overflow-x-clip')
    expect(html).toMatch(/<span id="home-pass-cta" class="[^"]*\bh-12 w-full\b[^"]*md:w-auto/)
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

  it.each(['en', 'he'] as const)('a perk card shows merchant, category badge, "% OFF" banner and one baseline price row, with no CTA line (%s)', (lang) => {
    const t = translations[lang]
    const html = withLang(lang, createElement(OfferCard, { offer }))
    expect(html).toContain('href="/offers/o1"')
    expect(html).toContain('>Cafe Nadi<')
    expect(html).toContain(`>${t.row_restaurants}<`)
    // A -15% pill on the photo, read out in words, and nothing repeating it by the price.
    expect(html).toContain('<bdi aria-hidden="true" dir="ltr">-15%</bdi>')
    expect(html).toContain(`<span class="sr-only">${t.offer_percent_off.replace('{n}', '15')}</span>`)
    expect(html.match(/-15%/g)).toHaveLength(1)
    expect(html.indexOf('-15%')).toBeLessThan(html.indexOf('text-price '))
    // The whole card is the link: no "View deal" text, and the price and its original share one left-to-right row.
    expect(html).not.toContain(`<span>${t.offer_view_cta}</span>`)
    expect(html).toContain('<bdi dir="ltr" class="text-price tabular-nums text-brand">')
  })

  it('shows how the perk is redeemed, and a branded panel instead of a broken image when there is no photo', () => {
    const html = withLang('he', createElement(OfferCard, { offer: { ...offer, imageUrl: '', redemptionMethod: 'phone_booking' as const } }))
    expect(html).toContain(translations.he.redeem_method_phone_booking)
    // The category's Lucide glyph in a white frame, never a broken-image icon; the tag line leads with it too.
    expect(html).toMatch(/<svg [^>]*stroke-width="1.5"[^>]*class="lucide lucide-utensils-crossed lucide-fork-knife-crossed h-9 w-9"/)
    expect(html).toMatch(/class="lucide lucide-utensils-crossed lucide-fork-knife-crossed h-3 w-3 shrink-0"/)
    expect(html).not.toContain('<img')
    // The method is text only.
    expect(html).not.toContain('lucide-phone')
  })

  it('drops the banner and the struck-through price when there is no discount', () => {
    const html = withLang('en', createElement(OfferCard, { offer: { ...offer, offerPrice: 40 } }))
    expect(html).not.toContain('% OFF')
    expect(html).not.toContain('line-through')
  })
})

describe('guest home section dividers', () => {
  const divider = '<div aria-hidden="true" class="section-divider max-w-6xl mx-auto px-4 sm:px-6"><div class="h-px w-full bg-gradient-to-r from-transparent via-brand/25 to-transparent"></div></div>'
  const landing = toLandingData(['Cafe Nadi', 'Surf Club', 'Spa Yam'].map((businessName, i) => ({
    id: `o${i}`, businessName, title: `Perk ${i}`, description: '', category: 'Beach and Sea', imageUrl: '', originalPrice: 120, offerPrice: 90, createdAt: null, expiryDate: null,
  })))

  it('marks only the long sections with a hairline, and never two in a row', () => {
    authState.user = null
    const html = withLang('en', createElement(Home, { landing }))
    expect(html.split(divider)).toHaveLength(4)
    const at = (marker: string) => html.indexOf(marker)
    const between = (a: string, b: string) => {
      const d = html.indexOf(divider, at(a))
      return d > at(a) && d < at(b)
    }
    expect(between('LIVE_DEALS', 'HOW_IT_WORKS')).toBe(true)
    expect(between('HOW_IT_WORKS', 'id="home-pass-title"')).toBe(true)
    expect(between('id="home-pass-title"', 'FAQ_SECTION')).toBe(true)
    expect(between('GUEST_HERO', 'AUDIENCES')).toBe(false)
  })

  it('keeps the same hairlines with no live data', () => {
    authState.user = null
    const html = withLang('en', createElement(Home))
    expect(html.split(divider)).toHaveLength(4)
    expect(html).not.toContain(divider + divider)
  })

  it('never doubles up when a section between two lines renders nothing', async () => {
    const { readFileSync } = await import('node:fs')
    expect(readFileSync('app/globals.css', 'utf8')).toContain('.section-divider + .section-divider{display:none;}')
  })
})
