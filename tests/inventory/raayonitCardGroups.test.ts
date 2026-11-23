import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { adminCategoryOf, cleanName, groupByRaayonitCategory, keepCategory, scriptOf, type GroupableCard } from '@/lib/inventory/raayonitCardGroups'
import { RAAYONIT_CATEGORY_IDS, RAAYONIT_CATEGORY_NAMES } from '@/lib/offers/raayonitCategories'
import { en } from '@/lib/admin/translations/en'
import { he } from '@/lib/admin/translations/he'

const card = (id: string, name: string, categories: string[] = ['cafes-restaurants'], over: Partial<GroupableCard> = {}): GroupableCard => ({ id, title: `תו על — ${name}`, brandName: name, raayonitCategories: categories, perkScope: 'single_business', ...over })
const names = (cards: GroupableCard[]) => cards.map(cleanName)
const group = <T extends GroupableCard>(g: ReturnType<typeof groupByRaayonitCategory<T>>, id: string) => g.groups.find((x) => x.id === id)!

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
    expect(names(group(groupByRaayonitCategory(mixed, 'en'), 'cafes-restaurants').cards)).toEqual(['4Chef', 'Acco Beach', 'ADAM HOTELS', 'ALDO', 'Item 2', 'Item 10', '6 במאי', 'אווז הזהב', 'בר איטליה'])
  })
  it('Hebrew א-ת first in Hebrew, then Latin', () => {
    expect(names(group(groupByRaayonitCategory(mixed, 'he'), 'cafes-restaurants').cards)).toEqual(['6 במאי', 'אווז הזהב', 'בר איטליה', '4Chef', 'Acco Beach', 'ADAM HOTELS', 'ALDO', 'Item 2', 'Item 10'])
  })
})

describe('Raayonit category groups', () => {
  const cards = [card('a', 'x', ['cafes-restaurants']), card('b', 'y', ['spa']), card('c', 'z', ['networks', 'spa']), card('d', 'w', ['not-a-category', 'hotels'])]
  it('always lists all 18 categories in Raayonit\'s order, empty ones included', () => {
    const { groups } = groupByRaayonitCategory(cards, 'en')
    expect(groups.map((g) => g.id)).toEqual([...RAAYONIT_CATEGORY_IDS])
    expect(groups).toHaveLength(18)
    expect(groups.find((g) => g.id === 'chef-restaurants')!.cards).toEqual([])
  })
  it('labels groups with Raayonit\'s own names in the admin language', () => {
    expect(group(groupByRaayonitCategory(cards, 'he'), 'spa').label).toBe(RAAYONIT_CATEGORY_NAMES.spa.he)
    expect(group(groupByRaayonitCategory(cards, 'en'), 'networks').label).toBe('Chains')
    expect(group(groupByRaayonitCategory(cards, 'he'), 'pizza-agvania').label).toBe('פיצה - רשת פיצה עגבנייה')
  })
  it('puts every business in exactly one group: its specific category, Chains only when it has no section of its own', () => {
    const g = groupByRaayonitCategory([...cards, card('e', 'only chains', ['networks']), card('f', 'pizza', ['pizza-story', 'networks'])], 'en')
    expect(group(g, 'spa').cards.map((c) => c.id).sort()).toEqual(['b', 'c'])
    expect(group(g, 'networks').cards.map((c) => c.id)).toEqual(['e'])
    expect(group(g, 'pizza-story').cards.map((c) => c.id)).toEqual(['f'])
    expect(group(g, 'hotels').cards.map((c) => c.id)).toEqual(['d'])
    const all = g.groups.flatMap((x) => x.cards.map((c) => c.id))
    expect(new Set(all).size).toBe(all.length)
  })
  it('adminCategoryOf prefers the specific section over Chains', () => {
    expect(adminCategoryOf(['networks', 'cafes-restaurants'])).toBe('cafes-restaurants')
    expect(adminCategoryOf(['basher', 'networks'])).toBe('basher')
    expect(adminCategoryOf(['networks'])).toBe('networks')
    expect(adminCategoryOf(['nope'])).toBeNull()
  })
  it('pins the multi-chain card above the groups and out of every category', () => {
    const multi = card('m', 'תו על רב-רשתי', ['spa'], { perkScope: 'multi_chain' })
    const g = groupByRaayonitCategory([...cards, multi], 'he')
    expect(g.pinned.map((c) => c.id)).toEqual(['m'])
    expect(g.groups.flatMap((x) => x.cards).some((c) => c.id === 'm')).toBe(false)
  })
})

describe('category filter', () => {
  const groups = [{ id: 'spa', cards: [1] }, { id: 'hotels', cards: [] as number[] }]
  it('is kept while the category has cards in the tab and resets to all otherwise', () => {
    expect(keepCategory('spa', groups)).toBe('spa')
    expect(keepCategory('hotels', groups)).toBe('all')
    expect(keepCategory('zzz', groups)).toBe('all')
    expect(keepCategory('all', [])).toBe('all')
  })
})

describe('admin labels', () => {
  it('has the Show all, also-listed-under and category keys in both admin languages, and none of the retired GoLandly ones', () => {
    for (const key of ['rc.showAll', 'rc.alsoIn', 'rc.categoryLabel'] as const) { expect(en[key], key).toBeTruthy(); expect(he[key], key).toBeTruthy() }
    expect(he['rc.showAll']).toBe('הצג הכל')
    expect(Object.keys(en).some((k) => k.startsWith('rc.cat.') || k === 'rc.allCategories')).toBe(false)
    expect(Object.keys(he).some((k) => k.startsWith('rc.cat.') || k === 'rc.allCategories')).toBe(false)
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
  it('lists all 18 categories in the filter (empty ones disabled) with LTR-isolated counts, and keeps the GoLandly select for approvals', () => {
    expect(src).toContain('disabled={g.cards.length === 0}')
    expect(src).toContain('isolateLtr(String(g.cards.length))')
    expect(src).toContain("t('rc.showAll')")
    expect(src).toContain('BUSINESS_CATEGORIES')
  })
})
