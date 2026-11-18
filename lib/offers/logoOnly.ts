// A Raayonit perk has a brand's logo but no promotional photo. Its card then shows the logo itself as the
// hero (large, on white), not a pale category panel with a small badge in the corner. The multi-chain cards
// belong to no single brand and show the Raayonit logo. Pure; shared with the Expo app.

export type LogoHero = { kind: 'brand'; logoUrl: string; fallback?: boolean } | { kind: 'issuer'; small?: boolean }

/** How a card's image is read: a Raayonit card is always ambient, and its trimmed logos and banners (logoKind 'logo') are whole-over-backdrop graphics. */
export const raayonitImageOpts = (offer: { fulfillmentType?: string; logoKind?: string } | null | undefined): { raayonit: boolean; graphic: boolean } => {
  const raayonit = isRaayonitOffer(offer)
  return { raayonit, graphic: raayonit && offer?.logoKind === 'logo' }
}

/** A Raayonit "תו על" card. Its picture is its only image: no corner merchant badge is ever drawn on it. */
export const isRaayonitOffer = (offer: { fulfillmentType?: string } | null | undefined): boolean => offer?.fulfillmentType === 'raayonit_pool'

export function logoOnlyHero(offer: { fulfillmentType?: string; imageUrl?: string; perkScope?: string; businessLogoUrl?: string; logoKind?: string }): LogoHero | null {
  if (offer.fulfillmentType !== 'raayonit_pool' || (offer.imageUrl ?? '').trim()) return null
  if (offer.perkScope === 'multi_chain') return { kind: 'issuer' }
  // No picture of its own: the Raayonit mark, drawn small and centred rather than blown up to fill the hero.
  if (offer.logoKind === 'fallback') return { kind: 'issuer', small: true }
  const logoUrl = (offer.businessLogoUrl ?? '').trim()
  // No picture of its own: the Raayonit mark, drawn small and centred rather than blown up to fill the hero.
  return logoUrl ? { kind: 'brand', logoUrl, ...(offer.logoKind === 'fallback' ? { fallback: true } : {}) } : null
}
