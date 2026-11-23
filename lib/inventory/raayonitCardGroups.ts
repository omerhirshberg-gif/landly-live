import { RAAYONIT_CATEGORY_IDS, isRaayonitCategoryId, raayonitCategoryName, type RaayonitCategoryId } from '@/lib/offers/raayonitCategories'

// How the admin's Raayonit card list is laid out: the multi-chain card pinned on its own, then one group per Raayonit category (all 18,
// in Raayonit's own filter order), each sorted by the business's clean name. Every business is in exactly ONE group, so no row repeats
// (the admin acts on rows): its most specific category, i.e. its first one that is not "רשתות" (Chains), and Chains only when it has no
// section of its own. The other categories Raayonit lists it under are shown on its row. Pure and client-safe.
export type GroupLocale = 'he' | 'en'

export interface GroupableCard { id: string; title: string; brandName: string; perkScope: 'multi_chain' | 'single_business'; /** Every Raayonit category the business is listed under, primary first. */ raayonitCategories: readonly string[] }

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

export interface CardGroup<T> { id: RaayonitCategoryId; label: string; cards: T[] }
export interface GroupedCards<T> { pinned: T[]; groups: CardGroup<T>[] }

/** The one group a business sits in: its first category other than Chains, else Chains (else none). */
export function adminCategoryOf(categories: readonly string[]): RaayonitCategoryId | null {
  const known = categories.filter(isRaayonitCategoryId)
  return known.find((id) => id !== 'networks') ?? known[0] ?? null
}

/**
 * The multi-chain card is pulled out into `pinned`. `groups` always holds all 18 Raayonit categories in Raayonit's order (a category
 * with no card has an empty `cards`, so the filter can list it disabled); cards sort by clean name. Labels are Raayonit's own names
 * in the admin's language, so no translation is needed.
 */
export function groupByRaayonitCategory<T extends GroupableCard>(cards: readonly T[], locale: GroupLocale): GroupedCards<T> {
  const byName = compareNames(locale)
  const sorted = (list: T[]) => [...list].sort((a, b) => byName(cleanName(a), cleanName(b)) || a.id.localeCompare(b.id))
  const pinned = sorted(cards.filter((c) => c.perkScope === 'multi_chain'))
  const byCategory = new Map<RaayonitCategoryId, T[]>()
  for (const card of cards) {
    if (card.perkScope === 'multi_chain') continue
    const id = adminCategoryOf(card.raayonitCategories)
    if (id) byCategory.set(id, [...(byCategory.get(id) ?? []), card])
  }
  return { pinned, groups: RAAYONIT_CATEGORY_IDS.map((id) => ({ id, label: raayonitCategoryName(id, locale), cards: sorted(byCategory.get(id) ?? []) })) }
}

/** The category filter's value after the tab changed: kept only while that category still has cards in the tab. */
export const keepCategory = (selected: string, groups: readonly { id: string; cards: readonly unknown[] }[]): string => (selected === 'all' || groups.some((g) => g.id === selected && g.cards.length > 0) ? selected : 'all')
