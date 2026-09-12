// Single source of truth for "what page am I on" -- used by both the
// desktop header bar (layout.tsx) and the mobile top bar (Sidebar.tsx) so
// the two never drift out of sync with each other or with the sidebar nav.
export function getAdminPageTitle(pathname: string): string {
  if (pathname === '/admin') return 'Dashboard'
  if (pathname === '/admin/search') return 'Search'
  if (pathname === '/admin/businesses/new') return 'Add Business'
  if (pathname === '/admin/businesses') return 'Businesses'
  if (pathname.startsWith('/admin/businesses/')) return 'Business Details'
  if (pathname === '/admin/offers/new') return 'Add Offer'
  if (pathname === '/admin/offers') return 'Offers'
  if (pathname.startsWith('/admin/offers/')) return 'Edit Offer'
  if (pathname === '/admin/orphans') return 'Orphans'
  if (pathname === '/admin/login') return 'Login'
  return 'Admin'
}
