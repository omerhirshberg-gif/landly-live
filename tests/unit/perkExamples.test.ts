import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'

vi.mock('@/lib/firebase/offers', () => ({
  getAllOffers: () => new Promise(() => {}),
  sortFeaturedOffers: (o: unknown[]) => o,
  getOfferDiscountPercent: (original: number, price: number) => (original > 0 ? Math.round((1 - price / original) * 100) : 0),
}))

const { default: PerkExamples } = await import('@/components/home/PerkExamples')
const { default: PerkExampleCard } = await import('@/components/home/PerkExampleCard')

// Text as React writes it into markup.
const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function withLang(lang: Lang, element: ReturnType<typeof createElement>) {
  const t = (key: TranslationKey) => translations[lang][key]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, element))
}

const offer = {
  id: 'o1', businessId: 'b1', businessName: 'Cafe Nadi', location: 'Tel Aviv', imageUrl: '',
  title: 'Coffee and pastry for 29', description: '', originalPrice: 45, offerPrice: 29,
  category: 'Restaurants and Cafes', createdAt: null, isBestseller: false, expiryDate: null,
  totalQuantity: null, claimedCount: 0, validityDays: 180, redemptionTerms: '',
  redemptionMethod: 'in_store' as const, redemptionInstructions: '',
}

describe('real perk examples section', () => {
  it.each(Object.keys(translations) as Lang[])('has the title, subtitle and All perks link, and no free-joining note (%s)', (lang) => {
    const t = translations[lang]
    const html = withLang(lang, createElement(PerkExamples))
    expect(html).toContain(`>${esc(t.home_examples_title)}</h2>`)
    expect(html).toContain(esc(t.home_examples_sub))
    expect(html).toMatch(new RegExp(`href="/categories"[^>]*><span>${esc(t.home_examples_all)}</span><i class="fa-solid fa-arrow-right[^"]*rtl:-scale-x-100`))
    expect(html).not.toContain('fa-circle-check')
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

describe('perk example card', () => {
  it.each(['en', 'he'] as const)('opens the offer and shows category pill, business, perk and price pill (%s)', (lang) => {
    const t = translations[lang]
    const html = withLang(lang, createElement(PerkExampleCard, { offer }))
    expect(html).toContain('href="/offers/o1"')
    expect(html).toContain(`<span class="truncate">${t.row_restaurants}</span><i class="fa-solid fa-utensils text-[10px] text-brand" aria-hidden="true"></i>`)
    expect(html).toContain('h-[130px]')
    expect(html).toContain('>Cafe Nadi</div>')
    expect(html).toContain('>Coffee and pastry for 29</p>')
    expect(html).toMatch(/dir="ltr"><span[^>]*>₪29<\/span><span[^>]*line-through[^>]*>₪45<\/span>/)
  })

  it('drops the struck-through price when there is no discount', () => {
    const html = withLang('en', createElement(PerkExampleCard, { offer: { ...offer, originalPrice: 29 } }))
    expect(html).not.toContain('line-through')
  })
})

describe("what's inside", () => {
  it('swipes as one compact row on phones and is the grid from sm', async () => {
    const { default: ValueProps } = await import('@/components/home/ValueProps')
    const html = withLang('he', createElement(ValueProps))
    expect(html).toMatch(/<ul class="[^"]*flex[^"]*overflow-x-auto[^"]*snap-x snap-mandatory[^"]*sm:grid sm:grid-cols-2 lg:grid-cols-4[^"]*sm:overflow-visible"/)
    const cards = html.match(/<li class="[^"]*"/g) ?? []
    expect(cards).toHaveLength(4)
    for (const card of cards) expect(card).toContain('w-[230px] flex-shrink-0 snap-center sm:w-auto')
    // No background of its own: the page gradient shows through.
    expect(html).toMatch(/<section id="deals" class="py-12 sm:py-14 lg:py-16">/)
  })
})
