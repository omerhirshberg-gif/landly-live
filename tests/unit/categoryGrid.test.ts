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
const counts = new Map([[tiles[0].category, 4], [tiles[1].category, 1]])

describe('category grid', () => {
  it('keeps the grid: 2 columns, 3 from fold (600px), one card per tile', () => {
    const html = withLang('en', createElement(CategoryGrid, { tiles: CATEGORY_TILES, counts }))
    expect(html).toMatch(/^<ul class="grid grid-cols-2 fold:grid-cols-3 gap-3 lg:gap-4 touch-pan-y touch-pinch-zoom">/)
    expect(html.match(/<li class="min-w-0">/g)).toHaveLength(CATEGORY_TILES.length)
    expect(html.match(/href="\/categories\?cat=/g)).toHaveLength(CATEGORY_TILES.length)
  })

  it.each(Object.keys(translations) as Lang[])('shows a brand pill with a live dot for offers and a slate clock pill for coming soon (%s)', (lang) => {
    const t = translations[lang]
    const html = withLang(lang, createElement(CategoryGrid, { tiles, counts }))
    expect(html).toMatch(/bg-brandTint[^"]*text-brand"><span aria-hidden="true" class="[^"]*bg-emerald-500[^"]*"><\/span><span class="min-w-0 break-words">/)
    expect(html).toContain(`>${t.cats_perks_count.replace('{count}', '4')}</span>`)
    expect(html).toContain(`>${t.cats_perks_count_one}</span>`)
    expect(html).toMatch(new RegExp(`bg-slate-50[^"]*"><i class="fa-regular fa-clock[^"]*" aria-hidden="true"></i><span class="min-w-0 break-words">${t.cats_coming_soon}</span>`))
  })

  it('shows a placeholder pill, not a badge, while offers load', () => {
    const html = withLang('en', createElement(CategoryGrid, { tiles, counts: null }))
    expect(html.match(/animate-pulse/g)).toHaveLength(3)
    expect(html).not.toContain('bg-brandTint px-2.5')
    expect(html).not.toContain(translations.en.cats_coming_soon)
  })

  it('puts the vector icon in a 48px brand-tint box and a decorative arrow that mirrors in Hebrew', () => {
    const html = withLang('he', createElement(CategoryGrid, { tiles, counts }))
    expect(html).toMatch(/<span aria-hidden="true" class="flex h-12 w-12[^"]*rounded-xl border border-brand\/10 bg-brandTint[^"]*text-brand[^"]*"><i class="fa-solid fa-utensils"><\/i><\/span>/)
    for (const tile of tiles) expect(html).not.toContain(tile.emoji)
    expect(html.match(/<span aria-hidden="true" class="cat-card-nudge[^"]*"><i class="fa-solid fa-arrow-right rtl:-scale-x-100"><\/i><\/span>/g)).toHaveLength(3)
  })

  it('lifts only with a real pointer, springs on press and staggers the reveal across a row', () => {
    const html = withLang('en', createElement(CategoryGrid, { tiles: CATEGORY_TILES.slice(0, 4), counts }))
    expect(html).toContain('[@media(hover:hover)]:hover:-translate-y-1.5 [@media(hover:hover)]:hover:scale-[1.015]')
    expect(html).toContain('0_20px_35px_-10px_rgba(0,56,184,0.08)')
    expect(html).toContain('active:scale-[0.99]')
    expect(html).not.toMatch(/ hover:-translate-y/)
    const delays = [...html.matchAll(/<div data-reveal="idle" class="reveal h-full"( style="--reveal-delay:(\d+)ms")?>/g)].map((m) => Number(m[2] ?? 0))
    expect(delays).toEqual([0, 60, 120, 0])
  })

  it('nudges the arrow toward the reading direction, on the shared site canvas', () => {
    const css = readFileSync('app/globals.css', 'utf8')
    expect(css).toContain('.group:hover .cat-card-nudge{transform:translate3d(3px,0,0);}')
    expect(css).toContain('[dir="rtl"] .group:hover .cat-card-nudge{transform:translate3d(-3px,0,0);}')
    expect(css).not.toContain('perks-canvas')
    expect(readFileSync('app/categories/page.tsx', 'utf8')).toContain('<div className="below-header member-canvas">')
  })
})
