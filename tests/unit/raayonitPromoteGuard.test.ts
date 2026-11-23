import { describe, expect, it } from 'vitest'
import { brandKeysOf, livePromotionBlockers, missingTranslations, translationCacheFromOffers, unexpectedProdCards } from '@/lib/inventory/raayonitPromote'

const protect = (t: string) => t.replace(/רעיונית/g, 'Raayonit')
const PROD_PROJECT = 'prod-x'
const ok = { project: PROD_PROJECT, expectedProject: PROD_PROJECT, allowProd: true, confirm: PROD_PROJECT, untranslated: 0, allowUntranslated: false, unexpected: 0, allowRetire: false, displayFlag: undefined }
const field = (text: string) => ({ redemptionTerms: { text, sourceHash: 'x', machine: true } })

describe('livePromotionBlockers', () => {
  it('allows a confirmed production run', () => expect(livePromotionBlockers(ok)).toEqual([]))
  it('refuses landly-dev, a missing --allow-prod and a wrong confirmation', () => {
    expect(livePromotionBlockers({ ...ok, project: 'dev-x' })).toHaveLength(1)
    expect(livePromotionBlockers({ ...ok, allowProd: false })).toHaveLength(1)
    expect(livePromotionBlockers({ ...ok, confirm: 'dev-x' })).toHaveLength(1)
    expect(livePromotionBlockers({ ...ok, confirm: undefined })).toHaveLength(1)
  })
  it('refuses untranslated lines and unexpected cards unless explicitly allowed', () => {
    expect(livePromotionBlockers({ ...ok, untranslated: 2 })).toHaveLength(1)
    expect(livePromotionBlockers({ ...ok, untranslated: 2, allowUntranslated: true })).toEqual([])
    expect(livePromotionBlockers({ ...ok, unexpected: 1 })).toHaveLength(1)
    expect(livePromotionBlockers({ ...ok, unexpected: 1, allowRetire: true })).toEqual([])
  })
  it('never flips an already-on display flag; false or unset is fine', () => {
    expect(livePromotionBlockers({ ...ok, displayFlag: true })).toHaveLength(1)
    expect(livePromotionBlockers({ ...ok, displayFlag: false })).toEqual([])
  })
})

describe('translationCacheFromOffers', () => {
  const offer = { sourceKey: 'raayonit:12', redemptionTerms: '- ללא כפל מבצעים\n- רעיונית בלבד', translations: { fields: { en: field('- No stacking\n- Raayonit only'), ru: field('- one line only') } } }
  it('pairs Hebrew lines with each language line by line, keyed on the protected text', () => {
    const cache = translationCacheFromOffers([offer], protect)
    expect(cache['en|ללא כפל מבצעים']).toBe('No stacking')
    expect(cache['en|Raayonit בלבד']).toBe('Raayonit only')
  })
  it('skips a language whose line count differs rather than guessing', () => {
    expect(Object.keys(translationCacheFromOffers([offer], protect)).some((k) => k.startsWith('ru|'))).toBe(false)
  })
  it('ignores legacy, retired and general-less keys', () => {
    expect(translationCacheFromOffers([{ ...offer, sourceKey: 'raayonit:150:12' }, { ...offer, sourceKey: 'retired:abc' }], protect)).toEqual({})
  })
})

describe('missingTranslations / unexpectedProdCards / brandKeysOf', () => {
  it('reports a line that lacks any language', () => {
    const cache = { 'en|a': 'A', 'ru|a': 'A', 'fr|a': 'A', 'es|a': 'A', 'en|b': 'B' }
    expect(missingTranslations(['a', 'b', ' a '], cache, (t) => t)).toEqual(['b'])
  })
  it('flags PROD cards outside the catalogue, not the general or catalogue ones', () => {
    expect(unexpectedProdCards(['raayonit:general', 'raayonit:1', 'raayonit:9', 'raayonit:150:1', 'other'], ['1'])).toEqual(['raayonit:9', 'raayonit:150:1'])
  })
  it('extracts brand keys from unified source keys only', () => {
    expect(brandKeysOf(['raayonit:1', 'raayonit:general', 'raayonit:150:1', 'retired:x', 5])).toEqual(['1'])
  })
})
