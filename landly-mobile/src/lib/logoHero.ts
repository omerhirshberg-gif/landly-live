import type { ImageSourcePropType } from 'react-native'
import { isRaayonitOffer, logoOnlyHero, raayonitImageOpts } from '@shared/offers/logoOnly'
export { isRaayonitOffer, raayonitImageOpts }
import { secureImageUrl } from './imageSource'
import { bundledBrandImage } from './raayonitBrandImages'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ISSUER_LOGO = require('../../assets/images/raayonit-logo.png') as ImageSourcePropType

/** The logo a logo-only Raayonit perk shows as its hero (lib/offers/logoOnly.ts), or null for any other perk. */
/** Whether the hero is the Raayonit mark standing in for a brand with no picture: drawn small. */
export const heroLogoIsFallback = (offer: Parameters<typeof logoOnlyHero>[0] | null | undefined): boolean => { const h = offer ? logoOnlyHero(offer) : null; return !!h && ((h.kind === 'brand' && !!h.fallback) || (h.kind === 'issuer' && !!h.small)) }

export function heroLogoSource(offer: Parameters<typeof logoOnlyHero>[0] | null | undefined): ImageSourcePropType | null {
  const hero = offer ? logoOnlyHero(offer) : null
  if (!hero) return null
  if (hero.kind === 'issuer') return ISSUER_LOGO
  // A Raayonit brand's own image ships inside the app; anything else loads from its link.
  return bundledBrandImage(hero.logoUrl) ?? { uri: secureImageUrl(hero.logoUrl) }
}
