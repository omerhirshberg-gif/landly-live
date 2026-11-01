// How the app loads a perk card's two pictures (DealMedia.tsx). What each
// image is, and which goes where, is shared with the website
// (lib/offers/dealImage.ts).

export { badgeLogoUri, businessInitial, dealImageRole, type DealImageRole } from '@shared/offers/dealImage'

/** The link as the device can load it: iOS blocks plain http (no ATS exception in app.json). */
export function secureImageUrl(raw: string): string {
  const value = raw.trim()
  if (!value) return ''
  if (/^https:\/\//i.test(value)) return value
  if (/^http:\/\//i.test(value)) return `https://${value.slice('http://'.length)}`
  // Protocol-relative links load over https; anything else isn't a web image.
  if (value.startsWith('//')) return `https:${value}`
  return ''
}
