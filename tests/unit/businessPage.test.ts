import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'
import { BUSINESS_CATEGORIES } from '@/lib/business/inquiryCategories'

vi.mock('@/components/layout/Navbar', () => ({ default: () => null }))
vi.mock('@/lib/firebase/offers', () => ({ getAllOffers: () => new Promise(() => {}) }))

const { default: BusinessPage } = await import('@/app/business/page')

const LANGS = Object.keys(translations) as Lang[]

function render(lang: Lang) {
  const t = (key: TranslationKey) => translations[lang][key]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(
    createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, createElement(BusinessPage))
  )
}

const PAGE_KEYS = [
  'biz_page_title', 'biz_page_intro', 'biz_page_card1_title', 'biz_page_card2_title', 'biz_page_card3_title',
  'biz_form_title', 'biz_form_sub', 'biz_form_business_name', 'biz_form_category', 'biz_form_category_ph',
  'biz_form_contact', 'biz_form_phone', 'biz_form_email', 'biz_form_message', 'biz_form_submit',
] as const satisfies readonly TranslationKey[]

const PLACEHOLDER_KEYS = ['biz_form_business_name_ph', 'biz_form_contact_ph', 'biz_form_message_ph'] as const satisfies readonly TranslationKey[]

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

describe('business page follows the site language', () => {
  it.each(LANGS)('renders every heading, label, placeholder and the submit button in %s', (lang) => {
    const html = render(lang)
    const t = translations[lang]
    for (const key of PAGE_KEYS) expect(html).toContain(escape(t[key]))
    for (const key of PLACEHOLDER_KEYS) expect(html).toContain(`placeholder="${escape(t[key])}"`)
    expect(html).toMatch(new RegExp(`<button type="submit"[^>]*>${t.biz_form_submit}</button>`))
  })

  it.each(LANGS)('translates the category labels but keeps the English values the API accepts (%s)', (lang) => {
    const html = render(lang)
    for (const c of BUSINESS_CATEGORIES) expect(html).toContain(`value="${c}"`)
    expect(html).toContain(`value="Other">${translations[lang].biz_form_cat_other}<`)
    if (lang !== 'en') expect(html).not.toContain('>Restaurants and Cafes<')
  })

  it('no longer forces English or left-to-right on the page', () => {
    const html = render('he')
    expect(html).not.toContain('Grow With Landly')
    expect(html).toMatch(/^<div class="below-header member-canvas">/)
  })

  it('keeps the email and phone fields left-to-right, aligned to the reading side', () => {
    const html = render('he')
    expect(html).toMatch(/id="biz-phone"[^>]*dir="ltr"[^>]*class="inp rtl:text-right"/)
    expect(html).toMatch(/id="biz-email"[^>]*dir="ltr"[^>]*class="inp rtl:text-right"/)
  })

  it('has every business page key in all 5 languages', () => {
    const keys = Object.keys(translations.en).filter((k) => k.startsWith('biz_page_') || k.startsWith('biz_form_'))
    expect(keys.length).toBeGreaterThanOrEqual(26)
    for (const lang of LANGS) for (const k of keys) expect(translations[lang][k as TranslationKey], `${lang}.${k}`).toBeTruthy()
    expect(translations.en.biz_form_submit).toBe('Send Inquiry')
    expect(translations.he.biz_form_submit).toBe('שליחת פנייה')
  })
})
