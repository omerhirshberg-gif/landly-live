import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'
import { CATEGORY_TILES } from '@/lib/categories'

const { default: CategoryGrid } = await import('@/components/perks/CategoryGrid')

function withLang(lang: Lang, element: ReturnType<typeof createElement>) {
  const t = (key: TranslationKey) => translations[lang][key]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, element))
}

const tiles = CATEGORY_TILES.slice(0, 3)

describe('category grid', () => {
  it('keeps the grid: 2 columns, 3 from fold (600px), 4 on desktop, one card per tile', () => {
    const html = withLang('en', createElement(CategoryGrid, { tiles: CATEGORY_TILES }))
    expect(html).toMatch(/^<ul class="grid grid-cols-2 fold:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4 touch-pan-y touch-pinch-zoom">/)
    expect(html.match(/<li class="min-w-0">/g)).toHaveLength(CATEGORY_TILES.length)
    expect(html.match(/href="\/categories\?cat=/g)).toHaveLength(CATEGORY_TILES.length)
  })

  it.each(Object.keys(translations) as Lang[])('shows each category by name only: no perk count, coming-soon or loading pill (%s)', (lang) => {
    const t = translations[lang]
    const html = withLang(lang, createElement(CategoryGrid, { tiles: CATEGORY_TILES }))
    for (const tile of CATEGORY_TILES) expect(html).toContain(`>${t[tile.labelKey].replace(/&/g, '&amp;').replace(/'/g, '&#x27;')}</span></span></a>`)
    const countWords = t.cats_perks_count.split('{count}').map((part) => part.trim()).sort((x, y) => y.length - x.length)[0]
    expect(html).not.toContain(countWords)
    expect(html).not.toContain(t.cats_perks_count_one)
    expect(html).not.toContain(t.cats_coming_soon)
    expect(html).not.toContain('animate-pulse')
    expect(html).not.toContain('bg-emerald-500')
    expect(html).not.toContain('lucide-clock')
    // The page no longer counts per category for the grid.
    expect(readFileSync('app/categories/page.tsx', 'utf8')).not.toContain('countOffersByCategory')
  })

  it('makes every card the same height, with the name held to its foot in a fixed two-line box', () => {
    const html = withLang('en', createElement(CategoryGrid, { tiles: CATEGORY_TILES }))
    const cards = [...html.matchAll(/<a class="group ([^"]*)" href/g)].map((m) => m[1].split(' '))
    expect(cards).toHaveLength(CATEGORY_TILES.length)
    for (const c of cards) for (const k of ['h-[116px]', 'sm:h-[124px]', 'flex', 'flex-col', 'justify-between']) expect(c).toContain(k)
    expect(html.match(/<span class="flex h-\[38px\] sm:h-\[42px\] w-full items-end"><span class="line-clamp-2 [^"]*leading-\[19px\][^"]*sm:leading-\[21px\]/g)).toHaveLength(CATEGORY_TILES.length)
    // The app's cards match: a fixed height, the name on the foot of a two-line box.
    const app = readFileSync('landly-mobile/src/components/CategoryGrid.tsx', 'utf8')
    expect(app).toContain("height: 116,")
    expect(app).toContain("justifyContent: 'space-between'")
    expect(app).toContain("titleBox: { height: 40, justifyContent: 'flex-end' }")
  })

  it('drops the count from the app grid too', () => {
    const grid = readFileSync('landly-mobile/src/components/CategoryGrid.tsx', 'utf8')
    expect(grid).not.toContain('perksCountLabel')
    expect(grid).not.toContain('counts')
    expect(readFileSync('landly-mobile/src/app/(tabs)/perks.tsx', 'utf8')).not.toContain('countOffersByCategory')
  })

  it('puts the vector icon in the shared 40px IconFrame and a decorative arrow that mirrors in Hebrew', () => {
    const html = withLang('he', createElement(CategoryGrid, { tiles }))
    expect(html).toMatch(/<span aria-hidden="true" class="flex flex-shrink-0 items-center justify-center border h-10 w-10 rounded-xl border-sky-200\/60 bg-brandTint text-brand [^"]*group-hover:scale-105[^"]*"><svg [^>]*stroke-width="1.75"[^>]*class="lucide lucide-utensils[^"]* h-\[18px\] w-\[18px\]"/)
    expect(html).not.toContain('fa-solid')
    for (const tile of tiles) expect(html).not.toContain(tile.emoji)
    expect(html.match(/<span aria-hidden="true" class="cat-card-nudge[^"]*"><svg [^>]*class="lucide lucide-arrow-right h-4 w-4 rtl:-scale-x-100"/g)).toHaveLength(3)
  })

  it('lifts only with a real pointer, springs on press and staggers the reveal across a row', () => {
    const html = withLang('en', createElement(CategoryGrid, { tiles: CATEGORY_TILES.slice(0, 5) }))
    expect(html).toContain('[@media(hover:hover)]:hover:-translate-y-1.5 [@media(hover:hover)]:hover:scale-[1.015]')
    expect(html).toContain('0_20px_35px_-10px_rgba(0,56,184,0.08)')
    expect(html).toContain('active:scale-[0.99]')
    expect(html).not.toMatch(/ hover:-translate-y/)
    const delays = [...html.matchAll(/<div data-reveal="idle" class="reveal h-full"( style="--reveal-delay:(\d+)ms")?>/g)].map((m) => Number(m[2] ?? 0))
    expect(delays).toEqual([0, 60, 120, 180, 0])
  })

  it('nudges the arrow toward the reading direction, on the shared site canvas', () => {
    const css = readFileSync('app/globals.css', 'utf8')
    expect(css).toContain('.group:hover .cat-card-nudge{transform:translate3d(3px,0,0);}')
    expect(css).toContain('[dir="rtl"] .group:hover .cat-card-nudge{transform:translate3d(-3px,0,0);}')
    expect(css).not.toContain('perks-canvas')
    expect(readFileSync('app/categories/page.tsx', 'utf8')).toContain('<div className="below-header member-canvas">')
  })
})
