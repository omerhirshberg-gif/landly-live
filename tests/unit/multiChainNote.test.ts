import { describe, expect, it } from 'vitest'
import { chainCountLabel, isRaayonitMultiChain, withChainCount } from '@/lib/offers/multiChainNote'
import { translations } from '@/lib/i18n/translations'
import { offerKind } from '@/lib/offers/offerKind'

describe('multi-chain note', () => {
  it('recognises Raayonit and multi-chain subjects only', () => {
    expect(isRaayonitMultiChain({ fulfillmentType: 'raayonit_pool' })).toBe(true)
    expect(isRaayonitMultiChain({ redemptionKind: 'code_only' })).toBe(true)
    expect(isRaayonitMultiChain({ perkScope: 'multi_chain' })).toBe(true)
    expect(isRaayonitMultiChain({ fulfillmentType: 'manual' })).toBe(false)
    expect(isRaayonitMultiChain(null)).toBe(false)
  })
  it('floors the network size to tens', () => {
    expect(chainCountLabel(246)).toBe('240+')
    expect(chainCountLabel(230)).toBe('230+')
    expect(chainCountLabel(9)).toBe('')
    expect(chainCountLabel(undefined)).toBe('')
  })
  it('isolates the count and drops the placeholder while unknown', () => {
    expect(withChainCount('at {count} chains', 246)).toBe('at ⁦240+⁩ chains')
    expect(withChainCount('at {count} chains', 0)).toBe('at chains')
  })
  it('derives the offer type', () => {
    expect(offerKind({ fulfillmentType: 'raayonit_pool', originalPrice: 100, offerPrice: 80 })).toBe('voucher')
    expect(offerKind({ originalPrice: 100, offerPrice: 80 })).toBe('discount')
    expect(offerKind({ originalPrice: 0, offerPrice: 0 })).toBe('deal')
  })
})

describe('new i18n keys', () => {
  const keys = Object.keys(translations.en).filter((k) => ['value_ratio_label', 'offer_multi_chain_bonus', 'order_multi_chain_note', 'voucher_multi_chain_credit', 'voucher_chains_where_else', 'wallet_pass_multi_chain', 'filter_sort_trigger', 'card_expires_on', 'brand_spotlight_cta', 'offer_login_prompt', 'category_share_friend', 'perk_see_all_perks'].includes(k))
  it('exist, are non-empty and keep placeholders in every language', () => {
    expect(keys.length).toBe(12)
    for (const lang of ['en', 'ru', 'es', 'fr', 'he'] as const) {
      const t = translations[lang] as Record<string, string>
      for (const k of keys) expect(t[k], `${lang}.${k}`).toBeTruthy()
      expect(t.offer_multi_chain_bonus).toContain('{count}')
      expect(t.voucher_multi_chain_credit).toContain('{count}')
      expect(t.wallet_pass_multi_chain).toContain('{count}')
      expect(t.card_expires_on).toContain('{date}')
    }
  })
})
