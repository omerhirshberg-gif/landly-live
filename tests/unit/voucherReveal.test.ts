import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'
// The QR code's URL helper lives beside the Firestore client, which needs config.
vi.mock('@/lib/firebase/vouchers', () => ({ voucherRedeemUrl: (id: string) => `https://landly.test/redeem/${id}` }))
// So is the card thumbnail's offer read; left pending, the thumbnail stays a placeholder.
vi.mock('@/lib/firebase/offers', () => ({ getOffer: () => new Promise(() => {}) }))
import PerksTab from '@/components/member/PerksTab'
import { CodeReveal, QrReveal } from '@/components/member/VoucherReveal'
import type { VoucherDocument } from '@/lib/firebase/vouchers'

const LANGS = Object.keys(translations) as Lang[]
const VOUCHER_KEYS: TranslationKey[] = [
  'voucher_show_button', 'voucher_page_title', 'voucher_show_qr', 'voucher_hide_qr', 'voucher_qr_hidden',
  'voucher_show_code', 'voucher_hide_code', 'voucher_code_hidden', 'voucher_copy_code', 'voucher_code_copied',
  'voucher_copy_failed', 'voucher_not_found', 'voucher_already_redeemed',
]

const voucher = {
  id: 'user_offer', userId: 'user', offerId: 'offer', businessId: 'business',
  businessName: 'Café Noir', offerTitle: '1+1 on coffee', redemptionCode: '48213907',
  status: 'active', takenAt: new Date(Date.UTC(2099, 0, 1)), redeemedAt: null,
  expiresAt: new Date(Date.UTC(2099, 3, 16, 12)), redemptionTerms: 'Dine-in only.',
  redemptionMethod: 'in_store', redemptionInstructions: 'Ask for the barista.',
} as unknown as VoucherDocument & { id: string }

function render(lang: Lang, element: ReactElement) {
  const dict = translations[lang] as Record<string, string>
  const t = (key: TranslationKey) => dict[key] ?? key
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, element))
}

describe('My Pass card', () => {
  it('shows business, offer, method and validity, and links to the voucher page', () => {
    const html = render('en', createElement(PerksTab, { vouchers: [voucher] }))
    expect(html).toContain('Café Noir')
    expect(html).toContain('In store')
    expect(html).toContain('Valid until April 16, 2099')
    expect(html).toContain('href="/member/vouchers/user_offer"')
    expect(html).toContain('View Voucher')
  })

  it('never carries the code, a QR, the steps or a dialog', () => {
    const html = render('en', createElement(PerksTab, { vouchers: [voucher] }))
    expect(html).not.toContain('48213907')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<dialog')
    expect(html).not.toContain('Ask for the barista.')
  })
})

describe('voucher page reveals', () => {
  it('hides the QR code behind "Show QR Code"', () => {
    const html = render('en', createElement(QrReveal, { voucherId: 'user_offer' }))
    expect(html).not.toContain('<img')
    expect(html).toContain('Show QR Code')
    expect(html).toContain('aria-expanded="false"')
  })

  it('masks the numeric code and offers no copy until it is shown', () => {
    const html = render('en', createElement(CodeReveal, { code: '48213907' }))
    expect(html).not.toContain('48213907')
    expect(html).toContain('••••••••')
    expect(html).toContain('aria-label="Code hidden"')
    expect(html).toContain('aria-pressed="false"')
    expect(html).not.toContain('Copy code')
  })

  it('reads in Hebrew', () => {
    expect(render('he', createElement(QrReveal, { voucherId: 'v' }))).toContain('הצג קוד QR לסריקה')
    expect(render('he', createElement(CodeReveal, { code: '1' }))).toContain('הצג קוד')
  })

  it('is a page with the back button, the hero and both reveals, not a popup', () => {
    const page = readFileSync(join(process.cwd(), 'app/member/vouchers/[voucherId]/page.tsx'), 'utf8')
    expect(page).toContain('<BackButton fallback="/member"')
    expect(page).toContain('<PerkImage')
    expect(page).toContain('<QrReveal')
    expect(page).toContain('<CodeReveal')
    expect(page).not.toMatch(/<dialog|showModal/)
  })
})

describe('voucher strings', () => {
  it.each(LANGS)('are translated in %s', (lang) => {
    const dict = translations[lang] as Record<string, string>
    for (const key of VOUCHER_KEYS) expect(dict[key], `${lang}.${key}`).toBeTruthy()
    if (lang !== 'en') expect(dict.voucher_show_qr).not.toBe(translations.en.voucher_show_qr)
  })
})
