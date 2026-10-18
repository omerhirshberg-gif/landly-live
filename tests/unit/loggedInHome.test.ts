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

const { default: Home } = await import('@/app/page')
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
    expect(html).toContain('pb-[calc(4rem+env(safe-area-inset-bottom))]')
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

  it('titles the sections and uses design-system buttons', () => {
    const html = withLang('en', createElement(LoggedInHome, { user: member as never }))
    expect(html).toMatch(new RegExp(`<h2 id="home-deals-title" class="text-xl font-bold text-ink[^"]*">${translations.en.home_deals_title}</h2>`))
    expect(html).toMatch(/class="ds-btn ds-btn-primary ds-btn-md [^"]*" href="\/member"><span>Open My Pass<\/span><i class="fa-solid fa-arrow-right text-xs rtl:-scale-x-100"/)
  })

  it('unifies greeting, persona and pass count in one white banner, with no blue Explore card', () => {
    const html = withLang('en', createElement(LoggedInHome, { user: member as never }))
    const banner = html.match(/<section aria-labelledby="home-welcome" class="([^"]*)">(.*?)<\/section>/)!
    for (const c of ['bg-white', 'border-slate-100', 'rounded-2xl', 'shadow-sm', 'p-5', 'sm:p-6', 'lg:p-7', 'flex-col', 'md:flex-row', 'md:items-center', 'md:justify-between']) expect(banner[1].split(' ')).toContain(c)
    const inner = banner[2]
    // Leading: avatar → greeting → persona badge ("Member" until one is chosen) → subtitle; trailing: count pill → My Pass.
    const order = ['href="/profile"', '<h1 id="home-welcome"', 'class="segment-badge"', translations.en.deals_title, 'aria-live="polite"', translations.en.home_pass_label, 'href="/member"'].map((s) => inner.indexOf(s))
    expect(order.every((i) => i > -1)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(inner).toContain(`<span>${translations.en.dash_segment_value_unset}</span>`)
    // The blue card and the count sentence are gone; the rail follows the banner directly.
    expect(html).not.toContain('bg-brand rounded-2xl')
    expect(html).not.toContain(translations.en.home_discover_title)
    expect(html).not.toContain(translations.en.home_vouchers_message.split('{count}')[0])
    expect(html).toMatch(/<\/section><section class="mt-8 lg:mt-10" aria-labelledby="home-deals-title">/)
  })

  it('stacks on phones with the My Pass button free to wrap under the count, never overflowing', () => {
    const html = withLang('he', createElement(LoggedInHome, { user: member as never }))
    expect(html).toContain('class="flex flex-wrap items-center gap-3 md:flex-col md:flex-nowrap md:items-end md:gap-2.5 flex-shrink-0"')
    expect(html).toMatch(/class="ds-btn ds-btn-primary ds-btn-md flex-1 basis-40 md:flex-none md:basis-auto" href="\/member"/)
    // Tap targets: the pill is 44px tall on phones, the avatar link a tap-target.
    expect(html).toContain('h-11 md:h-9')
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
    expect(html).toMatch(/<a class="rail-tile group" href="\/categories\?cat=Restaurants\+and\+Cafes"><span aria-hidden="true" class="rail-tile-icon">🍽️<\/span><span class="rail-tile-label">Restaurants/)
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
