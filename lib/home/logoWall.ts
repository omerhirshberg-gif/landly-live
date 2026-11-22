import type { OfferDocument } from '../firebase/offers'

const MAX = 24

/** The chains with a real logo (not a venue photo), one per business, capped: the tiles of Home's logo wall (website and app). */
export function logoWallOffers(offers: readonly OfferDocument[], byBranches = false): OfferDocument[] {
  // `byBranches` puts the biggest networks first (the most branches), the order of the Raayonit page's popular brands.
  const ordered = byBranches ? [...offers].sort((a, b) => (b.branches?.length ?? 0) - (a.branches?.length ?? 0)) : offers
  const seen = new Set<string>()
  const out: OfferDocument[] = []
  for (const o of ordered) {
    if (!o.imageUrl || o.logoKind === 'photo') continue
    const key = (o.businessName ?? o.id).toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(o)
    if (out.length === MAX) break
  }
  return out
}
