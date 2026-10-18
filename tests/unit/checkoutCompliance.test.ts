import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { excludesAccessibilityWidget } from '@/components/layout/AccessibilityWidget'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'
import VoucherTerms from '@/components/member/VoucherTerms'

const LANGS = Object.keys(translations) as Lang[]

// Every string the checkout, success page and wallets show for the purchase terms.
const CHECKOUT_KEYS: TranslationKey[] = [
  'checkout_total_label', 'checkout_original_price_label', 'checkout_discount_label', 'checkout_vat_note',
  'checkout_voucher_details_title', 'checkout_validity', 'voucher_redemption_terms_label',
  'checkout_cancellation_title', 'checkout_cancellation_body', 'checkout_agree', 'checkout_agree_required',
  'checkout_loading', 'success_order_number_label', 'success_receipt_note', 'voucher_valid_until', 'voucher_expired_on',
]

describe('payment pages run no third-party script', () => {
  it.each(['/checkout', '/checkout/success'])('excludes the accessibility widget from %s', (path) => {
    expect(excludesAccessibilityWidget(path)).toBe(true)
  })

  it('keeps it everywhere else customers browse', () => {
    expect(excludesAccessibilityWidget('/offers/abc')).toBe(false)
    expect(excludesAccessibilityWidget('/checkoutish')).toBe(false)
  })
})

describe('checkout disclosures are translated', () => {
  it.each(LANGS)('has every checkout string in %s', (lang) => {
    for (const key of CHECKOUT_KEYS) expect(translations[lang][key], `${lang}.${key}`).toBeTruthy()
    if (lang !== 'en') expect(translations[lang].checkout_cancellation_body).not.toBe(translations.en.checkout_cancellation_body)
  })

  it.each(LANGS)('keeps the placeholders the pages fill in (%s)', (lang) => {
    const t = translations[lang]
    expect(t.checkout_validity).toContain('{days}')
    expect(t.checkout_cancellation_body).toContain('{fee}')
    expect(t.checkout_cancellation_body).toContain('14')
    expect(t.checkout_cancellation_body).toContain('team.landly@gmail.com')
    expect(t.voucher_valid_until).toContain('{date}')
    expect(t.voucher_expired_on).toContain('{date}')
  })

  it('marks the total as VAT-inclusive in English and Hebrew', () => {
    expect(translations.en.checkout_total_label).toBe('Total (incl. VAT)')
    expect(translations.he.checkout_total_label).toBe('סה״כ לתשלום (כולל מע״מ)')
  })
})

function renderTerms(lang: Lang, voucher: { expiresAt: Date | null; redemptionTerms: string }) {
  const t = (key: TranslationKey) => translations[lang][key]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(
    createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, createElement(VoucherTerms, { voucher }))
  )
}

describe('voucher terms on the pass', () => {
  it('shows the validity date and the redemption terms', () => {
    const html = renderTerms('en', { expiresAt: new Date(Date.UTC(2099, 3, 16, 12)), redemptionTerms: 'Dine-in only.' })
    expect(html).toContain('Valid until April 16, 2099')
    expect(html).toContain('Redemption terms')
    expect(html).toContain('Dine-in only.')
    expect(html).toMatch(/<i class="[^"]*" aria-hidden="true">/)
  })

  it('flags an expired voucher', () => {
    expect(renderTerms('en', { expiresAt: new Date(Date.UTC(2020, 0, 1, 12)), redemptionTerms: '' })).toContain('Expired on January 1, 2020')
  })

  it('renders in Hebrew', () => {
    expect(renderTerms('he', { expiresAt: new Date(Date.UTC(2099, 3, 16, 12)), redemptionTerms: '' })).toContain('בתוקף עד')
  })

  it('renders nothing for a voucher from before validity periods', () => {
    expect(renderTerms('en', { expiresAt: null, redemptionTerms: '' })).toBe('')
  })
})
