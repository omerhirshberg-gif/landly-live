import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import TermsPage, { metadata } from '@/app/terms/page'
import TermsContent from '@/components/legal/TermsContent'
import { LangContext, LangProvider } from '@/lib/i18n/LangProvider'
import { LANGUAGES } from '@/lib/i18n/languages'
import { RTL_LANGS, translations, Lang, TranslationKey } from '@/lib/i18n/translations'

// The navbar needs auth, Firebase and the router; the page shell around the
// terms is what's under test here.
vi.mock('@/components/layout/Navbar', () => ({ default: () => createElement('nav', { 'data-testid': 'navbar' }) }))

// /terms replaced the home-page TermsModal; these are the terms it must keep
// carrying, in every language, without the modal's old sign-up CTA.
const toText = (html: string) =>
  html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ')

// The real provider, as the server renders it (no saved language → English).
const html = renderToStaticMarkup(createElement(LangProvider, null, createElement(TermsContent)))
const text = toText(html)

function renderIn(lang: Lang) {
  const t = (key: TranslationKey) => translations[lang][key]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(
    createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, createElement(TermsContent))
  )
}

describe('terms page', () => {
  it('renders the page shell with the navbar and the terms inside it', () => {
    const page = renderToStaticMarkup(createElement(LangProvider, null, createElement(TermsPage)))
    expect(page).toContain('data-testid="navbar"')
    expect(page).toMatch(/<main[^>]*>[\s\S]*<article dir="ltr"[\s\S]*<\/article>[\s\S]*<\/main>/)
    expect(page).toContain('env(safe-area-inset-bottom)')
  })

  it('declares an indexable canonical URL', () => {
    expect(metadata.title).toBe('Terms and Conditions — Landly')
    expect(metadata.alternates?.canonical).toBe('https://www.golandly.com/terms')
    expect(metadata.robots).toEqual({ index: true, follow: true })
  })

  it('has the five legal sections in order', () => {
    const headings = [...html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map((m) => m[1])
    expect(headings).toEqual(['1. Payments', '2. Refund Policy', '3. Vouchers and Deals', '4. Governing Law', '5. Contact'])
  })

  it('identifies the title, date and contact', () => {
    expect(text).toContain('Terms and Conditions')
    expect(text).toContain('Last updated: January 2025')
    expect(text).toContain('team.landly@gmail.com')
  })

  it('states the pay-per-offer payment model', () => {
    expect(text).toContain('pay-per-offer')
    expect(text).toMatch(/no subscription or recurring billing/)
  })

  it('states the refund policy before and after redemption', () => {
    expect(text).toContain('Before redemption: You may request a full refund')
    expect(text).toContain('After redemption: Once a voucher has been redeemed')
    expect(text).toContain('final and non-refundable')
  })

  it('covers vouchers and governing law', () => {
    expect(text).toMatch(/Vouchers are non-transferable/)
    expect(text).toContain('laws of the State of Israel')
    expect(text).toContain('Tel Aviv-Yafo')
  })

  it('has one h1 and a heading for each of its five sections', () => {
    expect(html.match(/<h1[ >]/g)).toHaveLength(1)
    expect(html.match(/<section[ >]/g)).toHaveLength(5)
    expect(html.match(/<h2[ >]/g)).toHaveLength(5)
  })

  it('carries no sign-up CTA or links', () => {
    expect(html).not.toMatch(/<a[ >]|<button[ >]/)
    expect(text).not.toMatch(/Join Now|Sign Up/)
  })

  it.each(LANGUAGES.map((l) => l.code))('renders fully translated in %s', (lang) => {
    const out = renderIn(lang)
    const outText = toText(out)
    expect(out).not.toMatch(/terms_[a-z0-9_]+/)
    expect(out).not.toMatch(/<(h1|h2|p|span|strong)[^>]*>\s*<\/\1>/)
    expect(outText).toContain(translations[lang].terms_title)
    expect(outText).toContain('team.landly@gmail.com')
    if (lang !== 'en') expect(outText).not.toContain(translations.en.terms_p1)
    if (lang === 'he') expect(outText).toMatch(/[֐-׿]/)
  })

  it.each(LANGUAGES.map((l) => l.code))('sets the reading direction for %s', (lang) => {
    const expected = (RTL_LANGS as readonly string[]).includes(lang) ? 'rtl' : 'ltr'
    expect(renderIn(lang)).toMatch(new RegExp(`^<article dir="${expected}"`))
  })
})
