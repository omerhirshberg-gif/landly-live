import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { Metadata } from 'next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Every route's browser-tab title, resolved the way Next.js does it: a
// layout's title.template applies to its *child* segments only (never the
// page beside it), a layout with a title but no template clears the template
// for everything below it, and title.absolute skips templates altogether. The client shells behind these files are stubbed --
// only their metadata is under test.

vi.mock('@/components/admin/AdminShell', () => ({ default: () => null }))
vi.mock('@/components/admin/AdminDashboard', () => ({ default: () => null }))
vi.mock('@/components/business/BusinessDashboardShell', () => ({ default: () => null }))
vi.mock('@/components/auth/entrance/AuthScreen', () => ({ default: () => null }))
// The root layout's providers import the client SDK, which would start Firebase on import.
vi.mock('@/lib/firebase/config', () => ({ auth: {}, db: {}, storage: {}, googleProvider: {} }))

const offerDoc = vi.fn()
vi.mock('@/lib/firebase/admin', () => ({
  getAdminDb: () => ({ collection: () => ({ doc: (id: string) => ({ get: () => offerDoc(id) }) }) }),
}))

const root = join(__dirname, '..', '..')
type Title = Metadata['title']

async function segmentTitle(file: string, params: Record<string, string>): Promise<Title | undefined> {
  if (!existsSync(join(root, file))) return undefined
  const mod = await import(/* @vite-ignore */ join(root, file))
  if (mod.generateMetadata) return (await mod.generateMetadata({ params: Promise.resolve(params) })).title
  return mod.metadata?.title
}

function applyTemplate(value: NonNullable<Title>, template: string | null): string {
  if (typeof value === 'string') return template ? template.replace('%s', value) : value
  if ('absolute' in value) return value.absolute
  return template ? template.replace('%s', value.default) : value.default
}

/** The tab title for a route such as '/admin/businesses/new'. */
async function tabTitle(route: string, params: Record<string, string> = {}): Promise<string> {
  const segments = route === '/' ? [] : route.slice(1).split('/')
  const dirs = ['app', ...segments.map((_, i) => `app/${segments.slice(0, i + 1).join('/')}`)]

  let template: string | null = null
  let pageTemplate: string | null = null
  let title = ''
  for (const dir of dirs) {
    // The page shares its folder with the deepest layout, so it only sees the templates above that layout.
    pageTemplate = template
    const value = await segmentTitle(`${dir}/layout.tsx`, params)
    if (value == null) continue
    title = applyTemplate(value, template)
    // A layout's own template, if any, is what its children see -- a layout
    // with a plain title clears the inherited one (verified against
    // `next build` output, where /admin/businesses/new lost its suffix).
    template = typeof value === 'object' && 'template' in value && value.template ? value.template : null
  }
  const pageValue = await segmentTitle(`${dirs.at(-1)}/page.tsx`, params)
  return pageValue == null ? title : applyTemplate(pageValue, pageTemplate)
}

beforeEach(() => {
  offerDoc.mockReset()
})

