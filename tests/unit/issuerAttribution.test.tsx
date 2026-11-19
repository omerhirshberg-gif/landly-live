import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import IssuerAttribution from '@/components/member/IssuerAttribution'
import { RAAYONIT_ISSUER, issuerLine } from '@/lib/payments/issuer'
import { translations } from '@/lib/i18n/translations'

describe('IssuerAttribution', () => {
  it('is a prominent card: 64px framed logo, 17px extra-bold headline, 13px note', () => {
    const html = renderToStaticMarkup(createElement(IssuerAttribution, { issuer: RAAYONIT_ISSUER, lang: 'en', note: 'Valid for 5 years' }))
    expect(html).toContain('Issued &amp; honored by Raayonit Ltd.')
    expect(html).toContain('h-16 w-16')
    expect(html).toContain('border-[#CBD5E1]')
    expect(html).toContain('text-[17px] font-extrabold')
    expect(html).toContain('from-brandTint to-white')
    expect(html).toContain('Valid for 5 years')
  })

  it('says it in every language', () => {
    expect(issuerLine(RAAYONIT_ISSUER, 'he')).toBe('מונפק ומכובד ע״י רעיונית בע״מ')
    for (const lang of ['en', 'he', 'ru', 'fr', 'es'] as const) {
      expect(translations[lang].voucher_issued_by).toMatch(/Raayonit|רעיונית/)
      expect(translations[lang].wallet_pass_issued_by).toBeTruthy()
      expect(translations[lang].wallet_pass_issuer_name).toBeTruthy()
      expect(translations[lang].wallet_pass_redemption).toBeTruthy()
    }
  })
})
