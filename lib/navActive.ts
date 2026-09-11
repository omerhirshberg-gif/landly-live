// Hash-anchored links (e.g. "/#how") point at a section of the homepage, not
// a distinct route usePathname() can identify — whether one is "active" is
// instead decided by scroll position (see lib/useScrollSpy.ts) and passed in
// as activeAnchorId. "/" (Home) only counts as active once no anchor section
// is in view, so Home and e.g. "How It Works" are never highlighted at once.
export function isNavLinkActive(pathname: string, href: string, activeAnchorId: string | null): boolean {
  const hashIndex = href.indexOf('#')
  if (hashIndex !== -1) {
    return activeAnchorId === href.slice(hashIndex + 1)
  }
  if (href === '/') return pathname === '/' && activeAnchorId === null
  return pathname === href || pathname.startsWith(`${href}/`)
}
