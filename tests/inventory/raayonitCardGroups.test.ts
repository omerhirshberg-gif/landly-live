import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BUSINESS_CATEGORIES } from '@/lib/categories'
import { CATEGORY_SLUGS, categorySlug, cleanName, groupCards, keepCategory, scriptOf, type GroupableCard } from '@/lib/inventory/raayonitCardGroups'
import { en } from '@/lib/admin/translations/en'
import { he } from '@/lib/admin/translations/he'

const card = (id: string, name: string, category = 'Restaurants and Cafes', over: Partial<GroupableCard> = {}): GroupableCard => ({ id, title: `תו על — ${name}`, brandName: name, category, perkScope: 'single_business', ...over })
const labels = (loc: 'he' | 'en') => (c: string) => { const slug = categorySlug(c); return slug ? (loc === 'he' ? he : en)[`rc.cat.${slug}` as 'rc.cat.cars'] : c }
const names = (cards: GroupableCard[]) => cards.map(cleanName)

describe('clean business name', () => {
  it('prefers brandName and otherwise strips the Super Tav lead from the title', () => {
    expect(cleanName({ title: 'תו על — 4Chef', brandName: 'מסעדה' })).toBe('מסעדה')
    expect(cleanName({ title: 'תו על — 4Chef', brandName: '' })).toBe('4Chef')
    expect(cleanName({ title: 'תו על – ALDO', brandName: ' ' })).toBe('ALDO')
    expect(cleanName({ title: 'Super Tav - Acco Beach', brandName: '' })).toBe('Acco Beach')
    expect(cleanName({ title: 'תו על רב-רשתי', brandName: '' })).toBe('תו על רב-רשתי')
  })
  it('knows the script of a name by its first letter', () => {
    expect(scriptOf('6 במאי')).toBe('he')
    expect(scriptOf('4Chef')).toBe('latin')
    expect(scriptOf('123')).toBe('other')
  })
})

describe('sorting inside a category', () => {
  const mixed = [card('1', 'ALDO'), card('2', 'אווז הזהב'), card('3', 'Acco Beach'), card('4', '4Chef'), card('5', 'ADAM HOTELS'), card('6', 'בר איטליה'), card('7', '6 במאי'), card('8', 'Item 10'), card('9', 'Item 2')]
  it('Latin A-Z first in English, case-insensitive and numeric', () => {
    const { groups } = groupCards(mixed, 'en', labels('en'))
    expect(names(groups[0]!.cards)).toEqual(['4Chef', 'Acco Beach', 'ADAM HOTELS', 'ALDO', 'Item 2', 'Item 10', '6 במאי', 'אווז הזהב', 'בר איטליה'])
  })
  it('Hebrew א-ת first in Hebrew, then Latin', () => {
    const { groups } = groupCards(mixed, 'he', labels('he'))
    expect(names(groups[0]!.cards)).toEqual(['6 במאי', 'אווז הזהב', 'בר איטליה', '4Chef', 'Acco Beach', 'ADAM HOTELS', 'ALDO', 'Item 2', 'Item 10'])
  })
})

describe('category groups', () => {
  const cards = [card('a', 'x', 'Restaurants and Cafes'), card('b', 'y', 'Fashion and Shopping'), card('c', 'z', 'Pampering Bundles'), card('d', 'w', 'Mystery Category'), card('e', 'v', 'Kids and Baby')]
  it('orders groups by their localized name, A-Z in English', () => {
    expect(groupCards(cards, 'en', labels('en')).groups.map((g) => g.label)).toEqual(['Fashion and Shopping', 'Kids and Baby', 'Pampering Bundles', 'Restaurants and Cafes', 'Mystery Category'])
  })
  it('orders groups א-ב in Hebrew', () => {
    const labelsHe = groupCards(cards, 'he', labels('he')).groups.map((g) => g.label)
    expect(labelsHe.slice(0, 4)).toEqual(['אופנה וקניות', 'ילדים ותינוקות', 'מארזים מפנקים', 'מסעדות ובתי קפה'])
  })
  it('puts an unknown category last and keeps its raw name', () => {
    const { groups } = groupCards(cards, 'en', labels('en'))
    expect(groups.at(-1)).toMatchObject({ category: 'Mystery Category', label: 'Mystery Category' })
  })
  it('pins the multi-chain card above the groups and out of its category', () => {
    const multi = card('m', 'תו על רב-רשתי', 'Fashion and Shopping', { perkScope: 'multi_chain' })
    const { pinned, groups } = groupCards([...cards, multi], 'he', labels('he'))
    expect(pinned.map((c) => c.id)).toEqual(['m'])
    expect(groups.flatMap((g) => g.cards).some((c) => c.id === 'm')).toBe(false)
    expect(groups.find((g) => g.category === 'Fashion and Shopping')!.cards).toHaveLength(1)
  })
  it('drops empty categories and counts per group', () => {
    const { groups } = groupCards([card('a', 'x'), card('b', 'y')], 'en', labels('en'))
    expect(groups).toHaveLength(1)
    expect(groups[0]!.cards).toHaveLength(2)
  })
})

describe('category filter', () => {
  const groups = [{ category: 'A' }, { category: 'B' }]
  it('is kept while the category has cards and resets to all otherwise', () => {
    expect(keepCategory('A', groups)).toBe('A')
    expect(keepCategory('Z', groups)).toBe('all')
    expect(keepCategory('all', [])).toBe('all')
  })
})

describe('labels', () => {
  it('every business category has a slug and a label in both admin languages', () => {
    for (const category of BUSINESS_CATEGORIES) {
      const slug = CATEGORY_SLUGS[category]
      expect(slug, category).toBeTruthy()
      expect(en[`rc.cat.${slug}` as 'rc.cat.cars'], `en ${category}`).toBeTruthy()
      expect(he[`rc.cat.${slug}` as 'rc.cat.cars'], `he ${category}`).toBeTruthy()
    }
    expect(Object.keys(CATEGORY_SLUGS)).toHaveLength(BUSINESS_CATEGORIES.length)
  })
})

describe('the card panel', () => {
  const src = readFileSync(new URL('../../components/admin/inventory/RaayonitCardsPanel.tsx', import.meta.url), 'utf8')
  it('no longer has the legacy full-rewrite sync button but keeps the Excel actions and Publish all', () => {
    expect(src).not.toContain("sync('web')")
    expect(src).not.toContain("t('rc.sync')")
    expect(src).toContain("t('rc.uploadSheet')")
    expect(src).toContain("t('rc.template')")
    expect(src).toContain("t('rc.publishAll')")
  })
  it('sticky category headers use the approved offsets', () => {
    expect(src).toContain('sticky top-[72px] z-10 lg:top-16')
  })
})
