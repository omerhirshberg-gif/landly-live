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

// A branch of a chain has a name and no coordinates, so the maps apps are sent a search for it. The brand is
// put in front only when the branch name does not already carry it ("Azrieli" alone finds a mall; "Fox Azrieli"
// finds the shop), compared without case or spacing.

const squash = (text: string) => text.replace(/\s+/g, ' ').trim()

/** What to search a maps app for to find this branch. */
export function branchSearchQuery(branch: string, brand?: string | null): string {
  const name = squash(branch)
  const owner = squash(brand ?? '')
  if (!owner || name.toLowerCase().includes(owner.toLowerCase())) return name
  return `${owner} ${name}`
}

export interface BranchNavigationUrls extends NavigationLinks {
  /** The apps' own URL, tried first on a phone. */
  nativeWaze: string
  /** Null on Android, where the https link opens the installed app. */
  nativeGoogleMaps: string | null
}

/** A branch picked from Google Places: its exact position, and its place id so Google Maps shows the place itself. */
export interface BranchPoint extends Coordinates {
  placeId?: string | null
}

/**
 * The links for one branch. With a position (a branch picked from Google Places) they go to those exact coordinates;
 * a legacy entry that is only a name is searched for instead.
 */
export function buildBranchNavigationUrls(branch: string, brand?: string | null, platform: 'ios' | 'android' | string = 'ios', point?: BranchPoint | null): BranchNavigationUrls {
  if (point) {
    const ll = coords(point)
    const place = point.placeId?.trim() ? `&query_place_id=${encodeURIComponent(point.placeId.trim())}` : ''
    return {
      waze: `https://waze.com/ul?ll=${ll}&navigate=yes`,
      googleMaps: `https://www.google.com/maps/search/?api=1&query=${ll}${place}`,
      nativeWaze: `waze://?ll=${ll}&navigate=yes`,
      nativeGoogleMaps: platform === 'android' ? null : `comgooglemaps://?q=${ll}`,
    }
  }
  const q = encodeURIComponent(branchSearchQuery(branch, brand))
  return {
    waze: `https://waze.com/ul?q=${q}&navigate=yes`,
    googleMaps: `https://www.google.com/maps/search/?api=1&query=${q}`,
    nativeWaze: `waze://?q=${q}&navigate=yes`,
    nativeGoogleMaps: platform === 'android' ? null : `comgooglemaps://?q=${q}`,
  }
}
