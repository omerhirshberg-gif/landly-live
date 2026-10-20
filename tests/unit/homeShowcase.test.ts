import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'
import { CATEGORY_TILES } from '@/lib/categories'
import { MARQUEE_MIN_BUSINESSES, marqueeRepeats, offerSavings, pickMarqueeItems, pickTopSavings, toShowcase, type ShowcaseOffer } from '@/lib/home/showcase'
import type { PublicOffer } from '@/lib/offers/publicOffer'

const { default: PartnerMarquee } = await import('@/components/home/PartnerMarquee')
const { default: SavingsShowcase } = await import('@/components/home/SavingsShowcase')
const { default: PassShowcase, formatValidThru } = await import('@/components/home/PassShowcase')

function withLang(lang: Lang, element: ReturnType<typeof createElement>) {
  const t = (key: TranslationKey) => translations[lang][key]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, element))
}

const offer = (i: number, over: Partial<ShowcaseOffer> = {}): ShowcaseOffer => ({
  id: `o${i}`, businessName: `Business ${i}`, title: `Perk ${i}`, category: 'Restaurants and Cafes', originalPrice: 100, offerPrice: 80, ...over,
})

describe('showcase data', () => {
  it('trims the live offers to what the home shows', () => {
    const live = Array.from({ length: 60 }, (_, i) => ({ ...offer(i), description: 'x', imageUrl: '', createdAt: null, expiryDate: null }) as PublicOffer)
    const showcase = toShowcase(live)
    expect(showcase.offers).toHaveLength(48)
    expect(Object.keys(showcase.offers[0]).sort()).toEqual(['businessName', 'businessTranslations', 'category', 'id', 'offerPrice', 'originalPrice', 'title', 'translations'])
  })

  it('counts savings in agorot and never below zero', () => {
    expect(offerSavings({ originalPrice: 100, offerPrice: 79.9 })).toBe(20.1)
    expect(offerSavings({ originalPrice: 50, offerPrice: 60 })).toBe(0)
  })

  it('picks the biggest real savings, one per business, three to six of them', () => {
    const offers = [
      offer(1, { originalPrice: 300, offerPrice: 150 }),
      offer(2, { businessName: 'Business 1', originalPrice: 500, offerPrice: 100 }),
      offer(3, { originalPrice: 90, offerPrice: 90 }),
      ...Array.from({ length: 8 }, (_, i) => offer(10 + i, { originalPrice: 100 + i })),
    ]
    const top = pickTopSavings(offers)
    expect(top).toHaveLength(6)
    expect(top[0].id).toBe('o2')
    expect(top.map((o) => o.businessName)).not.toContain('Business 3')
    expect(new Set(top.map((o) => o.businessName)).size).toBe(6)
    expect(pickTopSavings(offers.slice(0, 3))).toEqual([])
  })

  it('streams real businesses with their best discount, linking to the offer', () => {
    const offers = Array.from({ length: MARQUEE_MIN_BUSINESSES }, (_, i) => offer(i))
    offers.push(offer(99, { businessName: 'Business 0', originalPrice: 100, offerPrice: 50 }))
    const items = pickMarqueeItems(offers)
    expect(items).toHaveLength(MARQUEE_MIN_BUSINESSES)
    const best = items.find((item) => item.kind === 'offer' && item.label === 'Business 0')
    expect(best).toMatchObject({ percent: 50, href: '/offers/o99', icon: 'fa-utensils' })
  })

  it('falls back to the real categories when there are too few businesses', () => {
    const items = pickMarqueeItems([offer(1)])
    expect(items.every((item) => item.kind === 'category')).toBe(true)
    expect(items).toHaveLength(CATEGORY_TILES.length)
    expect(items[0].href).toBe('/categories?cat=Restaurants+and+Cafes')
  })

  it('repeats a short row until one half of the loop is wide enough', () => {
    expect(marqueeRepeats(6)).toBe(3)
    expect(marqueeRepeats(20)).toBe(1)
    expect(marqueeRepeats(0)).toBe(0)
  })
})

describe('partner ticker', () => {
  it.each(Object.keys(translations) as Lang[])('is one borderless uppercase stream with Star of David dividers and a hidden second half (%s)', (lang) => {
    const html = withLang(lang, createElement(PartnerMarquee, { offers: Array.from({ length: 8 }, (_, i) => offer(i)) }))
    expect(html.match(/class="marquee-row"/g)).toHaveLength(1)
    expect(html).not.toContain('data-reverse')
    expect(html.match(/<ul class="marquee-half" aria-hidden="true" inert="">/g)).toHaveLength(1)
    expect(html).toContain('<bdi>Business 0</bdi>')
    expect(html).toContain(translations[lang].landing_marquee_label)
    // Every item carries its divider: a vector star, never the ✡ character.
    const items = html.match(/<li class="marquee-item"/g)!.length
    expect(html.match(/<svg aria-hidden="true" viewBox="0 0 24 24" class="mx-4 h-3\.5 w-3\.5 shrink-0 text-brand\/60 sm:mx-6"/g)).toHaveLength(items)
    expect(html).not.toContain('✡')
    // Bold uppercase links, no capsule border.
    expect(html).toMatch(/<a class="inline-flex min-h-\[44px\][^"]*font-display text-sm font-bold uppercase tracking-wider[^"]*rtl:tracking-normal/)
    expect(html).not.toMatch(/<a class="[^"]*rounded-xl border/)
    // A sky-blue band in brand blue type, with no pause button.
    expect(html).toContain('<div class="border-y border-sky-200/70 bg-[#E0F2FE]"><div class="marquee mx-auto max-w-screen-2xl"')
    expect(html).toMatch(/<a class="[^"]*text-brand[^"]*"/)
    expect(html).not.toContain('<button')
    expect(html).not.toContain('fa-pause')
  })

  it('animates transform only, runs with the reading in Hebrew, keeps flowing under the pointer and respects reduced motion', () => {
    const css = readFileSync('app/globals.css', 'utf8')
    expect(css).toContain('@keyframes marquee{from{transform:translate3d(0,0,0);}to{transform:translate3d(-50%,0,0);}}')
    expect(css).toContain('[dir="rtl"] .marquee-track{animation-name:marquee-rtl;}')
    // Never on hover; only on keyboard focus or off screen.
    expect(css).not.toMatch(/\.marquee[-a-z]*:hover/)
    expect(css).toContain('.marquee[data-paused] .marquee-track,.marquee-row:focus-within .marquee-track{animation-play-state:paused;}')
    expect(css).toMatch(/prefers-reduced-motion:reduce\)\{\s*\.marquee\{[^}]*\}\s*\.marquee-track\{animation:none;/)
  })
})

