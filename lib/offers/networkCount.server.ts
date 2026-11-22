import 'server-only'
import { getCachedPublicOffers } from '@/lib/firebase/offersCache.server'
import { liveRaayonitBrandCount } from './resolveChainBrand'

/**
 * The live size of the Raayonit network, for the order email and the Wallet pass. Read from the cached public offers
 * (getAdminDb() inside, so DEV and PROD each count their own). Never throws: 0 leaves the count out of the sentence.
 */
export async function liveChainNetworkCount(): Promise<number> {
  try {
    return liveRaayonitBrandCount(await getCachedPublicOffers())
  } catch {
    return 0
  }
}
