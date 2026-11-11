import { describe, expect, it, vi } from 'vitest'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'
import { CATEGORY_TILES } from '@/lib/categories'
import { CATEGORY_TINTS, FALLBACK_TINT, categoryTint } from '@/lib/categoryGlyphs'
import { Dumbbell, Tag } from 'lucide-react'
import { categoryIcon, CATEGORY_ICONS } from '@/components/ui/CategoryIcon'
import { badgeLogoUri } from '@/lib/offers/dealImage'
import type { OfferDocument } from '@/lib/firebase/offers'

vi.mock('@/lib/firebase/config', () => ({ db: {}, auth: {} }))
vi.mock('@/lib/firebase/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u1' }, loading: false }) }))
vi.mock('@/lib/firebase/useWishlist', () => ({ useWishlist: () => ({ isWishlisted: () => false, toggleWishlist: () => {} }) }))

const { CURATED_COUNT, RAIL_MAX, buildCategoryRails, passCountMessage, railLabel, selectCurated } = await import('@/lib/home/categoryRails')
const { default: OfferCardRail } = await import('@/components/discover/OfferCardRail')
const { default: CategoryPhotoRail } = await import('@/components/home/CategoryPhotoRail')
const { default: ActivePassCard } = await import('@/components/home/ActivePassCard')
const { default: MemberPageShell } = await import('@/components/layout/MemberPageShell')

function render(lang: Lang, element: ReactElement) {
  const t = (key: TranslationKey) => translations[lang][key]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, element))
}

const t = (key: TranslationKey) => translations.en[key]

function offer(id: string, extra: Partial<OfferDocument> = {}): OfferDocument {
  return {
    id, businessId: 'b', businessName: `Biz ${id}`, location: '', imageUrl: '', title: `Deal ${id}`, description: '',
    originalPrice: 24, offerPrice: 15, category: 'Restaurants and Cafes', createdAt: null, isBestseller: false,
    expiryDate: null, totalQuantity: null, claimedCount: 0, validityDays: 30, redemptionTerms: '',
    redemptionMethod: 'in_store', redemptionInstructions: '', ...extra,
  }
}

describe('buildCategoryRails', () => {
  it('renders nothing for no offers, and a rail only for a category that has one', () => {
    expect(buildCategoryRails([])).toEqual([])
    expect(buildCategoryRails([offer('1', { category: 'Beach and Sea' })]).map((r) => r.category)).toEqual(['Beach and Sea'])
  })

  it('drops a category whose offers are all sold out, and keeps sold-out offers out of a rail', () => {
    const soldOut = { totalQuantity: 5, claimedCount: 5 }
    const rails = buildCategoryRails([offer('1', { category: 'Beach and Sea', ...soldOut }), offer('2', soldOut), offer('3')])
    expect(rails.map((r) => r.category)).toEqual(['Restaurants and Cafes'])
    expect(rails[0].offers.map((o) => o.id)).toEqual(['3'])
    // "See all (X)" counts what it opens, which includes the sold-out perk.
    expect(rails[0].total).toBe(2)
  })

  it('keeps the official category order whatever the counts, with bestsellers first inside a rail', () => {
    const rails = buildCategoryRails([offer('1', { category: 'Cars and Transport' }), offer('2'), offer('3', { isBestseller: true })])
    expect(rails.map((r) => r.category)).toEqual(['Restaurants and Cafes', 'Cars and Transport'])
    expect(rails[0].offers.map((o) => o.id)).toEqual(['3', '2'])
  })

  it('caps a rail, while the count stays whole', () => {
    const [rail] = buildCategoryRails(Array.from({ length: RAIL_MAX + 3 }, (_, i) => offer(String(i))))
    expect(rail.offers).toHaveLength(RAIL_MAX)
    expect(rail.total).toBe(RAIL_MAX + 3)
  })

  it('gives a category outside the official list its own rail last, under its stored name, and skips a blank one', () => {
    const rails = buildCategoryRails([offer('1', { category: 'Pets' }), offer('2'), offer('3', { category: '  ' })])
    expect(rails.map((r) => r.category)).toEqual(['Restaurants and Cafes', 'Pets'])
    expect(rails[1].tile).toBeNull()
    expect(railLabel(rails[1], t)).toBe('Pets')
    expect(categoryIcon('Pets')).toBe(Tag)
  })

  it('does not reorder the list it was given', () => {
    const offers = [offer('1'), offer('2', { isBestseller: true })]
    buildCategoryRails(offers)
    selectCurated(offers)
    expect(offers.map((o) => o.id)).toEqual(['1', '2'])
  })
})

