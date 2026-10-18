// Links into the Expo app (landly-mobile/src/app/+native-intent.tsx) and the
// website's "Open in app" hint (components/layout/OpenInAppHint.tsx). The web
// and the app name the same screens differently:
//
//   website                    app (Expo Router)
//   /offers/{offerId}          /offer/{offerId}
//   /member/vouchers/{id}      /voucher/{id}
//
// so a landly:// link or a website URL is mapped onto the app's route here.
// Shared with the Expo app: regular expressions only, no URL/URLSearchParams
// (React Native's URL implementation is incomplete; see lib/apiOrigin.ts).

/** The custom scheme registered in landly-mobile/app.json. */
export const APP_SCHEME = 'landly'

const WITH_SCHEME = /^([a-z][a-z0-9+.-]*):\/\/(.*)$/i

const ROUTES: readonly [RegExp, (id: string) => string][] = [
  [/^\/offers?\/([^/]+)\/?$/, (id) => `/offer/${id}`],
  [/^\/(?:member\/vouchers|vouchers?)\/([^/]+)\/?$/, (id) => `/voucher/${id}`],
]

// Same rule as lib/payments/paymentValidation.ts (server-only there).
function isDocumentId(value: string): boolean {
  return value.length > 0 && value.length <= 512 && !value.includes('/') && value !== '.' && value !== '..'
}

function decode(value: string): string | null {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

// The path part of a link: "landly://offers/x" and "landly:///offers/x" give
// "/offers/x" (the custom scheme has no host), "https://host/offers/x" drops
// the host, and a bare path stays as is. Other schemes (the Expo dev client's
// own links, for one) aren't ours: null.
function pathOf(link: string): string | null {
  const value = link.trim()
  const scheme = value.match(WITH_SCHEME)
  let path: string
  if (!scheme) path = value.startsWith('/') ? value : `/${value}`
  else if (/^https?$/i.test(scheme[1]!)) path = scheme[2]!.replace(/^[^/?#]*/, '') || '/'
  else if (scheme[1]!.toLowerCase() === APP_SCHEME) path = `/${scheme[2]!.replace(/^\/+/, '')}`
  else return null
  return path.replace(/[?#].*$/, '')
}

/**
 * The app route for an offer or voucher link -- "/offer/{id}" or
 * "/voucher/{id}" -- or null when the link isn't one of those.
 */
export function appPathForLink(link: string): string | null {
  const path = pathOf(link)
  if (!path) return null
  for (const [pattern, toRoute] of ROUTES) {
    const raw = path.match(pattern)?.[1]
    if (raw === undefined) continue
    const id = decode(raw)
    return id && isDocumentId(id) ? toRoute(encodeURIComponent(id)) : null
  }
  return null
}

/** The landly:// link that opens a website page's screen in the app, or null. */
export function appUrlForLink(link: string): string | null {
  const path = appPathForLink(link)
  return path ? `${APP_SCHEME}:/${path}` : null
}
