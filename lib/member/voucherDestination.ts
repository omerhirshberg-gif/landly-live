import { localizedName, type Coordinates, type PlaceSnapshot } from '../geo'
import type { Lang } from '../i18n/translations'
import type { NavigationDestination } from '../maps/navigation'
import { shouldShowLocationNavigation, type LocationSubject } from '../offers/locationVisibility'

// Where a voucher is redeemed, from the address and position the voucher froze
// at purchase (older vouchers carry neither: `place` is '' and `destination`
// null, so nothing is shown). Shared by the My Pass cards and the voucher screen
// on the website and in the app.
export function voucherDestination(
  voucher: { businessAddress?: PlaceSnapshot | null; businessGeo?: Coordinates | null } & Pick<LocationSubject, 'fulfillmentType' | 'perkScope' | 'isNationwide'>,
  lang: Lang,
): { place: string; destination: NavigationDestination | null } {
  // A Multipass, multi-chain or nationwide pass has no single place: no address, no navigation.
  if (!shouldShowLocationNavigation(voucher)) return { place: '', destination: null }
  const address = voucher.businessAddress
  // The reader's own language first (short, then full), then whichever language the address has.
  const own = (name: PlaceSnapshot['short']) => name?.[lang]?.trim() ?? ''
  const place = address ? own(address.short) || own(address.formatted) || localizedName(address.short, lang) || localizedName(address.formatted, lang) : ''
  const geo = voucher.businessGeo ?? null
  if (!geo && !place) return { place, destination: null }
  return { place, destination: { geo, placeId: address?.placeId, address: place } }
}
