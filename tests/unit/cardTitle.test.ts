import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { cardTitle } from '@/lib/offers/cardTitle'
import { translations } from '@/lib/i18n/translations'

const read = (p: string) => readFileSync(p, 'utf8')

describe('cardTitle', () => {
  it('strips a trailing Super Tav suffix on Raayonit cards only', () => {
    expect(cardTitle('Eye Glow — Super Tav', { raayonit: true })).toBe('Eye Glow')
    expect(cardTitle('Eye Glow - Super Tav', { raayonit: true })).toBe('Eye Glow')
    expect(cardTitle('עין גלואו – תו על', { raayonit: true })).toBe('עין גלואו')
    expect(cardTitle('תו על — מלון איר', { raayonit: true })).toBe('מלון איר')
    expect(cardTitle('Eye Glow — Super Tav', { raayonit: false })).toBe('Eye Glow — Super Tav')
    expect(cardTitle('Cafe - Italian & Israeli Kitchen', { raayonit: true })).toBe('Cafe - Italian & Israeli Kitchen')
  })
  it('never returns an empty title', () => {
    expect(cardTitle('— Super Tav', { raayonit: true })).toBe('— Super Tav')
    expect(cardTitle('', { raayonit: true })).toBe('')
  })
})

describe('clean cards and the category rail', () => {
  const cards = ['components/discover/OfferCard.tsx', 'landly-mobile/src/components/OfferCard.tsx']
  it('draw no redemption pill, location, distance or denomination pill', () => {
    for (const p of cards) {
      const src = read(p)
      for (const bad of ['redemptionTagKey', 'perk_online_store', 'PerkReachLine', 'offerPlaceLabel', 'formatDistance', 'faceValueAgorot / 100', 'perk_multi_chain_badge']) expect(src, `${p} ${bad}`).not.toContain(bad)
      expect(src).toContain('displayTitle(')
    }
  })
  it('replaces the brand rail with the category rail between 1px dividers', () => {
    const web = read('app/offers/[offerId]/page.tsx')
    expect(web).toContain("t('offer_more_in_category')")
    expect(web).not.toContain('offer_more_from_brand')
    expect(web).toContain('border-y border-[#E2E8F0] py-6')
    const native = read('landly-mobile/src/app/offer/[offerId].tsx')
    expect(native).toContain("t('offer_more_in_category')")
    expect(native).toContain("borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#E2E8F0'")
  })
  it('moves the website and phone buttons into the business card', () => {
    expect(read('app/offers/[offerId]/page.tsx')).not.toContain('<ContactActions')
    expect(read('landly-mobile/src/app/offer/[offerId].tsx')).not.toContain('<ContactActions')
    expect(read('components/offers/BrandSpotlight.tsx')).toContain('<ContactActions row')
    expect(read('landly-mobile/src/components/BrandSpotlight.tsx')).toContain('<ContactActions equal')
  })
  it('names the new strings in all five languages', () => {
    for (const lang of ['en', 'he', 'ru', 'es', 'fr'] as const) {
      expect(translations[lang].offer_more_in_category).toBeTruthy()
    }
    expect(translations.he.offer_more_in_category).toBe('עוד הטבות מאותה קטגוריה')
  })
})
