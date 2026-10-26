import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'
import { CATEGORY_TILES } from '@/lib/categories'
import { CATEGORY_ICONS } from '@/components/ui/CategoryIcon'
import { pickHeroFeatures, type HeroFeature, type ShowcaseOffer } from '@/lib/home/showcase'
import { formatSavings } from '@/lib/format'

const { default: Hero } = await import('@/components/home/Hero')
const { default: HeroFeatureGrid } = await import('@/components/home/HeroFeatureGrid')

function withLang(lang: Lang, element: ReturnType<typeof createElement>) {
  const t = (key: TranslationKey) => translations[lang][key]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, element))
}

const offer = (id: string, businessName: string, category: string, originalPrice: number, offerPrice: number): ShowcaseOffer => ({
  id, businessName, title: `${businessName} deal`, category, originalPrice, offerPrice,
})

// Savings: gym ₪200 (40%), spa ₪150 (75%), cafe ₪120 (30%), gym2 ₪100, cafe2 ₪90.
const OFFERS = [
  offer('cafe', 'Cafe Nadi', 'Restaurants and Cafes', 400, 280),
  offer('gym', 'Iron Gym', 'Sport and Fitness', 500, 300),
  offer('gym2', 'Flex Studio', 'Sport and Fitness', 300, 200),
  offer('spa', 'Dead Sea Spa', 'Beauty and Skincare', 200, 50),
  offer('cafe2', 'Cafe Nadi', 'Restaurants and Cafes', 190, 100),
]

// Text as React writes it into markup.
const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/'/g, '&#x27;')

const ids = (features: HeroFeature[]) => features.map((f) => (f.kind === 'offer' ? f.offer.id : f.category))

describe('pickHeroFeatures', () => {
  it('picks the three biggest savings across different categories and businesses, the deepest discount third', () => {
    const features = pickHeroFeatures(OFFERS)
    // gym (₪200) and spa (₪150) lead; Flex Studio (₪100) loses to a third category; the spa's 75% takes the sticker.
    expect(ids(features)).toEqual(['gym', 'cafe', 'spa'])
    expect(features.every((f) => f.kind === 'offer')).toBe(true)
    const [, , sticker] = features as (HeroFeature & { kind: 'offer' })[]
    expect(sticker.percent).toBe(75)
    expect(sticker.savings).toBe(150)
    expect(sticker.href).toBe('/offers/spa')
  })

  it('repeats a category only when the catalogue has fewer than three', () => {
    const features = pickHeroFeatures([OFFERS[1], OFFERS[2], OFFERS[0], offer('gym3', 'Box Club', 'Sport and Fitness', 90, 80)])
    expect(ids(features).sort()).toEqual(['cafe', 'gym', 'gym2'])
  })

  it('falls back to three category cards, with no figures, when there are fewer than three real savings', () => {
    for (const offers of [[], OFFERS.slice(0, 2), [offer('free', 'Zero', 'Kids and Baby', 100, 100), ...OFFERS.slice(0, 2)]]) {
      const features = pickHeroFeatures(offers)
      expect(ids(features)).toEqual(['Sport and Fitness', 'Restaurants and Cafes', 'Cars and Transport'])
      for (const f of features) {
        expect(f.kind).toBe('category')
        if (f.kind === 'category') expect(f.href).toBe(`/categories?${new URLSearchParams({ cat: f.category })}`)
      }
    }
  })
})

