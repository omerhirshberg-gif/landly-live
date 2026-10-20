import type { Coordinates } from '../geo'

// "Navigate" links for a business, shared by the website and the Expo app.
// The https links are universal links: on a phone with Waze or Google Maps
// installed they open the app, otherwise the maps website. The app tries the
// apps' own URL schemes first (nativeNavigationUrls) and falls back to these.
// Coordinates are the precise destination; the place id lets Google Maps show
// the business itself; the address text is the last resort.

export interface NavigationDestination {
  geo?: Coordinates | null
  placeId?: string | null
  /** The address as text, for a business with no map position. */
  address?: string | null
}

export interface NavigationLinks {
  googleMaps: string
  waze: string
}

const coords = ({ lat, lng }: Coordinates) => `${lat},${lng}`

/** The two https links, or null when there's nowhere to navigate to. */
export function navigationLinks({ geo, placeId, address }: NavigationDestination): NavigationLinks | null {
  const text = address?.trim()
  if (!geo && !text) return null
  const destination = geo ? coords(geo) : encodeURIComponent(text!)
  const place = placeId?.trim() ? `&destination_place_id=${encodeURIComponent(placeId.trim())}` : ''
  return {
    googleMaps: `https://www.google.com/maps/dir/?api=1&destination=${destination}${place}`,
    waze: geo ? `https://waze.com/ul?ll=${coords(geo)}&navigate=yes` : `https://waze.com/ul?q=${encodeURIComponent(text!)}&navigate=yes`,
  }
}

/**
 * The installed apps' own URLs, which the app opens first (straight into
 * navigation, no browser hop); null when there are no coordinates, and the
 * https link is used instead.
 */
export function nativeNavigationUrls(geo: Coordinates | null | undefined, platform: 'ios' | 'android' | string): NavigationLinks | null {
  if (!geo) return null
  const point = coords(geo)
  return {
    googleMaps: platform === 'android' ? `google.navigation:q=${point}` : `comgooglemaps://?daddr=${point}&directionsmode=driving`,
    waze: `waze://?ll=${point}&navigate=yes`,
  }
}
