import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { showcaseCards } from '@/lib/home/superShowcase'
import { variantDiscountPercent } from '@/lib/offers/variants'
import { flagshipPurchase } from '@/lib/offers/flagshipPurchase'
import { translations } from '@/lib/i18n/translations'

vi.mock('@/lib/firebase/config', () => ({ db: {}, auth: {}, app: {} }))
const { DEFAULT_STOCKS } = await import('@/lib/inventory/raayonitCatalogSync')
const { demoCode } = await import('@/lib/payments/sandboxDemoStock')
const { validateRows } = await import('@/lib/inventory/ledger/importBatch')

// The 3-tier Raayonit Card ladder: 100 for 89, 150 for 132, 200 for 174.
const variants = DEFAULT_STOCKS.map((s, i) => ({ ...s, poolId: `pool${i}` }))

describe('Raayonit Card pricing ladder', () => {
  it('sells 100 for 89, 150 for 132 and 200 for 174, in agorot', () => {
    expect(DEFAULT_STOCKS.map((s) => [s.faceValueAgorot, s.priceAgorot])).toEqual([[10000, 8900], [15000, 13200], [20000, 17400]])
  })
  it('discounts -11%, -12%, -13%, saving 11, 18 and 26', () => {
    expect(variants.map(variantDiscountPercent)).toEqual([11, 12, 13])
    const cards = showcaseCards({ id: 'f', variants })
    expect(cards.map((c) => [c.price, c.value, c.save, c.discountPercent])).toEqual([[89, 100, 11, 11], [132, 150, 18, 12], [174, 200, 26, 13]])
  })
  it('marks only the 200 value as the best value and selects it by default; 1 tap picks another', () => {
    const cards = showcaseCards({ id: 'f', variants })
    expect(cards.map((c) => c.best)).toEqual([false, false, true])
    const base = { variants, picked: '', claimedPools: [], now: 0 }
    expect(flagshipPurchase(base).selected?.priceAgorot).toBe(17400)
    expect(flagshipPurchase({ ...base, picked: 'pool0' }).selected?.priceAgorot).toBe(8900)
    expect(flagshipPurchase({ ...base, picked: 'pool1' }).selected?.priceAgorot).toBe(13200)
  })
  it('has the "Best value" line and no stale 129 in all five languages', () => {
    for (const lang of ['he', 'en', 'ru', 'fr', 'es'] as const) {
      expect(translations[lang].raayonit_best_value).toContain('{percent}')
      expect(translations[lang].products_sub).not.toMatch(/\b(two|два|dos|deux|שני)/i)
    }
    for (const path of ['components/raayonit/useFlagshipPurchase.ts', 'landly-mobile/src/lib/useFlagshipPurchase.ts']) {
      const src = readFileSync(path, 'utf8')
      expect(src, path).not.toContain('price: 129')
      expect(src, path).toContain('price: 174')
    }
  })
})

describe('dev sandbox demo codes', () => {
  it('are RAAYONIT-DEMO-{value}-XXXX for the 100, 150 and 200 stocks', () => {
    expect(demoCode(20000, 'AB3K')).toBe('RAAYONIT-DEMO-200-AB3K')
    expect(demoCode(15000, 'AB3K')).toBe('RAAYONIT-DEMO-150-AB3K')
    expect(demoCode(10000, 'AB3K')).toBe('RAAYONIT-DEMO-100-AB3K')
  })
  it('is wired into a sandbox order only, ahead of the stock reservation', () => {
    const src = readFileSync('lib/payments/initiateOrder.ts', 'utf8')
    expect(src).toContain('if (sandbox) await ensureSandboxDemoStock(')
    expect(src.indexOf('ensureSandboxDemoStock(db')).toBeLessThan(src.indexOf('reserveForCheckout('))
    expect(readFileSync('lib/payments/sandboxDemoStock.ts', 'utf8')).toContain('isPaymentSandboxEnabled()')
  })
})

describe('admin inventory upload', () => {
  it('accepts a 2-column sheet with 100, 150 and 200 vouchers, each into its own stock', () => {
    const products = new Map([[10000, 'p100'], [15000, 'p150'], [20000, 'p200']])
    const out = validateRows([{ code: 'AAAA1111BBBB', amount: 200 }, { code: 'CCCC2222DDDD', amount: 150 }, { code: 'EEEE3333FFFF', amount: 100 }], products)
    expect(out.rejected).toHaveLength(0)
    expect(out.valid.map((r) => [r.amountAgorot, r.productId])).toEqual([[20000, 'p200'], [15000, 'p150'], [10000, 'p100']])
  })
})
