import { describe, expect, it, vi } from 'vitest'
import type { OfferDocument } from '@/lib/firebase/offers'
import type { CategoryTile } from '@/lib/categories'

// The Firebase client is not under test: the pure helpers only import its types and offer predicates.
vi.mock('@/lib/firebase/config', () => ({ auth: {}, db: {}, storage: {} }))
const { homeIsEmpty } = await import('@/lib/home/categoryRails')
const { CHAINS_PREVIEW_MAX, selectChainsPreview } = await import('@/lib/home/chainsPreview')
type HomeCategorySlots = import('@/lib/home/categoryRails').HomeCategorySlots

const tile = { category: 'Beach and Sea' } as CategoryTile
const group = (...kinds: Array<'offer' | 'placeholder'>): HomeCategorySlots => ({
  tile,
  slots: kinds.map((kind, i) => (kind === 'offer' ? { kind, key: `o${i}`, offer: { id: `o${i}` } as OfferDocument } : { kind, key: `p${i}` })),
})
const chain = (id: string, raayonitCategory: string): OfferDocument => ({ id, title: id, fulfillmentType: 'raayonit_pool', perkScope: 'single_chain', raayonitCategory }) as unknown as OfferDocument

describe('homeIsEmpty', () => {
  it('is true while every slot is a placeholder', () => {
    expect(homeIsEmpty([group('placeholder', 'placeholder'), group('placeholder')])).toBe(true)
  })
  it('is false as soon as one real perk exists', () => {
    expect(homeIsEmpty([group('placeholder'), group('offer', 'placeholder')])).toBe(false)
  })
})

describe('selectChainsPreview', () => {
  it('is empty without chains and ignores the flagship and non-Raayonit offers', () => {
    const flagship = { id: 'f', fulfillmentType: 'raayonit_pool', perkScope: 'multi_chain' } as unknown as OfferDocument
    const own = { id: 'g', fulfillmentType: 'standard', perkScope: 'single_chain' } as unknown as OfferDocument
    expect(selectChainsPreview([flagship, own])).toEqual([])
  })
  it('takes one chain per category before a second, and is deterministic', () => {
    const offers = [chain('a1', 'spa'), chain('a2', 'spa'), chain('b1', 'jewelry'), chain('c1', 'cinemas')]
    const ids = selectChainsPreview(offers, 'en').map((o) => o.id)
    expect(ids).toEqual(['a1', 'a2', 'b1', 'c1'].sort((x, y) => ids.indexOf(x) - ids.indexOf(y)))
    expect(ids.slice(0, 3).map((id) => id[0]).sort()).toEqual(['a', 'b', 'c'])
    expect(selectChainsPreview([...offers].reverse(), 'en').map((o) => o.id)).toEqual(ids)
  })
  it('caps at the maximum', () => {
    const offers = Array.from({ length: 30 }, (_, i) => chain(`c${i}`, 'spa'))
    expect(selectChainsPreview(offers)).toHaveLength(CHAINS_PREVIEW_MAX)
  })
})

describe('liveChainCount', () => {
  it('is null while no chain is known, so the heading shows no made-up number', async () => {
    const { liveChainCount } = await import('@/lib/home/chainsPreview')
    expect(liveChainCount(0)).toBeNull()
  })
  it('rounds down to a whole ten from ten chains, and is exact below', async () => {
    const { liveChainCount } = await import('@/lib/home/chainsPreview')
    expect([liveChainCount(7), liveChainCount(10), liveChainCount(237)]).toEqual([7, 10, 230])
  })
})

describe('live chains copy', () => {
  it('has every key in all five languages, the count placeholder in the title, and no leftover preview key', async () => {
    const { translations } = await import('@/lib/i18n/translations')
    for (const lang of ['en', 'he', 'ru', 'fr', 'es'] as const) {
      const dict = translations[lang] as Record<string, string>
      for (const key of ['chains_live_title', 'chains_live_cta', 'chains_live_badge', 'chains_live_show_all', 'perks_available_now', 'perks_browse_categories', 'raayonit_entry_sub', 'category_soon_title', 'category_soon_cta_all', 'category_strip_title', 'category_strip_sub', 'category_strip_title_all']) expect(dict[key]?.length, `${lang}.${key}`).toBeGreaterThan(0)
      expect(dict.chains_live_title, lang).toContain('{count}')
      for (const key of ['raayonit_entry_sub', 'category_soon_cta_all', 'category_strip_sub']) expect(dict[key], `${lang}.${key}`).toContain('{count}')
      for (const key of ['category_soon_title', 'category_strip_title']) expect(dict[key], `${lang}.${key}`).toContain('{category}')
      expect(dict.chains_preview_title, lang).toBeUndefined()
    }
  })
})
