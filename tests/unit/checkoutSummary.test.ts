import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'
import { consentParts } from '@/lib/legal/consentText'
import CheckoutTrustBadges from '@/components/checkout/CheckoutTrustBadges'

const LANGS = Object.keys(translations) as Lang[]
const NEW_KEYS: TranslationKey[] = ['checkout_you_save', 'checkout_trust_secure', 'checkout_trust_instant', 'checkout_trust_digital', 'nav_back']
const page = readFileSync(join(process.cwd(), 'app/checkout/page.tsx'), 'utf8')

function renderBadges(lang: Lang) {
  const dict = translations[lang] as Record<string, string>
  const t = (key: TranslationKey) => dict[key] ?? key
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, createElement(CheckoutTrustBadges)))
}

describe('checkout terms are clickwrap', () => {
  it('has no separate terms checkbox to tick', () => {
    expect(page).not.toMatch(/Checkbox|agreeMissing|setAgreed|checkout_agree_required/)
  })
  it('accepts the terms with Pay, recorded on the order', () => {
    expect(page).toMatch(/initiate\(await user\.getIdToken\(\), offerId, true\)/)
    expect(page).toContain("t('checkout_agree').replace('{price}'")
  })
  it.each(LANGS)('names the Pay price and links the Terms (%s)', (lang) => {
    const t = translations[lang]
    expect(t.checkout_agree).toContain('{price}')
    expect(consentParts(t.checkout_agree).filter((p) => 'link' in p)).toEqual([{ link: 'terms' }])
    expect(t.checkout_pay_button).toContain('{price}')
    expect(t).not.toHaveProperty('checkout_agree_required')
  })
})

describe('checkout summary', () => {
  it('shows the savings pill only with a discount and marks dynamic text dir="auto"', () => {
    expect(page).toMatch(/\{discount > 0 && \(\s*<span[^>]*emerald/)
    expect(page).toContain('dir="auto">{order.offerTitle}')
    expect(page).toContain('dir="auto">{order.businessName}')
  })
  it('backs out to the offer, or the categories without one', () => {
    expect(page).toContain('<BackButton fallback={backFallback}')
    expect(page).toContain("`/offers/${encodeURIComponent(offerId)}` : '/categories'")
  })
})

describe('trust badges', () => {
  it('renders the three reassurances', () => {
    const html = renderBadges('en')
    expect(html).toContain('SSL-encrypted payment')
    expect(html).toContain('Voucher issued right after payment')
    expect(html).toContain('100% digital pass')
  })
  it('renders in Hebrew', () => {
    expect(renderBadges('he')).toContain('השובר מונפק מיד לאחר התשלום')
  })
  it.each(LANGS)('are translated with the rest of the new strings (%s)', (lang) => {
    const dict = translations[lang] as Record<string, string>
    for (const key of NEW_KEYS) expect(dict[key], `${lang}.${key}`).toBeTruthy()
    expect(dict.checkout_you_save).toContain('{amount}')
  })
})
