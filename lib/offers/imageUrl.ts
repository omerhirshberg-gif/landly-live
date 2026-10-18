// Offer images are links the admin pastes, and the usual copy-paste sources
// hand out a page *about* an image rather than the image file: a Google Images
// result, a Drive "view" link, an Imgur post. <img> can't render those, so the
// card fell back to its placeholder. This turns the known wrappers into the
// direct file URL, on save (admin routes) and on read (lib/firebase/offers.ts,
// so offers stored before this keep working on web and mobile alike).
//
// Shared with the Expo app: regular expressions only, no URL/URLSearchParams
// (React Native's URL implementation is incomplete; see lib/apiOrigin.ts).

const GOOGLE_IMGRES = /^https?:\/\/(?:www\.)?google\.[a-z.]{2,6}\/imgres\?(?:[^#]*&)?imgurl=([^&#]+)/i
const DRIVE_FILE = /^https?:\/\/drive\.google\.com\/file\/d\/([\w-]{10,})/i
const DRIVE_ID_PARAM = /^https?:\/\/drive\.google\.com\/(?:open|uc)\?(?:[^#]*&)?id=([\w-]{10,})/i
const IMGUR_POST = /^https?:\/\/(?:www\.|m\.)?imgur\.com\/([A-Za-z0-9]{5,10})\/?(?:[?#].*)?$/i
const HTTP_URL = /^https?:\/\/[^\s/?#]+\.[^\s/?#]+/i

function decode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** The direct image file behind a pasted link, or the link unchanged. */
export function normalizeImageUrl(raw: string): string {
  const value = raw.trim()
  if (!value) return ''

  const imgres = value.match(GOOGLE_IMGRES)
  if (imgres) {
    const inner = decode(imgres[1]!)
    // One level only: an imgres link never legitimately wraps another wrapper.
    if (HTTP_URL.test(inner) && !GOOGLE_IMGRES.test(inner)) return normalizeImageUrl(inner)
  }

  // Needs the file shared as "Anyone with the link".
  const driveId = value.match(DRIVE_FILE)?.[1] ?? value.match(DRIVE_ID_PARAM)?.[1]
  if (driveId) return `https://lh3.googleusercontent.com/d/${driveId}`

  const imgur = value.match(IMGUR_POST)
  if (imgur) return `https://i.imgur.com/${imgur[1]}.jpg`

  return value
}

/**
 * Why a (normalized) link can't be an image, for the admin to fix before
 * saving -- or null when nothing is known to be wrong with it.
 */
export function imageUrlProblem(normalized: string): string | null {
  if (/^https?:\/\/(?:www\.)?google\.[a-z.]{2,6}\/(?:search|imgres|url)\b/i.test(normalized)) {
    return 'This is a Google search page, not an image. Open the image itself and copy its address.'
  }
  if (/^https?:\/\/drive\.google\.com\//i.test(normalized)) {
    return 'This Google Drive link is not a single shared file. Share the file with "Anyone with the link" and paste its link.'
  }
  if (/^https?:\/\/(?:www\.|m\.)?imgur\.com\/(?:a|gallery)\//i.test(normalized)) {
    return 'This is an Imgur album. Open the single image and copy its direct link (i.imgur.com/…).'
  }
  return null
}
