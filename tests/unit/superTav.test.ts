import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { translations } from '@/lib/i18n/translations'
import { displayTitle, superTavFaceValues, superTavHeadline } from '@/lib/offers/superTav'

const read = (p: string) => readFileSync(p, 'utf8')
const LANGS = ['en', 'he', 'ru', 'es', 'fr'] as const
const strip = (s: string) => s.replace(/[⁦⁩]/g, '').replace(/ /g, ' ')
const pool = { fulfillmentType: 'raayonit_pool' }

describe('Super Tav headline', () => {
  it.each(LANGS)('reads "Super Tav — ₪100 Value" in %s, the value isolated left to right', (lang) => {
    const h = superTavHeadline({ ...pool, variants: [{ faceValueAgorot: 10000 }] }, translations[lang].super_tav_headline)!
    expect(h).toContain('⁦₪100⁩')
    expect(h).not.toContain('{value}')
    expect(strip(h)).toBe(strip(translations[lang].super_tav_headline.replace('{value}', '₪100')))
  })
  it('has the exact copy in en and he', () => {
    expect(strip(superTavHeadline({ ...pool, variants: [{ faceValueAgorot: 15000 }] }, translations.en.super_tav_headline)!)).toBe('Super Tav — ₪150 Value')
    expect(strip(superTavHeadline({ ...pool, variants: [{ faceValueAgorot: 10000 }] }, translations.he.super_tav_headline)!)).toBe('תו על — שווי ₪100')
  })
  it('lists both values of a two-value card, ascending', () => {
    const x = { ...pool, variants: [{ faceValueAgorot: 15000 }, { faceValueAgorot: 10000 }] }
    expect(superTavFaceValues(x)).toEqual([10000, 15000])
    expect(strip(superTavHeadline(x, translations.en.super_tav_headline)!)).toBe('Super Tav — ₪100 / ₪150 Value')
  })
  it('reads a voucher or order value, and is null for other perks or an unknown value', () => {
    expect(strip(superTavHeadline({ ...pool, faceValueAgorot: 10000 }, translations.en.super_tav_headline)!)).toBe('Super Tav — ₪100 Value')
    expect(strip(superTavHeadline({ ...pool, originalPrice: 150 }, translations.en.super_tav_headline)!)).toBe('Super Tav — ₪150 Value')
    expect(superTavHeadline({ fulfillmentType: null, originalPrice: 100 }, translations.en.super_tav_headline)).toBeNull()
    expect(superTavHeadline(pool, translations.en.super_tav_headline)).toBeNull()
  })
  it('falls back to the stored title, a stray label removed', () => {
    expect(displayTitle({ fulfillmentType: null }, 'Two coffees', translations.en.super_tav_headline)).toBe('Two coffees')
    expect(displayTitle(pool, 'Eye Glow — Super Tav', translations.en.super_tav_headline)).toBe('Eye Glow')
  })
})

describe('every surface leads with the headline and puts the business below it', () => {
  const surfaces = [
    'components/discover/OfferCard.tsx', 'landly-mobile/src/components/OfferCard.tsx',
    'app/offers/[offerId]/page.tsx', 'landly-mobile/src/app/offer/[offerId].tsx',
    'app/checkout/page.tsx', 'landly-mobile/src/app/checkout/[offerId].tsx',
    'app/order-success/page.tsx', 'landly-mobile/src/app/order-success/[orderId].tsx',
    'components/member/PerksTab.tsx', 'landly-mobile/src/components/VoucherPass.tsx',
    'app/member/vouchers/[voucherId]/page.tsx', 'landly-mobile/src/app/voucher/[voucherId].tsx',
    'components/member/RedeemedTab.tsx', 'landly-mobile/src/components/RedeemedPass.tsx',
    'components/layout/WishlistPopover.tsx', 'components/home/HeroFeatureGrid.tsx', 'lib/email/sendOrderConfirmationEmail.ts',
  ]
  it.each(surfaces)('%s', (p) => {
    const src = read(p)
    expect(src).toMatch(/super_tav_headline/)
    expect(src).toMatch(/superTav(Headline)?|displayTitle/)
  })
  it('the headline precedes the business name on the detail headers', () => {
    for (const p of ['app/offers/[offerId]/page.tsx', 'app/member/vouchers/[voucherId]/page.tsx']) {
      const src = read(p)
      const i = Math.max(src.indexOf('{headline ? ('), src.indexOf(': headline ? ('))
      expect(i).toBeGreaterThan(-1)
      expect(src.indexOf('{headline}', i)).toBeLessThan(src.indexOf('businessName', src.indexOf('{headline}', i)))
    }
  })
})

describe('My Pass shows the balance, not what was paid', () => {
  it('has no Paid / Voucher value row or Redeemed-only ratio on web or native', () => {
    for (const p of ['components/member/VoucherBalance.tsx', 'landly-mobile/src/components/VoucherBalance.tsx']) {
      const src = read(p)
      expect(src).not.toContain('value_ratio_label')
      expect(src).not.toContain('formatValueRatio')
      expect(src).toContain('voucher_balance_available')
    }
  })
})