describe('selectCurated', () => {
  it('takes the featured claimable offers, the same count on the web and in the app', () => {
    const offers = [offer('out', { isBestseller: true, totalQuantity: 1, claimedCount: 1 }), ...Array.from({ length: CURATED_COUNT + 2 }, (_, i) => offer(String(i)))]
    const curated = selectCurated(offers)
    expect(curated).toHaveLength(CURATED_COUNT)
    expect(curated.map((o) => o.id)).not.toContain('out')
  })
})

describe('shared category icons', () => {
  it('covers every official category', () => {
    for (const tile of CATEGORY_TILES) expect(CATEGORY_ICONS[tile.category]).toBeTruthy()
    expect(categoryIcon('Sport and Fitness')).toBe(Dumbbell)
  })

  it('tints every official category in its own soft colour', () => {
    for (const tile of CATEGORY_TILES) expect(CATEGORY_TINTS[tile.category]).toMatch(/^#[0-9a-f]{6}$/)
    expect(new Set(Object.values(CATEGORY_TINTS)).size).toBe(CATEGORY_TILES.length)
    expect(categoryTint('Beach and Sea')).toBe('#cffafe')
    expect(categoryTint('Pets')).toBe(FALLBACK_TINT)
  })
})

describe('badge logo', () => {
  it('prefers the business’s logo, falls to one found in the offer’s image, and never shows a logo twice', () => {
    expect(badgeLogoUri('logo.png', 'hero.png', 'logo')).toBe('logo.png')
    expect(badgeLogoUri('', 'hero.png', 'logo')).toBe('hero.png')
    expect(badgeLogoUri('', 'hero.png', 'photo')).toBeNull()
  })
})

describe('pass card', () => {
  it.each(Object.keys(translations) as Lang[])('has its copy in %s', (lang) => {
    expect(translations[lang].home_vouchers_message_one).toBeTruthy()
    expect(translations[lang].home_vouchers_message).toContain('{count}')
    expect(translations[lang].home_rail_see_all).toContain('{count}')
  })

  it('reads in the singular for one voucher, and in the plural for none or several', () => {
    expect(passCountMessage(1, t)).toBe('You have 1 active voucher ready to use.')
    expect(passCountMessage(3, t)).toBe('You have 3 active vouchers ready to use.')
    expect(passCountMessage(0, t)).toBe('You have 0 active vouchers ready to use.')
  })

  it('is one link into My Pass, the same with no passes, and shows the count once known', () => {
    const none = render('he', createElement(ActivePassCard, { count: 0 }))
    expect(none).toMatch(/^<a aria-labelledby="home-pass-count home-pass-cta" class="[^"]*" href="\/member">/)
    expect(none).toContain(translations.he.home_pass_cta)
    expect(none).toMatch(/aria-live="polite">0</)
    expect(none).not.toContain('invisible')
    expect(render('en', createElement(ActivePassCard, { count: 2 }))).toMatch(/aria-live="polite">2</)
  })
})

describe('Recommended for you', () => {
  it.each([
    ['en', 'Recommended for you'],
    ['he', 'מומלץ עבורך'],
    ['ru', 'Рекомендуем для вас'],
    ['fr', 'Recommandé pour vous'],
    ['es', 'Recomendado para ti'],
  ] as const)('titles the rail in %s', (lang, title) => {
    expect(translations[lang].home_curated_title).toBe(title)
  })
})

describe('OfferCardRail', () => {
  it('shows no deal count beside a title, on the web or in the app', () => {
    for (const file of ['components/discover/OfferCardRail.tsx', 'landly-mobile/src/components/SectionHeader.tsx', 'landly-mobile/src/components/CategoryOfferRail.tsx', 'components/home/LoggedInHome.tsx']) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/count\?: number|typeof count|rail\.total/)
    }
  })

  const offers = ['1', '2', '3'].map((id) => offer(id))

  it('starts its heading on the member column and bleeds its row, snapping with a hidden scrollbar', () => {
    const html = render('en', createElement(OfferCardRail, { id: 'r', title: 'Restaurants', offers, href: '/categories?cat=x', seeAll: 'See all (3)' }))
    expect(html).toContain('max-w-member')
    const row = html.match(/<div class="(member-bleed[^"]*)">/)![1].split(' ')
    for (const c of ['overflow-x-auto', 'overscroll-x-contain', 'snap-x', 'snap-mandatory', 'scrollbar-none']) expect(row).toContain(c)
    expect(html).toContain('See all (3)')
    expect([...html.matchAll(/href="\/offers\/(\d)"/g)].map((m) => m[1])).toEqual(['1', '2', '3'])
  })

  it('leaves out "See all" for a category with no page, and mounts arrows only once it measures as overflowing', () => {
    const html = render('en', createElement(OfferCardRail, { id: 'r', title: 'Pets', offers }))
    expect(html).not.toContain('tap-target')
    expect(html).not.toContain('offer-rail-arrow')
  })

  it('isolates a title’s direction and shows the heart to a signed-in member', () => {
    const html = render('he', createElement(OfferCardRail, { id: 'r', title: 'מסעדות', offers }))
    expect(html).toContain('<bdi class="line-clamp-2 min-w-0 text-balance leading-tight max-[420px]:text-[1.125rem]" dir="auto">מסעדות</bdi>')
    expect(html).toContain(`aria-label="${translations.he.btn_add_to_wishlist}"`)
  })
})

