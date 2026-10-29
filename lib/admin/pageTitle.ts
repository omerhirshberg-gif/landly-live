import { matchAdminRoute } from './routes'

// "What page am I on", for the mobile header's title and anywhere else that
// needs a page's name without its data: read off the route tree
// (lib/admin/routes.ts), like the breadcrumbs, so the two never drift apart.
export function getAdminPageTitle(pathname: string): string {
  return matchAdminRoute(pathname)?.title ?? 'Admin'
}
