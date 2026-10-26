import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'

const { default: Hero } = await import('@/components/home/Hero')
const { default: HowItWorks } = await import('@/components/home/HowItWorks')
const { default: PassShowcase } = await import('@/components/home/PassShowcase')

const LANGS = Object.keys(translations) as Lang[]

function withLang(lang: Lang, element: ReturnType<typeof createElement>) {
  const t = (key: TranslationKey) => translations[lang][key]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, element))
}

// Text as React writes it into markup.
const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/'/g, '&#x27;')

describe('free membership on the guest home', () => {
  it('uses the approved English and Hebrew copy', () => {
    expect(translations.en.hero_free_badge).toBe('100% Free Pass')
    expect(translations.he.hero_free_badge).toBe('חברות חינם 100%')
    expect(translations.en.hero_sub).toBe('Exclusive local perks, all across Israel.')
    expect(translations.he.hero_sub).toBe('הטבות מקומיות בלעדיות, בכל רחבי ישראל.')
    expect(translations.en.step1_title).toBe('Join in 30 Seconds')
    expect(translations.en.step1_desc).toBe('Instant, free membership.')
    expect(translations.he.step1_title).toBe('מצטרפים ב-30 שניות')
    expect(translations.he.step1_desc).toBe('חברות חינמית, מיד.')
    expect(translations.en.step2_title).toBe('Unlock Perks')
    expect(translations.en.step2_desc).toBe('Curated local deals across Israel.')
    // Step 3 still says perks are bought: the pass itself is free, each perk is paid for.
    expect(translations.en.step3_title).toBe('Show & Save')
    expect(translations.en.step3_desc).toBe('Buy a perk, show its QR at the business.')
    expect(translations.he.step3_desc).toBe('רוכשים הטבה ומציגים את קוד ה-QR בעסק.')
    expect(translations.he.landing_pass_free_member).toBe('חבר מועדון (ללא עלות)')
  })

  it.each(LANGS)('has every new line in %s, with no emoji in the badge copy', (lang) => {
    const t = translations[lang]
    for (const key of ['hero_free_badge', 'hero_sub', 'step1_title', 'step1_desc', 'step2_title', 'step2_desc', 'step3_title', 'step3_desc', 'landing_pass_free_member'] as const) expect(t[key].trim()).not.toBe('')
    expect(t.hero_free_badge).not.toMatch(/\p{Extended_Pictographic}/u)
  })

  it.each(LANGS)('hero: the free glass chip over the headline, and nothing under the buttons (%s)', (lang) => {
    const t = translations[lang]
    const html = withLang(lang, createElement(Hero, { features: [] }))
    const pill = html.indexOf(`<span>${esc(t.hero_free_badge)}</span>`)
    expect(pill).toBeGreaterThan(-1)
    expect(html).not.toContain('✨')
    // A frosted-glass chip, led by an emerald beacon whose ring pings only when motion is welcome.
    const chip = html.match(/<p class="([^"]*)"><span aria-hidden="true" class="relative flex h-2 w-2 flex-shrink-0"><span class="([^"]*)"><\/span><span class="relative h-2 w-2 rounded-full bg-emerald-500"><\/span><\/span><span>/)!
    for (const c of ['inline-flex', 'items-center', 'gap-2', 'px-3.5', 'py-1.5', 'rounded-full', 'backdrop-blur-md', 'bg-white/60', 'border-white/70', 'ring-1', 'ring-brand/10', 'shadow-[0_2px_8px_rgba(0,56,184,0.06)]', 'font-bold', 'text-ink', 'mb-5', 'rtl:tracking-normal']) expect(chip[1].split(' ')).toContain(c)
    for (const c of ['absolute', 'inset-0', 'rounded-full', 'bg-emerald-400', 'motion-safe:animate-ping']) expect(chip[2].split(' ')).toContain(c)
    expect(chip[2].split(' ')).not.toContain('animate-ping')
    expect(pill).toBeLessThan(html.indexOf('<h1'))
    // No fine print after the buttons: they close the hero copy.
    expect(html).not.toContain(esc(t.hero_cta_note))
    expect(html.slice(html.indexOf('href="/login"'))).not.toMatch(/<p[ >]/)
    // The trust pills under it are gone: the feature cards carry the proof.
    expect(html).not.toContain(esc(t.hero_trust1))
    expect(html).not.toContain(esc(t.hero_trust2))
  })

  it.each(LANGS)('How it works opens with joining for free (%s)', (lang) => {
    const t = translations[lang]
    const html = withLang(lang, createElement(HowItWorks))
    const first = html.indexOf('<h3')
    expect(html.slice(first)).toMatch(new RegExp(`^<h3[^>]*>${esc(t.step1_title)}</h3><p[^>]*>${esc(t.step1_desc)}</p>`))
  })

  it.each(LANGS)('the pass mockup carries a Free member chip under the name (%s)', (lang) => {
    const t = translations[lang]
    const html = withLang(lang, createElement(PassShowcase))
    const chip = html.indexOf(esc(t.landing_pass_free_member))
    expect(chip).toBeGreaterThan(html.indexOf(`dir="auto">${esc(t.landing_pass_demo_name)}</div>`))
    expect(chip).toBeLessThan(html.indexOf('pass-qr'))
  })

  it('sets the How It Works steps large enough to fill their cards', () => {
    const html = withLang('en', createElement(HowItWorks))
    const t = translations.en
    const cards = [...html.matchAll(/<div class="([^"]*rounded-3xl[^"]*)">/g)].map((m) => m[1].split(' '))
    expect(cards).toHaveLength(3)
    for (const c of cards) for (const k of ['relative', 'overflow-hidden', 'p-7', 'sm:p-9', 'min-h-[230px]', 'sm:min-h-[250px]', 'flex', 'flex-col', 'justify-between', 'border-slate-200/90', 'bg-white', 'shadow-sm', 'text-start']) expect(c).toContain(k)
    // No small number pill: a giant decorative numeral at 10% ink, clearly visible, at the leading top corner (logical start, so it mirrors in Hebrew).
    expect(html).not.toContain('bg-sky-50 px-3.5')
    for (const n of ['01', '02', '03']) expect(html).toContain(`<span aria-hidden="true" class="absolute start-5 sm:start-7 top-4 sm:top-5 select-none pointer-events-none font-black text-slate-900/[0.10] text-[88px] sm:text-[110px] leading-none tracking-tighter tabular-nums">${n}</span>`)
    // Facing it at the trailing top: the glyph in the shared 56px frame, above the numeral.
    expect(html.match(/<div class="relative flex justify-end"><span aria-hidden="true" class="flex flex-shrink-0 items-center justify-center border h-14 w-14 rounded-2xl border-sky-200\/60 bg-brandTint text-brand"><svg [^>]*stroke-width="1.75"[^>]*class="lucide [^"]* h-7 w-7"/g)).toHaveLength(3)
    for (const i of [1, 2, 3] as const) {
      expect(html).toContain(`<div class="relative"><h3 class="mt-6 sm:mt-8 text-2xl sm:text-[26px] font-black leading-tight tracking-tight text-ink">${esc(t[`step${i}_title`])}</h3><p class="mt-3 max-w-sm text-base sm:text-lg font-medium leading-relaxed text-slate-600">${esc(t[`step${i}_desc`])}</p></div>`)
    }
  })
})
