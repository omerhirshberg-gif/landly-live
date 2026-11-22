import { describe, expect, it } from 'vitest'
import { flagshipLimitNotice } from '@/lib/offers/flagshipLimit'
import type { ShowcaseCard } from '@/lib/home/superShowcase'

const card = (pool: string, value: number): ShowcaseCard => ({ denomination: value, pool, price: value - 10, value, save: 10, discountPercent: 10, best: false, href: '' })
const cards = [card('100', 100), card('150', 150), card('200', 200)]

describe('flagshipLimitNotice', () => {
  it('says nothing while the member owns no value', () => {
    expect(flagshipLimitNotice(cards, [])).toBeNull()
  })
  it('names the owned values while others are still free', () => {
    const n = flagshipLimitNotice(cards, ['200', '100'])!
    expect(n.kind).toBe('some')
    expect(n.values).toContain('₪100')
    expect(n.values).toContain('₪200')
    expect(n.values).not.toContain('₪150')
  })
  it('reports the limit reached when every value is owned', () => {
    expect(flagshipLimitNotice(cards, ['100', '150', '200'])!.kind).toBe('all')
  })
})
