import { describe, expect, it } from 'vitest'
import { formatValueRatio, resolveVoucherValue, shekels } from '@/lib/vouchers/voucherValue'

describe('resolveVoucherValue', () => {
  it('uses the pool face value when there is one', () => {
    const v = resolveVoucherValue({ amountAgorot: 7900, faceValueAgorot: 10000 })!
    expect(v).toEqual({ paidAgorot: 7900, faceValueAgorot: 10000, discounted: true })
    expect(formatValueRatio(v)).toBe('₪79 / ₪100')
  })
  it('shows a full-value purchase as 100 / 100', () => {
    const v = resolveVoucherValue({ amountAgorot: 10000, faceValueAgorot: 10000 })!
    expect(v.discounted).toBe(false)
    expect(formatValueRatio(v)).toBe('₪100 / ₪100')
  })
  it('derives the face value from savings, then from the order original price', () => {
    expect(formatValueRatio(resolveVoucherValue({ amountAgorot: 8900, savingsAgorot: 1100 })!)).toBe('₪89 / ₪100')
    expect(formatValueRatio(resolveVoucherValue({ amountAgorot: 8900, originalPrice: 100 })!)).toBe('₪89 / ₪100')
  })
  it('never shows a face value below what was paid', () => {
    expect(resolveVoucherValue({ amountAgorot: 5000, faceValueAgorot: 4000 })!.faceValueAgorot).toBe(5000)
  })
  it('omits free or unknown amounts', () => {
    expect(resolveVoucherValue({ amountAgorot: 0 })).toBeNull()
    expect(resolveVoucherValue({})).toBeNull()
    expect(resolveVoucherValue({ amountAgorot: null, faceValueAgorot: 10000 })).toBeNull()
  })
  it('keeps agorot when the amount is not whole', () => {
    expect(shekels(7990)).toBe('₪79.90')
  })
})