const EXPECTED: [string, string][] = [
  ['/', 'Landly — Aliyah Benefits & Perks for Olim and Lone Soldiers'],
  ['/categories', 'Perks & Discounts in Israel | Landly'],
  ['/categories/new', 'New Perks | Landly'],
  ['/categories/bestsellers', 'Bestsellers | Landly'],
  ['/member', 'My Pass | Landly'],
  ['/member/vouchers/[voucherId]', 'Voucher | Landly'],
  ['/wishlist', 'Wishlist | Landly'],
  ['/support', 'Support | Landly'],
  ['/olim', 'Making Aliyah: Benefits & Lone Soldier Perks | Landly'],
  ['/about', 'About Us | Landly'],
  ['/profile', 'Profile | Landly'],
  ['/settings', 'Settings | Landly'],
  ['/settings/privacy-security', 'Privacy & Security | Landly'],
  ['/settings/language-region', 'Language & Region | Landly'],
  ['/settings/language-region/origin', 'Country of Origin | Landly'],
  ['/settings/member-type', 'Customer Type | Landly'],
  ['/settings/delete-account', 'Delete Account | Landly'],
  ['/checkout', 'Checkout | Landly'],
  ['/checkout/success', 'Order Confirmed | Landly'],
  ['/order-success', 'Order Confirmed | Landly'],
  ['/login', 'Sign In | Landly'],
  ['/signup', 'Create Account | Landly'],
  ['/forgot-password', 'Forgot Password | Landly'],
  ['/reset-password', 'Reset Password | Landly'],
  ['/reset-password/success', 'Password Updated | Landly'],
  ['/verify-email', 'Verify Your Email | Landly'],
  ['/confirm-email-change', 'Confirm Your New Email | Landly'],
  ['/privacy', 'Privacy Policy | Landly'],
  ['/terms', 'Terms and Conditions | Landly'],
  ['/business', 'Business Portal | Landly Business'],
  ['/business/login', 'Sign In | Landly Business'],
  ['/business/dashboard', 'Business Dashboard | Landly Business'],
  ['/business/dashboard/offers', 'Offers | Landly Business'],
  ['/business/dashboard/vouchers', 'Vouchers | Landly Business'],
  ['/business/dashboard/history', 'Redemption History | Landly Business'],
  ['/business/dashboard/support', 'Support | Landly Business'],
  ['/admin', 'Dashboard | Landly Admin'],
  ['/admin/login', 'Admin Portal | Landly'],
  ['/admin/businesses', 'Businesses | Landly Admin'],
  ['/admin/businesses/new', 'Add New Business | Landly Admin'],
  ['/admin/businesses/[uid]', 'Business Details | Landly Admin'],
  ['/admin/offers', 'Offers | Landly Admin'],
  ['/admin/offers/new', 'New Offer | Landly Admin'],
  ['/admin/offers/[offerId]/edit', 'Edit Offer | Landly Admin'],
  ['/admin/orphans', 'Orphaned Accounts | Landly Admin'],
  ['/admin/search', 'Search | Landly Admin'],
]

describe('browser tab titles', () => {
  it.each(EXPECTED)('%s → %s', async (route, expected) => {
    expect(await tabTitle(route)).toBe(expected)
  })

  it('covers every page in app/ (except redirect-only routes)', () => {
    const pages: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(join(root, dir))) {
        const path = join(dir, name)
        if (statSync(join(root, path)).isDirectory()) walk(path)
        else if (name === 'page.tsx') pages.push('/' + relative('app', dir).replace(/\\/g, '/'))
      }
    }
    walk('app')
    const covered = new Set([...EXPECTED.map(([route]) => route), '/offers/[offerId]'])
    const redirectOnly = new Set(['/categories/[category]'])
    const uncovered = pages.map((p) => (p === '/' ? '/' : p.replace(/\/$/, ''))).filter((p) => !covered.has(p) && !redirectOnly.has(p))
    expect(uncovered).toEqual([])
  })

  describe('/offers/[offerId]', () => {
    it("uses the perk's own title", async () => {
      offerDoc.mockResolvedValue({ data: () => ({ title: ' 10% at Aroma ' }) })
      expect(await tabTitle('/offers/[offerId]', { offerId: 'abc' })).toBe('10% at Aroma | Landly')
      expect(offerDoc).toHaveBeenCalledWith('abc')
    })
    it('falls back when the offer is missing', async () => {
      offerDoc.mockResolvedValue({ data: () => undefined })
      expect(await tabTitle('/offers/[offerId]', { offerId: 'gone' })).toBe('Perk | Landly')
    })
    it('falls back when Firestore is unreachable', async () => {
      offerDoc.mockImplementation(async () => {
        throw new Error('no credentials')
      })
      expect(await tabTitle('/offers/[offerId]', { offerId: 'abc' })).toBe('Perk | Landly')
    })
  })
})
