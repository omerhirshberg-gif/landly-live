// The admin portal's route tree: every page's title and the page it belongs
// under. The breadcrumbs (desktop header), the mobile title, each page's
// "Back" link and where a form goes after saving are all read from here, so
// they always agree -- e.g. editing an offer goes back to Offers, never to a
// page the breadcrumbs don't show.
//
// One piece of context comes from the URL rather than the tree: an offer
// opened from its business's page (`?from=business&businessUid=…`), or added
// from it (`/admin/offers/new?businessUid=…`), sits under that business
// instead: Dashboard › Businesses › {name} › Edit offer. A page that has
// loaded its data confirms (or drops) that context and names its dynamic
// crumbs (a business's name) through AdminCrumbContext. Pure, for the unit
// tests and the server-rendered tab titles alike.

export interface AdminRoute {
  /** `[param]` segments match any one path segment. */
  pattern: string
  title: string
  /** The route this one sits under; null for the dashboard (and the login page, which has no shell). */
  parent: string | null
  /** Also matches everything below it (the support inbox's chat paths). */
  prefix?: boolean
}

export const ADMIN_ROUTES: readonly AdminRoute[] = [
  { pattern: '/admin', title: 'Dashboard', parent: null },
  { pattern: '/admin/login', title: 'Login', parent: null },
  { pattern: '/admin/support', title: 'WhatsApp Support', parent: '/admin', prefix: true },
  { pattern: '/admin/users', title: 'Users', parent: '/admin' },
  { pattern: '/admin/search', title: 'Search', parent: '/admin' },
  { pattern: '/admin/businesses', title: 'Businesses', parent: '/admin' },
  { pattern: '/admin/businesses/new', title: 'Add Business', parent: '/admin/businesses' },
  { pattern: '/admin/businesses/[uid]', title: 'Business Details', parent: '/admin/businesses' },
  { pattern: '/admin/offers', title: 'Offers', parent: '/admin' },
  { pattern: '/admin/offers/new', title: 'Add Offer', parent: '/admin/offers' },
  { pattern: '/admin/offers/[offerId]/edit', title: 'Edit Offer', parent: '/admin/offers' },
  { pattern: '/admin/orphans', title: 'Orphans', parent: '/admin' },
  // "System" only groups pages: it has none of its own, so it's never a crumb.
  { pattern: '/admin/system/costs', title: 'Usage & Costs', parent: '/admin' },
]

const segments = (path: string) => path.split('/').filter(Boolean)

/** The route a pathname is on, or null outside the tree. Static segments win over `[param]` ones. */
export function matchAdminRoute(pathname: string): AdminRoute | null {
  const path = segments(pathname.split(/[?#]/)[0]!)
  let best: { route: AdminRoute; score: number } | null = null
  for (const route of ADMIN_ROUTES) {
    const pattern = segments(route.pattern)
    if (path.length < pattern.length || (path.length > pattern.length && !route.prefix)) continue
    let score = 0
    const matches = pattern.every((part, i) => {
      if (part.startsWith('[')) return true
      score += 1
      return part === path[i]
    })
    if (!matches) continue
    // An exact-length match beats a prefix one; then the more static segments.
    const total = score + (path.length === pattern.length ? 100 : 0)
    if (!best || total > best.score) best = { route, score: total }
  }
  return best?.route ?? null
}

export interface Crumb {
  label: string
  href: string
}

export interface CrumbContext {
  /** Labels for dynamic crumbs, by href (a business's name for its page). */
  labels?: Record<string, string>
  /**
   * The business an offer page sits under. Undefined: taken from the URL
   * until the page has loaded; null: the page found none (or a mismatch), so
   * it's under Offers.
   */
  businessUid?: string | null
}

/** The business an offer page claims to sit under, from its URL alone. */
export function urlBusinessContext(pathname: string, search: URLSearchParams): string | null {
  const route = matchAdminRoute(pathname)
  const uid = search.get('businessUid')
  if (!uid) return null
  if (route?.pattern === '/admin/offers/new') return uid
  if (route?.pattern === '/admin/offers/[offerId]/edit' && search.get('from') === 'business') return uid
  return null
}

/** Dashboard › … › this page: every crumb with its href, the last one the current page. */
export function adminTrail(pathname: string, search: URLSearchParams = new URLSearchParams(), context: CrumbContext = {}): Crumb[] {
  const path = pathname.split(/[?#]/)[0]!.replace(/\/+$/, '') || '/admin'
  const route = matchAdminRoute(path)
  if (!route) return [{ label: 'Admin', href: path }]
  const labelOf = (href: string, title: string) => context.labels?.[href] ?? title

  const here: Crumb = { label: labelOf(path, route.title), href: path }
  const business = context.businessUid !== undefined ? context.businessUid : urlBusinessContext(path, search)
  const isOfferPage = route.pattern === '/admin/offers/new' || route.pattern === '/admin/offers/[offerId]/edit'
  if (isOfferPage && business) {
    const businessHref = `/admin/businesses/${business}`
    return [...adminTrail(businessHref, new URLSearchParams(), context), here]
  }

  const trail: Crumb[] = [here]
  let parent = route.parent
  while (parent) {
    const next = matchAdminRoute(parent)
    if (!next) break
    trail.unshift({ label: labelOf(parent, next.title), href: parent })
    parent = next.parent
  }
  return trail
}

/** Where "Back" (and a finished form) goes from here: the trail's second-to-last crumb. */
export function adminParent(pathname: string, search?: URLSearchParams, context?: CrumbContext): Crumb | null {
  const trail = adminTrail(pathname, search, context)
  return trail.length > 1 ? trail[trail.length - 2]! : null
}
