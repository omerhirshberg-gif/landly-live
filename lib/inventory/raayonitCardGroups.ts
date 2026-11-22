import { BUSINESS_CATEGORIES } from '@/lib/categories'

// How the admin's Raayonit card list is laid out: the multi-chain card pinned on its own, then one group per category (groups
// sorted by their localized name, unknown categories last), each sorted by the business's clean name. Pure and client-safe.
export type GroupLocale = 'he' | 'en'

/** Category (the canonical English key stored on every card) -> the slug of its admin label `rc.cat.<slug>`. */
export const CATEGORY_SLUGS: Record<(typeof BUSINESS_CATEGORIES)[number], string> = {
  'Restaurants and Cafes': 'restaurants', 'Chef Restaurants': 'chef', 'Beach and Sea': 'beach', 'Attractions and Tours': 'attractions', 'Fashion and Shopping': 'fashion',
  'Sport and Fitness': 'sport', 'Israel and Global Tourism': 'tourism', 'Pampering Bundles': 'pampering', 'Beauty and Skincare': 'beauty',
  'Home and Furnishing': 'home', 'Kids and Baby': 'kids', 'Insurance and Savings': 'insurance', 'Cars and Transport': 'cars',
}
export const categorySlug = (category: string): string | null => (CATEGORY_SLUGS as Record<string, string>)[category] ?? null

export interface GroupableCard { id: string; title: string; brandName: string; category: string; perkScope: 'multi_chain' | 'single_business' }

const PREFIX = /^(?:תו על|Super Tav)\s*[-–—]\s*/i
/** The business's own name: brandName, else the title without its "תו על — " / "Super Tav — " lead. */
export function cleanName(card: Pick<GroupableCard, 'title' | 'brandName'>): string {
  return (card.brandName.trim() || card.title.replace(PREFIX, '')).trim()
}

type Script = 'he' | 'latin' | 'other'
/** The script of the first letter of a name ("6 במאי" is Hebrew, "4Chef" Latin); a name with no letter is "other". */
export function scriptOf(name: string): Script {
  const letter = name.match(/\p{L}/u)?.[0]
  if (!letter) return 'other'
  return /\p{Script=Hebrew}/u.test(letter) ? 'he' : /\p{Script=Latin}/u.test(letter) ? 'latin' : 'other'
}
// Hebrew names first in the Hebrew admin, Latin first in the English one.
const RANK: Record<GroupLocale, Record<Script, number>> = { he: { he: 0, latin: 1, other: 2 }, en: { latin: 0, he: 1, other: 2 } }

const collator = (locale: GroupLocale) => new Intl.Collator(locale, { numeric: true, sensitivity: 'base' })

export function compareNames(locale: GroupLocale): (a: string, b: string) => number {
  const c = collator(locale)
  return (a, b) => RANK[locale][scriptOf(a)] - RANK[locale][scriptOf(b)] || c.compare(a, b)
}

export interface CardGroup<T> { category: string; label: string; cards: T[] }
export interface GroupedCards<T> { pinned: T[]; groups: CardGroup<T>[] }

/**
 * `labelOf` is the localized category name. The multi-chain card is pulled out of its category into `pinned`. Groups sort by label
 * with a category outside BUSINESS_CATEGORIES last; cards sort by clean name.
 */
export function groupCards<T extends GroupableCard>(cards: readonly T[], locale: GroupLocale, labelOf: (category: string) => string): GroupedCards<T> {
  const byName = compareNames(locale)
  const sorted = (list: T[]) => [...list].sort((a, b) => byName(cleanName(a), cleanName(b)) || a.id.localeCompare(b.id))
  const pinned = sorted(cards.filter((c) => c.perkScope === 'multi_chain'))
  const byCategory = new Map<string, T[]>()
  for (const card of cards) if (card.perkScope !== 'multi_chain') byCategory.set(card.category, [...(byCategory.get(card.category) ?? []), card])
  const c = collator(locale)
  const groups = [...byCategory].map(([category, list]) => ({ category, label: labelOf(category), cards: sorted(list) }))
    .sort((a, b) => Number(categorySlug(a.category) === null) - Number(categorySlug(b.category) === null) || c.compare(a.label, b.label))
  return { pinned, groups }
}

/** The category filter's value after the tab changed: kept only while that category still has cards. */
export const keepCategory = (selected: string, groups: readonly { category: string }[]): string => (selected === 'all' || groups.some((g) => g.category === selected) ? selected : 'all')
