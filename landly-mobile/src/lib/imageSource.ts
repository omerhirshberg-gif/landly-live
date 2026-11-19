// How the app loads a perk card's two pictures (DealMedia.tsx). What each
// image is, and which goes where, is shared with the website
// (lib/offers/dealImage.ts).

export { badgeLogoUri, businessInitial, dealImageRole, type DealImageRole } from '@shared/offers/dealImage'

/** The file name of one of our bundled Raayonit brand images in a link or path (any host or none, a leading slash or not, a query or hash), lower-cased; null when it is not one. */
export function brandImageFile(raw: string | null | undefined): string | null {
  const m = (raw ?? '').trim().match(/(?:^|\/)images\/raayonit-brands\/([\w-]+\.(?:png|jpe?g|webp))(?:[?#]|$)/i)
  return m ? m[1]!.toLowerCase() : null
}

/** The file name of one of the site's own bundled offer pictures (…/images/raayonit/{file}: the multi-chain offer's), same rules as brandImageFile. */
export function siteImageFile(raw: string | null | undefined): string | null {
  const m = (raw ?? '').trim().match(/(?:^|\/)images\/raayonit\/([\w-]+\.(?:png|jpe?g|webp))(?:[?#]|$)/i)
  return m ? m[1]!.toLowerCase() : null
}

/**
 * The link as the device can load it: https only (iOS blocks plain http: no ATS exception in app.json), with spaces and
 * non-ASCII characters (Hebrew paths) percent-encoded. A bundled brand image is not a web link: see useDealImage.
 */
export function secureImageUrl(raw: string): string {
  const value = raw.trim()
  if (!value) return ''
  let url = ''
  if (/^https:\/\//i.test(value)) url = value
  else if (/^http:\/\//i.test(value)) url = `https://${value.slice('http://'.length)}`
  // Protocol-relative links load over https; anything else isn't a web image.
  else if (value.startsWith('//')) url = `https:${value}`
  else return ''
  // encodeURI leaves an already-encoded link alone except for '%', so only links that still need it are touched.
  return /[^\x21-\x7e]/.test(url) ? encodeURI(url) : url
}
