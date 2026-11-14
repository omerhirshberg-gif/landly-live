import { localizedName, parseParticipatingPlaces, placeChainName, type Coordinates, type ParticipatingPlace } from '../geo'
import type { Lang } from '../i18n/translations'
import { normalizeChains } from './perkScope'

// The stores, malls or chains that honour a perk, as the branch cards show them. A branch the admin picked from
// Google Places is named in the reader's language by Google itself (reader's language, else English, else Hebrew)
// and carries its exact position; a name that was only typed (an older offer, a batch import, a brand of a
// multi-chain pass) is shown as written and is searched for by name. Pure and shared with the Expo app.

export interface Branch {
  /** Stable for a list item. */
  key: string
  /** What the card shows, in the reader's language. */
  label: string
  /** The name as the admin wrote it (Hebrew for a picked branch); what a text search uses when there is no position. */
  name: string
  /** Exact position and place id of a picked branch; absent for a typed name. */
  point?: Coordinates & { placeId: string }
}

export interface BranchSubject {
  participatingChains?: readonly string[] | null
  participatingPlaces?: readonly ParticipatingPlace[] | null
}

export function participatingBranches(subject: BranchSubject | null | undefined, lang: Lang): Branch[] {
  const places = parseParticipatingPlaces(subject?.participatingPlaces ?? [])
  const known = new Set(places.map((place) => placeChainName(place).toLowerCase()))
  const picked: Branch[] = places.map((place) => ({
    key: place.placeId,
    label: localizedName(place.names, lang),
    name: placeChainName(place),
    point: { lat: place.lat, lng: place.lng, placeId: place.placeId },
  }))
  const typed: Branch[] = normalizeChains(subject?.participatingChains ?? [])
    .filter((name) => !known.has(name.toLowerCase()))
    .map((name, i) => ({ key: `typed-${i}-${name}`, label: name, name }))
  return [...picked, ...typed]
}
