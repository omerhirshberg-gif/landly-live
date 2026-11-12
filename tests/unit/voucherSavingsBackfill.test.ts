import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/firebase/orders', () => ({ getOrdersByIds: vi.fn() }))
import { savingsAgorotOf } from '@/lib/member/savingsMath'
import { sumSavings } from '@/lib/member/savings'
import * as script from '../../scripts/lib/voucherSavings.mjs'

const cases: [unknown, number][] = [[50, 1000], [24, 1500], [null, 1000], [0, 100], [10.1, 1000], [0.3, 20], [NaN, 5], ['20', 5], [30, 3000], [19.99, 1]]

describe('savings arithmetic', () => {
  it.each(cases)('the backfill script and the webhook agree for original price %j paid %j agorot', (original, paid) => {
    expect(script.savingsAgorotOf(original, paid)).toBe(savingsAgorotOf(original, paid))
  })

  it('never goes negative on a price rise and ignores a missing original price', () => {
    expect(savingsAgorotOf(10, 1500)).toBe(0)
    expect(savingsAgorotOf(null, 1500)).toBe(0)
    expect(savingsAgorotOf(24, 1500)).toBe(900)
  })

  it('the stored value matches what summing the orders has always shown', () => {
    const order = { status: 'paid', originalPrice: 24, amount: 15 } as const
    expect(script.savingsFromOrder(order) / 100).toBe(sumSavings([order]))
    const refunded = { status: 'refunded', originalPrice: 24, amount: 15 } as const
    expect(script.savingsFromOrder(refunded)).toBe(0)
    expect(script.savingsFromOrder(null)).toBe(0)
  })
})