describe('savings showcase', () => {
  const offers = [offer(1, { originalPrice: 300, offerPrice: 150 }), offer(2), offer(3)]

  it('shows each saving in <bdi>, in the reader\'s currency format', () => {
    const en = withLang('en', createElement(SavingsShowcase, { offers }))
    expect(en).toContain('Save <bdi>₪150</bdi>')
    expect(en).toContain('href="/offers/o1"')
    expect(en).toContain('href="/categories?sort=savings"')
    expect(en).toContain('<bdi class="font-extrabold text-[#047857]">₪190</bdi>')
    const he = withLang('he', createElement(SavingsShowcase, { offers }))
    // Hebrew writes the amount first, with its own direction marks, inside the <bdi>.
    expect(he).toMatch(/חוסכים <bdi>[^<]*150[^<]*₪<\/bdi>/)
  })
})

describe('pass showcase', () => {
  it.each(Object.keys(translations) as Lang[])('lays the royal-blue card out like a membership card, with no floating badges (%s)', (lang) => {
    expect(translations.en.landing_pass_demo_name).toBe('Israel Israeli')
    expect(translations.he.landing_pass_demo_name).toBe('ישראל ישראלי')
    const t = translations[lang]
    const html = withLang(lang, createElement(PassShowcase))
    expect(html).toMatch(/class="pass-card rounded-2xl sm:rounded-3xl border border-white\/20 bg-gradient-to-br from-brand to-brandDark/)
    // Header: the white mark and wordmark (kept left to right), the member number opposite.
    expect(html).toMatch(/<span class="flex items-center gap-1\.5" dir="ltr"><svg viewBox="0 0 526 512"/)
    expect(html).toContain('<bdi dir="ltr" class="block font-mono text-xs font-bold text-white/90">#LND-84920</bdi>')
    // The member number appears once, in the header.
    expect(html.match(/LND-84920/g)).toHaveLength(1)
    // The member's name, the QR, then a footer: valid until and status.
    expect(html).toContain(`dir="auto">${t.landing_pass_demo_name}</div>`)
    const footer = html.slice(html.indexOf('<div class="mt-4 grid grid-cols-2 gap-3 border-t border-white/15 pt-3">'))
    expect(html.indexOf('pass-qr')).toBeLessThan(html.indexOf('border-t border-white/15'))
    for (const key of ['landing_pass_card_valid', 'landing_pass_status', 'landing_pass_status_active'] as const) expect(footer).toContain(t[key].replace(/'/g, '&#x27;'))
    expect(html).toContain(t.landing_pass_redeem.replace(/'/g, '&#x27;'))
    expect(html).not.toContain('float-badge')
    expect(html).not.toMatch(/wallet|apple pay|side button/i)
  })

  it('prints validity as MM/YYYY in every language', () => {
    expect(formatValidThru(new Date(2028, 0, 15))).toBe('01/2028')
    expect(formatValidThru(new Date(2027, 10, 3))).toBe('11/2027')
  })
})

describe('pass entrance', () => {
  const css = readFileSync('app/globals.css', 'utf8')

  it('slides the card up from below the screen like a Wallet pass, seats it, wipes and shines the QR, then raises the pill', () => {
    expect(css).toContain('.pass-anim[data-pass="armed"] .pass-card{transform:translate3d(0,120%,0) scale(.92);')
    expect(css).toContain('.pass-anim[data-pass="play"] .pass-card{animation:pass-slide-up .9s cubic-bezier(.16,1,.3,1) both;}')
    expect(css).toMatch(/@keyframes pass-slide-up\{[^@]*to\{transform:none;box-shadow:0 25px 50px -12px rgba\(0,56,184,\.5\);\}/)
    expect(css).toContain('.pass-anim[data-pass="play"] .pass-qr{animation:pass-wipe .5s cubic-bezier(.65,0,.35,1) .5s both;}')
    expect(css).toContain('.pass-anim[data-pass="play"] .pass-shine{animation:pass-shine .6s cubic-bezier(.65,0,.35,1) .95s both;}')
    expect(css).toContain('.pass-anim[data-pass="play"] .pass-pill{animation:pass-rise .4s cubic-bezier(.22,1,.36,1) 1s both;}')
    expect(css).not.toContain('float-badge')
    expect(css).toMatch(/@media \(prefers-reduced-motion:reduce\)\{\s*\.pass-anim\[data-pass\] \.pass-card/)
  })

  it('renders the finished pass on the server (no start pose until JS arms it)', () => {
    const html = withLang('en', createElement(PassShowcase))
    expect(html).toMatch(/<div class="pass-anim relative mx-auto/)
    expect(html).not.toContain('data-pass=')
    for (const part of ['pass-card', 'pass-qr', 'pass-shine', 'pass-pill']) expect(html).toContain(part)
  })
})
