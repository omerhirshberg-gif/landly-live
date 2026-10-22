import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'
import TermsContent from '@/components/legal/TermsContent'
import PrivacyPolicy from '@/components/legal/PrivacyPolicy'
import { TERMS_SECTIONS } from '@/lib/legal/termsSections'
import { PRIVACY_POLICY_SECTIONS, blockTexts } from '@/lib/legal/privacyPolicyContent'

const LANGS = Object.keys(translations) as Lang[]
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')

function terms(lang: Lang) {
  const t = (key: TranslationKey) => translations[lang][key]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, createElement(TermsContent)))
}

describe('free membership in the Terms', () => {
  it('names membership in section 3 and spells out the model in English', () => {
    const t = translations.en
    expect(t.terms_h3).toBe('3. Vouchers, Deals and Membership')
    expect(t.terms_p3c).toContain('completely free')
    expect(t.terms_p3c).toContain('no membership fees, subscription charges or automatic renewals')
    expect(t.terms_p3d).toContain('charged only when you choose to buy an individual voucher')
    expect(t.terms_p3d).toContain('never charges you automatically or on a recurring basis')
  })

  it.each(LANGS)('shows free membership, then pay per perk, after the members-only rule (%s)', (lang) => {
    const t = translations[lang]
    const html = terms(lang)
    const at = (s: string) => html.indexOf(esc(s))
    for (const key of ['terms_p3c_label', 'terms_p3c', 'terms_p3d_label', 'terms_p3d'] as const) expect(at(t[key]), key).toBeGreaterThan(-1)
    expect(at(t.terms_p3c)).toBeGreaterThan(at(t.terms_p3b))
    expect(at(t.terms_p3d)).toBeGreaterThan(at(t.terms_p3c))
    expect(at(t.terms_p3d)).toBeLessThan(at(t.terms_h4))
  })

  it('gives the app the same section 3 as the website', () => {
    expect(TERMS_SECTIONS.find((s) => s.heading === 'terms_h3')?.body.slice(-2)).toEqual([
      ['terms_p3c_label', 'terms_p3c'],
      ['terms_p3d_label', 'terms_p3d'],
    ])
  })
})

describe('no payment data for free membership in the Privacy Policy', () => {
  const payment = (() => {
    const blocks = PRIVACY_POLICY_SECTIONS.flatMap((s) => s.blocks)
    const start = blocks.findIndex((b) => b.kind === 'h3' && b.text === 'Payment information')
    const end = blocks.findIndex((b, i) => i > start && b.kind === 'h3')
    return blocks.slice(start + 1, end).flatMap(blockTexts).join(' ')
  })()

  it('collects no card or billing details at sign-up or for membership', () => {
    expect(payment).toContain('We do not ask for or collect any payment card or billing details when you sign up or while you use your free membership')
    expect(payment).toContain('no membership or subscription charges')
  })

  it('takes card details only at a voucher checkout, on Tranzila, never stored by Landly', () => {
    expect(payment).toContain('You enter card details only when you choose to buy an individual paid offer')
    expect(payment).toContain('Tranzila, a PCI-DSS-compliant payment gateway')
    expect(payment).toContain('Landly never receives or stores your full card number or security code')
  })

  it('shows the same on the website', () => {
    const web = renderToStaticMarkup(createElement(PrivacyPolicy)).replace(/\s+/g, ' ')
    expect(web).toContain('while you use your free membership')
    expect(web).toContain('a PCI-DSS-compliant payment gateway')
  })
})
