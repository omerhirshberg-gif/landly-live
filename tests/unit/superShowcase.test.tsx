import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { translations } from '@/lib/i18n/translations'
import { denominationHref, isolateLtr, showcaseCards, variantForDenomination } from '@/lib/home/superShowcase'
import MultiChainShowcase from '@/components/discover/MultiChainShowcase'

let lang: 'en' | 'he' | 'ru' | 'fr' | 'es' = 'en'
vi.mock('@/lib/i18n/useLang', () => ({ useLang: () => ({ lang, t: (key: string) => (translations[lang] as Record<string, string>)[key] ?? key }) }))

const variants = [
  { faceValueAgorot: 15000, priceAgorot: 12900, poolId: 'p150' },
  { faceValueAgorot: 10000, priceAgorot: 8900, poolId: 'p100' },
]
const offer = { id: 'abc', variants } as never

describe('super voucher showcase data', () => {
  it('has a 100 and a 150 card, cheapest value first, with the exact savings', () => {
    const [a, b] = showcaseCards(offer)
    expect([a!.denomination, a!.price, a!.save, a!.discountPercent, a!.best]).toEqual([100, 89, 11, 11, false])
    expect([b!.denomination, b!.price, b!.save, b!.discountPercent, b!.best]).toEqual([150, 129, 21, 14, true])
  })
  it('links each card to the offer with its value picked', () => {
    expect(showcaseCards(offer).map((c) => c.href)).toEqual(['/offers/abc?denomination=100', '/offers/abc?denomination=150'])
    expect(denominationHref('a b', 150)).toBe('/offers/a%20b?denomination=150')
  })
  it('a single value is never the "best" one', () => {
    expect(showcaseCards({ id: 'x', variants: [variants[1]!] } as never)[0]!.best).toBe(false)
  })
  it('?denomination=150 picks the 150 stock; 100 picks the 100 stock; anything else picks nothing', () => {
    expect(variantForDenomination(variants, '150')?.poolId).toBe('p150')
    expect(variantForDenomination(variants, '100')?.poolId).toBe('p100')
    for (const bad of ['', 'abc', '75', '-1', null, undefined, '150abc']) expect(variantForDenomination(variants, bad)).toBeNull()
  })
  it('isolates a value for right-to-left text', () => expect(isolateLtr('₪89')).toBe('⁦₪89⁩'))
})

