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
    expect(translations.en.hero_free_badge).toBe('Free Membership · Zero Subscription Fees')
    expect(translations.he.hero_free_badge).toBe('חברות 100% בחינם · ללא דמי מנוי וללא צורך באשראי')
    expect(translations.en.hero_cta_note).toBe('Free forever · Pay only for the perks you choose to buy')
    expect(translations.he.hero_cta_note).toBe('חינם לתמיד · משלמים נטו על ההטבה שבוחרים לרכוש')
    expect(translations.en.step1_title).toBe('Join for Free')
    expect(translations.en.step1_desc).toBe('Create your account in 30 seconds with Google or email.')
    expect(translations.he.step1_title).toBe('מצטרפים בחינם')
    expect(translations.he.step1_desc).toBe('פותחים חשבון ב-30 שניות עם גוגל או אימייל.')
    expect(translations.he.landing_pass_free_member).toBe('חבר מועדון (ללא עלות)')
  })

  it.each(LANGS)('has every new line in %s, with no emoji in the badge copy', (lang) => {
    const t = translations[lang]
    for (const key of ['hero_free_badge', 'hero_cta_note', 'step1_title', 'step1_desc', 'landing_pass_free_member'] as const) expect(t[key].trim()).not.toBe('')
    expect(t.hero_free_badge).not.toMatch(/\p{Extended_Pictographic}/u)
  })

  it.each(LANGS)('hero: the free pill over the headline, the reassurance under the buttons (%s)', (lang) => {
    const t = translations[lang]
    const html = withLang(lang, createElement(Hero))
    const pill = html.indexOf(`<span>${esc(t.hero_free_badge)}</span>`)
    expect(pill).toBeGreaterThan(-1)
    expect(html).not.toContain('✨')
    // A frosted-glass pill, led by an emerald beacon that only pulses when motion is welcome.
    const pillTag = html.match(/<p class="([^"]*)"><span aria-hidden="true" class="([^"]*)"><\/span><span>/)!
    for (const c of ['inline-flex', 'items-center', 'gap-2', 'px-4', 'py-1.5', 'rounded-full', 'backdrop-blur-md', 'bg-white/80', 'shadow-[0_2px_8px_rgba(0,56,184,0.06)]', 'font-semibold', 'text-slate-800', 'mb-5', 'rtl:tracking-normal']) expect(pillTag[1].split(' ')).toContain(c)
    for (const c of ['h-2', 'w-2', 'rounded-full', 'bg-emerald-500', 'motion-safe:animate-pulse']) expect(pillTag[2].split(' ')).toContain(c)
    expect(pillTag[2].split(' ')).not.toContain('animate-pulse')
    expect(pill).toBeLessThan(html.indexOf('<h1'))
    const note = html.indexOf(`<p class="mt-2 mb-6 sm:mb-7 text-xs text-slate-500 font-normal">${esc(t.hero_cta_note)}</p>`)
    expect(note).toBeGreaterThan(html.indexOf('href="/login"'))
    expect(note).toBeLessThan(html.indexOf(t.hero_trust1))
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
})
