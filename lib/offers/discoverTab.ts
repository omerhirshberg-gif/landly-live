import type { OfferDocument } from '../firebase/offers'
import { RAAYONIT_CATEGORY_IDS, raayonitCategoriesOf, raayonitCategoryOf, type RaayonitCategoryId } from './raayonitCategories'

// The two collections on Home and Perks: GoLandly's own perks, and Raayonit's "תו על" with the chains that honour it.
// Pure and shared by the website and the Expo app.
export type DiscoverTab = 'landly' | 'raayonit'
export const DISCOVER_TABS: readonly DiscoverTab[] = ['landly', 'raayonit']
export const DEFAULT_DISCOVER_TAB: DiscoverTab = 'landly'
export const parseDiscoverTab = (raw: unknown): DiscoverTab => (raw === 'raayonit' ? 'raayonit' : DEFAULT_DISCOVER_TAB)

type Kind = Pick<OfferDocument, 'fulfillmentType' | 'perkScope'>
export const isRaayonitOffer = (o: Kind): boolean => o.fulfillmentType === 'raayonit_pool'
/** The flagship card: the multi-chain voucher that carries the 100 / 150 stock cards. */
export const isFlagship = (o: Kind): boolean => isRaayonitOffer(o) && o.perkScope === 'multi_chain'
/** One participating chain or venue. */
export const isChain = (o: Kind): boolean => isRaayonitOffer(o) && o.perkScope !== 'multi_chain'

/** The GoLandly tab: every offer that is not Raayonit's. */
export const landlyOffers = <T extends Kind>(offers: readonly T[]): T[] => offers.filter((o) => !isRaayonitOffer(o))

export interface CategoryGroup<T> { id: RaayonitCategoryId; offers: T[] }

type Chain = OfferDocument & { raayonitCategory?: RaayonitCategoryId; sourceKey?: string }
const nameOf = (o: OfferDocument) => (o.brandName || o.businessName || o.title || '').trim()

/**
 * The chains grouped by Raayonit's own categories, in the page's order, empty categories left out. A venue listed under two
 * categories is not duplicated here unless `membership` is set: it then appears in each category Raayonit lists it under (the Raayonit tab's
 * rows and filter), while Home, the counts and the details list keep the one primary category. Sorted alphabetically within a category.
 */
export function chainsByCategory<T extends Chain>(offers: readonly T[], locale = 'he', options: { membership?: boolean } = {}): CategoryGroup<T>[] {
  const byId = new Map<RaayonitCategoryId, T[]>()
  for (const o of offers) {
    if (!isChain(o)) continue
    for (const id of options.membership ? raayonitCategoriesOf(o) : [raayonitCategoryOf(o)]) byId.set(id, [...(byId.get(id) ?? []), o])
  }
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' })
  return RAAYONIT_CATEGORY_IDS.filter((id) => byId.has(id)).map((id) => ({ id, offers: [...byId.get(id)!].sort((a, b) => collator.compare(nameOf(a), nameOf(b)) || a.id.localeCompare(b.id)) }))
}

/** The selected filter after the list changed: kept only while its category still has chains. */
export const keepRaayonitFilter = (selected: RaayonitCategoryId | 'all', groups: readonly CategoryGroup<unknown>[]): RaayonitCategoryId | 'all' => (selected === 'all' || groups.some((g) => g.id === selected) ? selected : 'all')

/** A chain whose card has no branch table of its own (a "רשתות" network tile): its note says the branches vary. */
export const hasNoBranchTable = (o: Pick<OfferDocument, 'branches' | 'participatingChains'>): boolean => !(o.branches && o.branches.length > 0)
