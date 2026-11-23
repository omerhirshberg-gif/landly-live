import type { OfferDocument } from '@/lib/firebase/offers'
import { chainsByCategory } from '@/lib/offers/discoverTab'

/** How many participating chains the Home and Explore preview strip shows. */
export const CHAINS_PREVIEW_MAX = 8

/**
 * A fixed, varied sample of participating chains for the preview strip: the first chain of each Raayonit category in the page's
 * order, then the second of each, and so on, up to `max`. Deterministic (the same catalogue gives the same strip), and empty
 * when there are no chains, so the strip never renders a skeleton. Pure; shared by the website and the Expo app.
 */
export function selectChainsPreview<T extends OfferDocument>(offers: readonly T[], locale = 'he', max = CHAINS_PREVIEW_MAX): T[] {
  const groups = chainsByCategory(offers, locale)
  const picked: T[] = []
  for (let depth = 0; picked.length < max; depth++) {
    let any = false
    for (const group of groups) {
      const offer = group.offers[depth]
      if (!offer) continue
      any = true
      if (picked.length < max) picked.push(offer)
    }
    if (!any) break
  }
  return picked
}

/**
 * The figure in "Redeemable today at {count}+ chains": the real number of participating chains rounded down to a whole ten (under ten, as it is),
 * or null while none are known, so the heading never shows a made-up number. Shared by the website and the Expo app.
 */
export const liveChainCount = (chains: number): number | null => (chains <= 0 ? null : chains >= 10 ? Math.floor(chains / 10) * 10 : chains)
