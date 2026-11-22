import { describe, expect, it } from 'vitest'
import { previewOffers, roundedCount, topCategoryGroups } from '@/lib/offers/raayonitPreview'
import type { CategoryGroup } from '@/lib/offers/discoverTab'

const g = (id: string, n: number): CategoryGroup<string> => ({ id: id as never, offers: Array.from({ length: n }, (_, i) => `${id}${i}`) })
const groups = [g('a', 2), g('b', 5), g('c', 1), g('d', 4)]

describe('raayonit preview', () => {
  it('keeps the biggest categories, in the original order', () => {
    expect(topCategoryGroups(groups, 2).map((x) => x.id)).toEqual(['b', 'd'])
    expect(topCategoryGroups(groups, 9)).toHaveLength(4)
  })
  it('mixes categories round-robin for "all" and stops at the count', () => {
    expect(previewOffers(groups, 'all', 6)).toEqual(['a0', 'b0', 'c0', 'd0', 'a1', 'b1'])
    expect(previewOffers(groups, 'all', 99)).toHaveLength(12)
  })
  it('filters to one category in place', () => {
    expect(previewOffers(groups, 'b' as never, 3)).toEqual(['b0', 'b1', 'b2'])
  })
  it('rounds the count down to a ten', () => {
    expect([roundedCount(232), roundedCount(9), roundedCount(10)]).toEqual([230, 9, 10])
  })
})
