import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getAdminPageTitle } from '@/lib/admin/pageTitle'
import { ADMIN_ROUTES, adminParent, adminTrail, matchAdminRoute, urlBusinessContext } from '@/lib/admin/routes'

// The admin's one route tree (lib/admin/routes.ts): every page sits under
// the dashboard, and the breadcrumbs, the page's Back and where a saved form
// goes are the same trail, so they can't disagree.

const root = join(__dirname, '..', '..')
const read = (path: string) => readFileSync(join(root, path), 'utf8')
function pages(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(join(root, path)).isDirectory()) return pages(path)
    return name === 'page.tsx' ? [`/${relative('app', path).replace(/\/?page\.tsx$/, '')}`] : []
  })
}
const labels = (pathname: string, ...rest: Parameters<typeof adminTrail> extends [string, ...infer R] ? R : never) =>
  adminTrail(pathname, ...rest).map((crumb) => crumb.label)

describe('the admin route tree', () => {
  it('has a route for every admin page, and a page for every route', () => {
    const files = pages('app/admin')
    expect(ADMIN_ROUTES.map((route) => route.pattern).sort()).toEqual([...files].sort())
  })

  it('roots every page but the login at the dashboard', () => {
    for (const route of ADMIN_ROUTES) {
      if (route.pattern === '/admin/login') continue
      const trail = adminTrail(route.pattern.replace(/\[[^\]]+\]/g, 'x'))
      expect(trail[0], route.pattern).toEqual({ label: 'Dashboard', href: '/admin' })
    }
  })

  it('prefers a static segment over a parameter', () => {
    expect(matchAdminRoute('/admin/businesses/new')?.title).toBe('Add Business')
    expect(matchAdminRoute('/admin/businesses/abc123')?.title).toBe('Business Details')
    expect(matchAdminRoute('/admin/support/anything')?.title).toBe('WhatsApp Support')
    expect(matchAdminRoute('/admin/nope')).toBeNull()
    expect(getAdminPageTitle('/admin/nope')).toBe('Admin')
  })
})

describe('breadcrumbs and back', () => {
  it('puts an offer opened from Offers under Offers (never "Back to businesses")', () => {
    expect(labels('/admin/offers/o1/edit')).toEqual(['Dashboard', 'Offers', 'Edit Offer'])
    expect(adminParent('/admin/offers/o1/edit')).toEqual({ label: 'Offers', href: '/admin/offers' })
  })

  it('puts an offer opened from its business under that business, named once loaded', () => {
    const search = new URLSearchParams('from=business&businessUid=b1')
    expect(adminParent('/admin/offers/o1/edit', search)?.href).toBe('/admin/businesses/b1')
    const named = { businessUid: 'b1', labels: { '/admin/businesses/b1': 'Pizza Hut' } }
    expect(labels('/admin/offers/o1/edit', undefined, named)).toEqual(['Dashboard', 'Businesses', 'Pizza Hut', 'Edit Offer'])
    // The page found the offer belongs elsewhere: back under Offers.
    expect(adminParent('/admin/offers/o1/edit', search, { businessUid: null })?.href).toBe('/admin/offers')
  })

  it('takes the business from the URL only where it means something', () => {
    expect(urlBusinessContext('/admin/offers/new', new URLSearchParams('businessUid=b1'))).toBe('b1')
    expect(urlBusinessContext('/admin/offers/o1/edit', new URLSearchParams('businessUid=b1'))).toBeNull()
    expect(urlBusinessContext('/admin/orphans', new URLSearchParams('businessUid=b1'))).toBeNull()
  })

  it('names a business page by its business, and steps back to the list', () => {
    expect(labels('/admin/businesses/b1', undefined, { labels: { '/admin/businesses/b1': 'Pizza Hut' } })).toEqual(['Dashboard', 'Businesses', 'Pizza Hut'])
    expect(adminParent('/admin/businesses/b1')?.href).toBe('/admin/businesses')
    expect(adminParent('/admin')).toBeNull()
    // "System" has no page of its own, so it's never a crumb.
    expect(labels('/admin/system/costs')).toEqual(['Dashboard', 'Usage & Costs'])
    expect(labels('/admin/users')).toEqual(['Dashboard', 'Users'])
  })

  it('reads the breadcrumbs, the header title and every Back from the same trail', () => {
    expect(read('components/admin/Breadcrumbs.tsx')).toContain('const crumbs = useAdminTrail()')
    expect(read('components/admin/AdminHeader.tsx')).toContain('{trail[trail.length - 1]!.label}')
    expect(read('components/admin/BackLink.tsx')).toContain('const parent = useAdminParent()')
    for (const page of pages('app/admin').map((route) => `app${route}/page.tsx`)) {
      expect(read(page), page).not.toMatch(/<BackLink href=/)
    }
  })

  it('saves an edited offer back to where it was opened from', () => {
    const edit = read('app/admin/offers/[offerId]/edit/page.tsx')
    expect(edit).toContain('router.push(backHref)')
    expect(edit).not.toContain('router.push(`/admin/businesses/${offer!.businessId}`)')
    // Edits from the business page carry it along.
    expect(read('app/admin/businesses/[uid]/page.tsx')).toContain('`/admin/offers/${offer.id}/edit?from=business&businessUid=${uid}`')
  })
})

describe('tabbed forms', () => {
  it('splits the long forms into tabs that still submit and validate as one form', () => {
    for (const page of ['app/admin/businesses/new/page.tsx', 'app/admin/offers/new/page.tsx', 'app/admin/offers/[offerId]/edit/page.tsx']) {
      const source = read(page)
      expect(source, page).toContain('{...tabs.formProps}')
      expect(source, page).toContain('<FormTabs state={tabs}')
      expect(source, page).toContain('<StickyActionBar')
    }
    const tabs = read('components/admin/FormTabs.tsx')
    // Hidden panels stay mounted; an invalid field opens its own tab.
    expect(tabs).toContain("className={selected ? 'space-y-6' : 'hidden'}")
    expect(tabs).toContain("field.closest<HTMLElement>('[data-form-tab]')?.dataset.formTab")
    expect(tabs).toContain('field.reportValidity?.()')
  })

  it('keeps the Save bar on screen at every size', () => {
    const bar = read('components/admin/FormSection.tsx')
    expect(bar).toContain('sticky bottom-0 z-20')
    expect(bar).not.toContain('md:static')
  })
})
