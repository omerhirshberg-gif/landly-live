import { chainsByCategory } from '../offers/discoverTab'
import type { RaayonitCategoryId } from '../offers/raayonitCategories'

// Home's "Explore by category" cards: Raayonit categories shown as photo cards, each over one of the self-hosted category photos
// (public/categories, landly-mobile/assets/categories). Only categories with a matching photo are listed (no cinemas / networks), in this
// order. The two restaurant categories compete for the one restaurants photo: the one with more live venues gets it.
export type CategoryPhoto = 'restaurants' | 'pampering' | 'tourism' | 'attractions' | 'beauty' | 'home' | 'fashion'
export interface CategoryExperience { id: RaayonitCategoryId; photo: CategoryPhoto; count: number }

const FIXED: ReadonlyArray<readonly [RaayonitCategoryId, CategoryPhoto]> = [
  ['spa', 'pampering'], ['hotels', 'tourism'], ['attractions', 'attractions'], ['beauty-lifestyle', 'beauty'], ['luggage-gadgets-home', 'home'], ['jewelry', 'fashion'],
]

export function categoryExperiences(offers: readonly { raayonitCategory?: unknown; sourceKey?: unknown; brandName?: unknown; id: string }[], locale = 'he'): CategoryExperience[] {
  const counts = new Map(chainsByCategory(offers as never[], locale).map((g) => [g.id, g.offers.length] as const))
  const chef = counts.get('chef-restaurants') ?? 0
  const cafes = counts.get('cafes-restaurants') ?? 0
  const restaurantId: RaayonitCategoryId = chef > cafes ? 'chef-restaurants' : 'cafes-restaurants'
  const list: ReadonlyArray<readonly [RaayonitCategoryId, CategoryPhoto]> = [[restaurantId, 'restaurants'], ...FIXED]
  return list.map(([id, photo]) => ({ id, photo, count: counts.get(id) ?? 0 })).filter((c) => c.count > 0)
}
