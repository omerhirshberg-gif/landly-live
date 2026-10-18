import { describe, expect, it } from 'vitest'
import {
  cancellationFeeAgorot,
  DEFAULT_VOUCHER_VALIDITY_DAYS,
  MAX_REDEMPTION_TERMS_LENGTH,
  normalizeRedemptionTerms,
  normalizeValidityDays,
  parseOfferVoucherTerms,
  voucherExpiresAtMs,
} from '@/lib/payments/voucherTerms'
import { priceDifference } from '@/lib/format'

const DAY = 24 * 60 * 60 * 1000

describe('voucher validity', () => {
  it('defaults to 180 days (six months) from purchase', () => {
    expect(DEFAULT_VOUCHER_VALIDITY_DAYS).toBe(180)
    expect(voucherExpiresAtMs(0, DEFAULT_VOUCHER_VALIDITY_DAYS)).toBe(180 * DAY)
  })

  it('counts whole days from the purchase instant', () => {
    const purchase = Date.UTC(2026, 9, 18, 15, 30)
    expect(voucherExpiresAtMs(purchase, 30)).toBe(purchase + 30 * DAY)
  })

  it.each([undefined, null, 0, -5, 1.5, '90', Number.NaN, 3651])('falls back to the default for %s', (value) => {
    expect(normalizeValidityDays(value)).toBe(DEFAULT_VOUCHER_VALIDITY_DAYS)
    expect(voucherExpiresAtMs(0, value as number)).toBe(DEFAULT_VOUCHER_VALIDITY_DAYS * DAY)
  })

  it('keeps any whole number of days from 1 to 3650', () => {
    expect(normalizeValidityDays(1)).toBe(1)
    expect(normalizeValidityDays(3650)).toBe(3650)
  })
})

describe('cancellation fee', () => {
  it('is 5% of the price below ₪2,000', () => {
    expect(cancellationFeeAgorot(100_00)).toBe(5_00)
    expect(cancellationFeeAgorot(79_90)).toBe(3_99)
  })

  it('is capped at ₪100, whichever is lower', () => {
    expect(cancellationFeeAgorot(2000_00)).toBe(100_00)
    expect(cancellationFeeAgorot(5000_00)).toBe(100_00)
  })

  it('rounds down, so it never exceeds 5%', () => {
    expect(cancellationFeeAgorot(10_25)).toBe(51)
  })

  it.each([0, -100, 1.5, Number.NaN])('is 0 for an invalid amount (%s)', (amount) => {
    expect(cancellationFeeAgorot(amount)).toBe(0)
  })
})

describe('admin offer voucher terms', () => {
  it('defaults both fields when an older client omits them', () => {
    expect(parseOfferVoucherTerms({})).toEqual({ ok: true, validityDays: 180, redemptionTerms: '' })
  })

  it('trims the redemption terms', () => {
    expect(parseOfferVoucherTerms({ validityDays: 30, redemptionTerms: '  Dine-in only.  ' }))
      .toEqual({ ok: true, validityDays: 30, redemptionTerms: 'Dine-in only.' })
  })

  it.each([0, 3651, 2.5, '30'])('rejects validityDays %s', (validityDays) => {
    expect(parseOfferVoucherTerms({ validityDays })).toMatchObject({ ok: false })
  })

  it('rejects non-text or overlong terms', () => {
    expect(parseOfferVoucherTerms({ redemptionTerms: 42 })).toMatchObject({ ok: false })
    expect(parseOfferVoucherTerms({ redemptionTerms: 'x'.repeat(MAX_REDEMPTION_TERMS_LENGTH + 1) })).toMatchObject({ ok: false })
  })

  it('reads stored terms defensively', () => {
    expect(normalizeRedemptionTerms(undefined)).toBe('')
    expect(normalizeRedemptionTerms(' a ')).toBe('a')
  })
})

describe('price breakdown', () => {
  it('computes the discount in agorot, free of float error', () => {
    expect(priceDifference(100, 79.9)).toBe(20.1)
    expect(priceDifference(10.3, 10.1)).toBe(0.2)
  })
})