describe('hero feature grid', () => {
  it('gives every catalogue category its own vector glyph', () => {
    for (const tile of CATEGORY_TILES) expect(CATEGORY_ICONS[tile.category], tile.category).toBeDefined()
  })

  it('opens each offer, saves in the reader’s currency format, and ends in Explore Perks', () => {
    const features = pickHeroFeatures(OFFERS)
    const html = withLang('en', createElement(HeroFeatureGrid, { features }))
    expect(html).toMatch(new RegExp(`^<ul aria-label="${translations.en.landing_savings_title}" class="grid grid-cols-2 gap-3`))
    const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1])
    expect(hrefs).toEqual(['/offers/gym', '/offers/cafe', '/offers/spa', '/categories'])
    // Sky, cream, white on a soft brand shadow, then royal blue: no forest, coral or black.
    const cards = [...html.matchAll(/<a class="([^"]*)" href=/g)].map((m) => m[1])
    expect(cards[0]).toContain('border border-sky-200/80 bg-gradient-to-br from-sky-50 to-sky-100/70')
    expect(cards[1]).toContain('border border-creamLine bg-gradient-to-br from-cream to-creamDeep')
    expect(cards[2]).toContain('border border-slate-200/80 bg-white')
    expect(cards[2]).toContain('shadow-[0_4px_20px_-4px_rgba(0,56,184,0.08)]')
    expect(cards[3]).toContain('bg-gradient-to-br from-brand to-brandDark text-white shadow-[0_8px_24px_rgba(0,56,184,0.24)]')
    for (const gone of ['forest', 'coral', 'sticker', 'bg-ink', 'grain']) expect(html).not.toContain(gone)
    // Card 1: "Save ₪200" on a white pill. Card 2: the amount set large inside the phrase.
    expect(html).toContain(`shadow-sm">Save <bdi>${formatSavings(200, 'en')}</bdi></span>`)
    expect(html).toMatch(new RegExp(`<span class="text-xs[^"]*">Save</span><bdi class="text-page sm:text-3xl[^"]*">${formatSavings(120, 'en')}</bdi>`))
    // Card 3: the deepest discount on a tilted sky badge.
    expect(html).toContain(`-rotate-2 rtl:rotate-2 rounded-lg bg-sky-100 px-2.5 py-1 text-meta font-black uppercase text-brand">${translations.en.offer_percent_off.replace('{n}', '75')}</span>`)
    // Card 4: only Explore Perks and the arrow in a glass circle.
    expect(html).toContain(`>${translations.en.nav_cta}</span></a>`)
    expect(html).not.toContain(translations.en.home_discover_sub)
    expect(html).toMatch(/rounded-full border border-white\/25 bg-white\/15 backdrop-blur-sm"><svg [^>]*class="lucide lucide-arrow-up-right/)
    // Hover lift only with a real pointer, a press settles, still under reduced motion.
    expect(html).toContain('[@media(hover:hover)]:hover:-translate-y-1.5')
    expect(html).toContain('active:scale-[0.98]')
    expect(html).toContain('motion-reduce:transition-none')
  })

  it('lowers the second column and leans each card, mirrored in Hebrew, straightening on hover or focus', () => {
    const html = withLang('en', createElement(HeroFeatureGrid, { features: pickHeroFeatures(OFFERS) }))
    expect(html).toMatch(/^<ul [^>]*class="[^"]* pb-2 sm:pb-3 /)
    const items = [...html.matchAll(/<li class="([^"]*)">/g)].map((m) => m[1])
    expect(items).toEqual(Array(4).fill('flex even:translate-y-2 sm:even:translate-y-3'))
    const cards = [...html.matchAll(/<a class="([^"]*)" href=/g)].map((m) => m[1].split(' '))
    const leans = [
      ['-rotate-[0.75deg]', 'rtl:rotate-[0.75deg]'],
      ['rotate-[1deg]', 'rtl:-rotate-[1deg]'],
      ['rotate-[0.5deg]', 'rtl:-rotate-[0.5deg]'],
      ['-rotate-[0.85deg]', 'rtl:rotate-[0.85deg]'],
    ]
    cards.forEach((card, i) => {
      for (const c of [...leans[i], '[@media(hover:hover)]:hover:rotate-0', 'focus-visible:rotate-0', 'hover:shadow-[0_12px_32px_-8px_rgba(0,56,184,0.18)]']) expect(card).toContain(c)
    })
    expect(html).not.toContain('hover:shadow-xl')
  })

  it('names each offer\u2019s merchant once, as an 11px uppercase eyebrow over a two-line title', () => {
    const html = withLang('en', createElement(HeroFeatureGrid, { features: pickHeroFeatures(OFFERS) }))
    for (const name of ['Iron Gym', 'Cafe Nadi', 'Dead Sea Spa']) {
      expect(html.split(`>${name}</span>`)).toHaveLength(2)
      expect(html).toMatch(new RegExp(`<span class="(?:mt-auto )?truncate text-micro font-bold uppercase tracking-wider rtl:tracking-normal[^"]*" dir="auto">${name}</span>(?:</span>)?<span class="mt-1 line-clamp-2 `))
    }
  })

  it('tilts the discount badge the other way, and mirrors the arrow, in Hebrew', () => {
    const html = withLang('he', createElement(HeroFeatureGrid, { features: pickHeroFeatures(OFFERS) }))
    expect(html).toContain('-rotate-2 rtl:rotate-2')
    expect(html).toMatch(/lucide-arrow-up-right h-5 w-5 rtl:-scale-x-100/)
    // Shekels in the Hebrew format ("200 ₪"), isolated so they stay whole.
    expect(html).toContain(`<bdi>${formatSavings(200, 'he')}</bdi>`)
    expect(html).toContain('-end-3')
  })

  it('shows categories by name with no figures in the fallback', () => {
    const html = withLang('en', createElement(HeroFeatureGrid, { features: pickHeroFeatures([]) }))
    expect(html).not.toContain('<bdi>')
    for (const key of ['row_sport', 'row_restaurants', 'cats_cars'] as const) expect(html).toContain(`>${esc(translations.en[key])}</span>`)
  })

  it('sits between the sub and the buttons, with no trust pills', () => {
    const html = withLang('en', createElement(Hero, { features: pickHeroFeatures(OFFERS) }))
    const sub = html.indexOf(translations.en.hero_sub)
    const grid = html.indexOf('<ul aria-label')
    expect(sub).toBeGreaterThan(html.indexOf('<h1'))
    expect(grid).toBeGreaterThan(sub)
    expect(html.indexOf('href="/signup"')).toBeGreaterThan(grid)
    expect(html).not.toContain('fa-bolt')
    expect(html).toContain('lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]')
  })
})

describe('hero feature grid: the savings phrase in every language', () => {
  it('keeps the words around the large amount on the side each language puts them', () => {
    const features = pickHeroFeatures(OFFERS)
    for (const lang of Object.keys(translations) as Lang[]) {
      const html = withLang(lang, createElement(HeroFeatureGrid, { features }))
      const [before, after] = translations[lang].landing_savings_badge.split('{amount}')
      const big = html.match(/<span class="mt-auto flex flex-wrap items-baseline[^"]*">(.*?)<\/span><\/a>/)![1]
      const words = [...big.matchAll(/<span class="text-xs[^"]*">([^<]*)<\/span>/g)].map((m) => m[1])
      expect(words).toEqual([before.trim(), after.trim()].filter(Boolean).map(esc))
      expect(big.indexOf('<bdi')).toBe(before.trim() ? big.indexOf('</span>') + '</span>'.length : 0)
    }
  })
})