describe('CategoryPhotoRail', () => {
  it('shows every category in the fixed order, a bundled 16:10 photo with a gradient at its foot and a white label, opening its filtered view', () => {
    const html = render('en', createElement(CategoryPhotoRail))
    const hrefs = [...html.matchAll(/href="\/categories\?cat=([^"]+)"/g)].map((m) => decodeURIComponent(m[1]).replace(/\+/g, ' '))
    expect(hrefs).toEqual(CATEGORY_TILES.map((tile) => tile.category))
    expect(html.match(/<img /g)).toHaveLength(CATEGORY_TILES.length)
    expect(html).toContain('src="/categories/restaurants.webp"')
    expect(html).toContain('h-full w-full object-cover object-center')
    expect(html).toContain('bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/30 to-transparent')
    expect(html).toContain('h-[110px] w-[176px]')
    expect(html).toContain('sm:h-[150px] sm:w-[240px]')
    expect(html).toContain('snap-x snap-mandatory')
    expect(html).toContain('font-bold leading-snug tracking-tight text-white')
    expect(html).not.toContain('dark:')
  })

  it('holds to the landing column when contained, and reaches the screen edges otherwise', () => {
    expect(render('en', createElement(CategoryPhotoRail, { contained: true }))).toContain('offer-rail relative mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-8')
    expect(render('en', createElement(CategoryPhotoRail, { contained: true }))).not.toContain('member-bleed')
    expect(render('en', createElement(CategoryPhotoRail))).toContain('member-bleed')
  })

  it('bundles one photo per category, the same files on the website and in the app', () => {
    const native = readFileSync('landly-mobile/src/lib/categoryPhotos.ts', 'utf8')
    for (const { photo } of CATEGORY_TILES) {
      const web = readFileSync(`public/categories/${photo}.webp`)
      expect(web.equals(readFileSync(`landly-mobile/assets/categories/${photo}.webp`)), photo).toBe(true)
      expect(native).toContain(`${photo}: require('../../assets/categories/${photo}.webp')`)
    }
    expect(new Set(CATEGORY_TILES.map((tile) => tile.photo)).size).toBe(CATEGORY_TILES.length)
  })
})

describe('the fluid member shell', () => {
  it('lifts the column off the page and keeps the footer on it', () => {
    const html = render('en', createElement(MemberPageShell, { fluid: true, footer: 'FOOTER', children: 'CONTENT' }))
    expect(html.startsWith('<div class="pt-8')).toBe(true)
    expect(html).toContain('<div class="min-w-0 flex-1">CONTENT</div>')
    expect(html).toMatch(/<div class="max-w-member [^"]*mt-auto w-full pt-10 pb-6">FOOTER<\/div>/)
  })
})

describe('mirroring', () => {
  it('uses logical sides only on the new surfaces', () => {
    for (const file of ['components/discover/DealMedia.tsx', 'components/discover/OfferCardRail.tsx', 'components/home/CategoryPhotoRail.tsx', 'components/home/ActivePassCard.tsx', 'landly-mobile/src/components/ActivePassCard.tsx']) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/\b(ml|mr|pl|pr|left|right|text-left|text-right)-\d|\bmargin(Left|Right):|\bpadding(Left|Right):/)
    }
  })

  it('keeps the native rails on snapToOffsets, which is what settles a swipe in Hebrew', () => {
    const carousel = readFileSync('landly-mobile/src/components/OfferCarousel.tsx', 'utf8')
    expect(carousel).toContain('snapToOffsets={snapToOffsets}')
    expect(carousel).not.toContain('snapToInterval')
    expect(readFileSync('landly-mobile/src/components/CategoryOfferRail.tsx', 'utf8')).toContain('<OfferCarousel offers={rail.offers} onOpen={openOffer} showDots={false} showCategoryBadge={false} />')
  })
})