describe('web showcase', () => {
  const html = (l: typeof lang) => { lang = l; return renderToStaticMarkup(createElement(MultiChainShowcase, { offer })) }
  it('renders both cards in a two-column centred grid, with the same one-line eyebrow on both', () => {
    const out = html('en')
    expect(out).toContain('max-w-4xl')
    expect(out).toContain('grid-cols-1 items-stretch gap-5 md:grid-cols-2')
    expect(out).toContain('Multi-Chain Super Vouchers')
    expect(out).toContain('One voucher accepted at 230+ chains, restaurants, hotels &amp; attractions across Israel')
    expect(out).toContain('href="/offers/abc?denomination=100"')
    expect(out).toContain('href="/offers/abc?denomination=150"')
    expect(out).not.toContain('Best Value')
    expect(out.match(/uppercase">Multi-Chain Super Tav</g)).toHaveLength(2)
    expect(out).toContain('text-amber-300')
    expect(out).not.toContain('rounded-es-2xl') // no floating corner tag
    expect(out).toContain('₪100 Value'.replace('₪100', '\u2066₪100\u2069'))
    expect(out).toContain('from-[#0B1B3D] via-[#102654] to-[#0B1B3D]')
    expect(out).toContain('<bdi dir="ltr" class="text-3xl font-extrabold tracking-tight tabular-nums text-white">₪129</bdi>')
    expect(out).toContain('<bdi dir="ltr" class="text-sm tabular-nums line-through text-white/50">₪150</bdi>')
    // The discount is a diagonal emerald corner ribbon, mirrored in Hebrew, not an inline badge.
    expect(out).toContain('rotate-45')
    expect(out).toContain('rtl:-rotate-45')
    expect(out).toContain('bg-[#059669]')
    expect(out).toContain('<bdi dir="ltr" class="tabular-nums">-14%</bdi>')
    expect(out).toContain('<bdi dir="ltr" class="tabular-nums">-11%</bdi>')
    expect(out).toContain('Select ⁦₪150⁩ Voucher')
    // Nothing inside a card repeats the header's "accepted at 230+" line or the saving.
    expect(out).not.toContain('Accepted at 230+ chains and businesses')
    expect(out).not.toContain('Save ⁦₪21⁩')
  })
  it('speaks Hebrew with the exact copy', () => {
    const out = html('he')
    expect(out).not.toContain('המשתלם ביותר')
    expect(out).toContain('שווי \u2066₪150\u2069')
    for (const text of ['תווי על רב-רשתיים', 'שובר אחד שפותח מאות רשתות, מסעדות, מלונות ואטרקציות בכל הארץ', 'בחירת תו ⁦₪100⁩']) expect(out).toContain(text)
    expect(out).not.toContain('מכובד ב-230+ רשתות ועסקים')
    expect(out).not.toContain('חיסכון ⁦₪11⁩')
  })
  it('has the copy in all five languages', () => {
    for (const l of ['en', 'he', 'ru', 'fr', 'es'] as const) {
      for (const key of ['super_showcase_title', 'super_showcase_sub', 'super_card_title', 'super_card_value', 'super_card_value_line', 'super_card_save', 'super_card_honored', 'super_card_cta', 'super_card_best']) {
        expect((translations[l] as Record<string, string>)[key], `${l}.${key}`).toBeTruthy()
      }
    }
  })
  it('uses no emoji in the card', () => expect(html('en')).not.toMatch(/\p{Extended_Pictographic}/u))
})

describe('wiring', () => {
  it('/categories and the Perks tab show the showcase above the rails', () => {
    expect(readFileSync('app/categories/page.tsx', 'utf8')).toContain('<MultiChainShowcase offer={superOffers[0]} />')
    // The native lists build the showcase as their first overview row, from the same first super-voucher.
    for (const path of ['landly-mobile/src/app/(tabs)/perks.tsx', 'landly-mobile/src/app/(tabs)/index.tsx']) {
      const src = readFileSync(path, 'utf8')
      expect(src, path).toContain("{ key: 'showcase', type: 'showcase', offer: superOffers[0] }")
      expect(src, path).toContain('<MultiChainShowcase offer={item.offer} />')
    }
  })
  it('the logged-in home shows the showcase above the categories rail, which sits above the curated rail', () => {
    const src = readFileSync('components/home/LoggedInHome.tsx', 'utf8')
    expect(src).toContain('<MultiChainShowcase offer={superOffers[0]} />')
    expect(src.indexOf('<MultiChainShowcase')).toBeLessThan(src.indexOf('<CategoryPhotoRail />'))
    expect(src.indexOf('<CategoryPhotoRail />')).toBeLessThan(src.indexOf('<CuratedOffers'))
  })
  it('the native showcase is a snapping two-card row with dots, 82% wide, flagship first, with section spacing', () => {
    const src = readFileSync('landly-mobile/src/components/MultiChainShowcase.tsx', 'utf8')
    for (const needle of ['decelerationRate="fast"', 'snapToOffsets', 'PagerDots', 'screenWidth * 0.84', '.reverse()', 'marginTop: 28', 'marginBottom: 14', 'padding: 16']) expect(src).toContain(needle)
  })
  it('both offer screens start with the linked value picked', () => {
    for (const p of ['app/offers/[offerId]/page.tsx', 'landly-mobile/src/app/offer/[offerId].tsx']) {
      const src = readFileSync(p, 'utf8')
      expect(src).toContain('variantForDenomination')
      expect(src).toContain('setPickedPool((current) => current || wanted.poolId)')
    }
  })
})
