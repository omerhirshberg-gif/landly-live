import { describe, expect, it } from 'vitest'
import { redemptionChannel, redemptionTagKey } from '@/lib/offers/redemption'
import { inferRedemption, inferRedemptionModes } from '@/lib/inventory/raayonitRedemption'
import { bundledCatalog } from '@/lib/inventory/raayonitCatalogSync'
import { finalizeCatalog } from '@/lib/inventory/raayonitSanitize'
import { translations } from '@/lib/i18n/translations'

const brand = (name: string) => finalizeCatalog(bundledCatalog()).find((b) => b.nameHe === name)!

describe('redemption channel', () => {
  it('reads the three channels from the modes, else from the method', () => {
    expect(redemptionChannel({ redemptionModes: ['online'] })).toBe('online')
    expect(redemptionChannel({ redemptionModes: ['online', 'in_store'] })).toBe('both')
    expect(redemptionChannel({ redemptionModes: ['in_store'] })).toBe('in_store')
    expect(redemptionChannel({ redemptionMethod: 'online' })).toBe('online')
    expect(redemptionChannel({})).toBe('in_store')
  })
  it('keeps booking methods on their own wording', () => {
    expect(redemptionTagKey({ redemptionMethod: 'advance_booking', redemptionModes: ['in_store'] })).toBe('redeem_method_advance_booking')
    expect(redemptionTagKey({ redemptionMethod: 'in_store', redemptionModes: ['online', 'in_store'] })).toBe('redeem_channel_both')
  })
  it('classifies babycakes - gift boutique as an online store', () => {
    const b = brand('babycakes - gift boutique')
    const plan = inferRedemption(b)
    expect(plan.method).toBe('online')
    expect(inferRedemptionModes(b, plan)).toEqual(['online'])
  })
  it('classifies a shop with a site and branches as online and in store, and a plain shop as in store', () => {
    const all = finalizeCatalog(bundledCatalog())
    const modes = all.map((b) => inferRedemptionModes(b, inferRedemption(b)).join('+'))
    expect(modes).toContain('online+in_store')
    expect(modes).toContain('in_store')
  })
  it('has the channel labels in all five languages', () => {
    for (const lang of ['he', 'en', 'ru', 'fr', 'es'] as const) {
      const t = (translations as Record<string, Record<string, string>>)[lang]
      for (const k of ['redeem_channel_online', 'redeem_channel_both', 'redeem_channel_in_store', 'perk_online_store']) expect(t[k]).toBeTruthy()
    }
    expect(translations.he.redeem_channel_online).toBe('באונליין')
    expect(translations.he.redeem_channel_both).toBe('באונליין ובבית העסק')
  })
})
