import { describe, expect, it } from 'vitest'
import { CATEGORY_TILES, countOffersByCategory, filterCategoryTiles, perksCountLabel } from '@/lib/categories'
import { translations, TranslationKey } from '@/lib/i18n/translations'

const tEn = (key: TranslationKey) => translations.en[key]
const tHe = (key: TranslationKey) => translations.he[key]

describe('countOffersByCategory', () => {
  it('counts offers per category and leaves empty categories out', () => {
    const counts = countOffersByCategory([
      { category: 'Cars and Transport' },
      { category: 'Beach and Sea' },
      { category: 'Cars and Transport' },
    ])
    expect(counts.get('Cars and Transport')).toBe(2)
    expect(counts.get('Beach and Sea')).toBe(1)
    expect(counts.has('Kids and Baby')).toBe(false)
  })
})

describe('filterCategoryTiles', () => {
  it('keeps every category for an empty query', () => {
    expect(filterCategoryTiles(CATEGORY_TILES, '', tEn)).toHaveLength(CATEGORY_TILES.length)
  })

  it('matches the translated label', () => {
    expect(filterCategoryTiles(CATEGORY_TILES, 'insur', tEn).map((tile) => tile.category)).toEqual(['Insurance and Savings'])
    const hebrewCars = translations.he.cats_cars.slice(0, 3)
    expect(filterCategoryTiles(CATEGORY_TILES, hebrewCars, tHe).map((tile) => tile.category)).toContain('Cars and Transport')
  })

  it('also matches the stored English name in another language', () => {
    expect(filterCategoryTiles(CATEGORY_TILES, 'cars', tHe).map((tile) => tile.category)).toEqual(['Cars and Transport'])
  })

  it('returns nothing for an unrelated query', () => {
    expect(filterCategoryTiles(CATEGORY_TILES, 'zzzz', tEn)).toEqual([])
  })
})

describe('perksCountLabel', () => {
  it('reads "Coming soon" for an empty category, singular for one, the count otherwise', () => {
    expect(perksCountLabel(0, tEn)).toBe(translations.en.cats_coming_soon)
    expect(perksCountLabel(1, tEn)).toBe(translations.en.cats_perks_count_one)
    expect(perksCountLabel(7, tEn)).toBe('7 perks available')
  })

  it('has the new keys in every language', () => {
    for (const lang of Object.keys(translations) as (keyof typeof translations)[]) {
      for (const key of ['cats_perks_count', 'cats_perks_count_one', 'cats_coming_soon', 'cats_view_all'] as const) {
        expect(translations[lang][key], `${lang}.${key}`).toBeTruthy()
      }
      expect(translations[lang].cats_perks_count).toContain('{count}')
    }
  })
})
