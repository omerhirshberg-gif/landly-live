import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'

vi.mock('@/lib/firebase/config', () => ({ db: {}, auth: {} }))
vi.mock('@/lib/firebase/useAuth', () => ({ useAuth: () => ({ user: null, loading: false }) }))
vi.mock('@/lib/firebase/useWishlist', () => ({ useWishlist: () => ({ isWishlisted: () => false, toggleWishlist: () => {} }) }))
vi.mock('@/lib/firebase/offers', () => ({
  getAllOffers: () => new Promise(() => {}),
  sortFeaturedOffers: (o: unknown[]) => o,
  getOfferDiscountPercent: (original: number, price: number) => (original > 0 ? Math.round((1 - price / original) * 100) : 0),
}))

const { default: PerkExamples } = await import('@/components/home/PerkExamples')

// Text as React writes it into markup.
const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function withLang(lang: Lang, element: ReturnType<typeof createElement>) {
  const t = (key: TranslationKey) => translations[lang][key]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, element))
}

describe('real perk examples section', () => {
  it('draws the canonical OfferCard', async () => {
    const { readFileSync, existsSync } = await import('node:fs')
    expect(readFileSync('components/home/PerkExamples.tsx', 'utf8')).toContain('<OfferCard offer={offer} layout="grid" />')
    expect(existsSync('components/home/PerkExampleCard.tsx')).toBe(false)
  })

  it.each(Object.keys(translations) as Lang[])('has the title, subtitle and All perks link, and no free-joining note (%s)', (lang) => {
    const t = translations[lang]
    const html = withLang(lang, createElement(PerkExamples))
    expect(html).toContain(`>${esc(t.home_examples_title)}</h2>`)
    expect(html).toContain(esc(t.home_examples_sub))
    expect(html).toMatch(new RegExp(`href="/categories"[^>]*><span>${esc(t.home_examples_all)}</span><svg [^>]*class="lucide lucide-arrow-right[^"]*rtl:-scale-x-100`))
    expect(html).not.toContain('lucide-circle-check')
  })

  it('uses the Hebrew copy from the brief', () => {
    expect(translations.he.home_examples_title).toBe('דוגמאות אמיתיות של הטבות')
    expect(translations.he.home_examples_sub).toBe('מבחר עסקים נבחרים שמחכים לכם במועדון')
    expect(translations.he.home_examples_all).toBe('לכל ההטבות')
  })

  it('swipes on phones and becomes a four-column grid from lg', () => {
    const html = withLang('en', createElement(PerkExamples))
    expect(html).toMatch(/<ul class="[^"]*overflow-x-auto[^"]*snap-x[^"]*lg:grid lg:grid-cols-4/)
    expect(html).toContain('w-[clamp(240px,72vw,260px)] lg:w-auto')
  })
})

describe("what's inside", () => {
  it('swipes as one compact row on phones and is the grid from sm', async () => {
    const { default: ValueProps } = await import('@/components/home/ValueProps')
    const html = withLang('he', createElement(ValueProps))
    expect(html).toMatch(/<ul class="[^"]*flex[^"]*overflow-x-auto[^"]*snap-x snap-mandatory[^"]*sm:grid sm:grid-cols-3[^"]*sm:overflow-visible"/)
    const cards = html.match(/<li class="[^"]*"/g) ?? []
    expect(cards).toHaveLength(3)
    for (const card of cards) expect(card).toContain('w-[200px] flex-shrink-0 snap-center sm:w-auto')
    // Each card is its glyph in the shared 40px frame, its name and one short lifestyle line; no intro under the heading.
    const t = translations.he
    expect(html).not.toContain(t.vp_sub)
    for (const key of ['vp_dining_desc', 'vp_lifestyle_desc', 'vp_experiences_desc'] as const) expect(html).toContain(t[key])
    expect(html.match(/<span aria-hidden="true" class="flex flex-shrink-0 items-center justify-center border h-10 w-10 rounded-xl /g)).toHaveLength(3)
    expect(html.match(/<p[ >]/g)).toHaveLength(3)
    // No background of its own: the page gradient shows through.
    expect(html).toMatch(/<section id="deals" class="py-12 sm:py-14 lg:py-16">/)
  })
})
