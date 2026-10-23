import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'

vi.mock('@/lib/firebase/config', () => ({ auth: {}, db: {} }))

import PrivacyPolicy, { PRIVACY_POLICY_UPDATED } from '@/components/legal/PrivacyPolicy'
import { CUSTOMER_TYPES } from '@/lib/customerTypes'
import { TERMS_SECTIONS } from '@/lib/legal/termsSections'
const { default: TermsContent } = await import('@/components/legal/TermsContent')

// Rendered text with tags stripped and entities decoded, so sentences read as one string.
const text = (html: string) =>
  html.replace(/<[^>]+>/g, '').replace(/&#x27;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ')

describe('privacy policy: member types, lone soldiers and mentor requests', () => {
  const policy = text(renderToStaticMarkup(createElement(PrivacyPolicy)))

  it('is dated October 2026', () => {
    expect(PRIVACY_POLICY_UPDATED.label).toMatch(/^October \d{1,2}, 2026$/)
    expect(PRIVACY_POLICY_UPDATED.iso).toMatch(/^2026-10-/)
  })

  it('lists every member type a member can choose, Lone Soldier included', () => {
    for (const option of CUSTOMER_TYPES) expect(policy).toContain(translations.en[option.labelKey].split(' ')[0])
    expect(policy).toContain('Student, New Immigrant (Oleh Chadash), Lone Soldier, Taglit')
  })

  it('says no military records or classified information are requested', () => {
    expect(policy).toContain('we do not request or collect military service records, ID documents or any official or classified military information')
  })

  it('says mentor request details go only to the matched mentor, for matching and guidance', () => {
    expect(policy).toContain('Aliyah mentor requests')
    expect(policy).toContain('your preferred mentor language, your planned Aliyah date')
    expect(policy).toContain('We share these details exclusively with the verified community mentor matched to you, solely for matching and guiding you')
    expect(policy).toContain('Mentor requests are kept as long as needed')
  })

  it('names the provider that actually delivers the forms (Resend), not a retired one', () => {
    expect(policy).toContain('support, business and mentor request forms to our team')
    expect(policy).not.toContain('Formspree')
  })
})

describe('terms: guests browse, members buy and redeem', () => {
  function render(lang: Lang) {
    const t = (key: TranslationKey) => translations[lang][key]
    const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
    return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, createElement(TermsContent)))
  }

  it.each(Object.keys(translations) as Lang[])('section 3 adds the members-only rule (%s)', (lang) => {
    const t = translations[lang]
    const terms = text(render(lang))
    expect(terms).toContain(t.terms_p3b_label)
    expect(terms).toContain(t.terms_p3b)
    expect(terms.indexOf(t.terms_p3b)).toBeGreaterThan(terms.indexOf(t.terms_p3))
  })

  it('says it plainly in English, and the app shows the same section', () => {
    expect(translations.en.terms_p3b).toContain('Anyone can browse')
    expect(translations.en.terms_p3b).toContain('available only to registered members who are signed in')
    expect(TERMS_SECTIONS.find((s) => s.heading === 'terms_h3')?.body).toEqual(['terms_p3', ['terms_p3b_label', 'terms_p3b'], ['terms_p3c_label', 'terms_p3c'], ['terms_p3d_label', 'terms_p3d']])
  })

  it('reads right to left in Hebrew', () => {
    expect(render('he')).toMatch(/^<article dir="rtl"/)
  })
})

describe('privacy policy: phone number', () => {
  const html = renderToStaticMarkup(createElement(PrivacyPolicy))
  const policy = text(html)

  it('gives the support line, as a call link, in Who we are and in Contact us', () => {
    expect(policy).toContain('contact us at contact@golandly.com or by phone or WhatsApp at +972 55-720-6711.')
    expect(policy).toContain('Phone / WhatsApp: +972 55-720-6711')
    expect(html.match(/<bdi dir="ltr"><a href="tel:\+972557206711"[^>]*>\+972 55-720-6711<\/a><\/bdi>/g)).toHaveLength(2)
  })
})
