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
// next/font only runs under Next's compiler; the root layout's fonts become stubs.
vi.mock('next/font/google', () => ({
  Manrope: () => ({ className: '', variable: 'font-display', style: { fontFamily: 'Manrope' } }),
  Inter: () => ({ className: '', variable: 'font-sans', style: { fontFamily: 'Inter' } }),
}))
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
  ['/', 'GoLandly — Aliyah Benefits & Perks for Olim and Lone Soldiers'],
  ['/categories', 'Perks & Discounts in Israel | GoLandly'],
  ['/categories/new', 'New Perks | GoLandly'],
  ['/categories/bestsellers', 'Bestsellers | GoLandly'],
  ['/member', 'My Pass | GoLandly'],
  ['/member/vouchers/[voucherId]', 'Voucher | GoLandly'],
  ['/wishlist', 'Wishlist | GoLandly'],
  ['/support', 'Support | GoLandly'],
  ['/about', 'About Us | GoLandly'],
  ['/profile', 'Profile | GoLandly'],
  ['/settings', 'Settings | GoLandly'],
  ['/settings/privacy-security', 'Privacy & Security | GoLandly'],
  ['/settings/language-region', 'Language & Region | GoLandly'],
  ['/settings/language-region/origin', 'Country of Origin | GoLandly'],
  ['/settings/member-type', 'Customer Type | GoLandly'],
  ['/settings/delete-account', 'Delete Account | GoLandly'],
  ['/checkout', 'Checkout | GoLandly'],
  ['/checkout/success', 'Order Confirmed | GoLandly'],
  ['/order-success', 'Order Confirmed | GoLandly'],
  ['/login', 'Sign In | GoLandly'],
  ['/signup', 'Create Account | GoLandly'],
  ['/forgot-password', 'Forgot Password | GoLandly'],
  ['/reset-password', 'Reset Password | GoLandly'],
  ['/reset-password/success', 'Password Updated | GoLandly'],
  ['/verify-email', 'Verify Your Email | GoLandly'],
  ['/privacy', 'Privacy Policy | GoLandly'],
  ['/terms', 'Terms and Conditions | GoLandly'],
  ['/business', 'Business Portal | GoLandly Business'],
  ['/business/login', 'Sign In | GoLandly Business'],
  ['/business/dashboard', 'Business Dashboard | GoLandly Business'],
  ['/business/dashboard/offers', 'Offers | GoLandly Business'],
  ['/business/dashboard/vouchers', 'Vouchers | GoLandly Business'],
  ['/business/dashboard/history', 'Redemption History | GoLandly Business'],
  ['/business/dashboard/support', 'Support | GoLandly Business'],
  ['/admin', 'Dashboard | GoLandly Admin'],
  ['/admin/login', 'Admin Portal | GoLandly'],
  ['/admin/businesses', 'Businesses | GoLandly Admin'],
  ['/admin/businesses/new', 'Add New Business | GoLandly Admin'],
  ['/admin/businesses/[uid]', 'Business Details | GoLandly Admin'],
  ['/admin/offers', 'Offers | GoLandly Admin'],
  ['/admin/offers/new', 'New Offer | GoLandly Admin'],
  ['/admin/offers/[offerId]/edit', 'Edit Offer | GoLandly Admin'],
  ['/admin/orphans', 'Orphaned Accounts | GoLandly Admin'],
  ['/admin/users', 'Users | GoLandly Admin'],
  ['/admin/users/[uid]', 'Users | GoLandly Admin'],
  ['/admin/inventory', 'Inventory | GoLandly Admin'],
  ['/admin/merchants', 'Merchant Invites | GoLandly Admin'],
  ['/admin/merchants/invite', 'Merchant Invites | GoLandly Admin'],
  ['/admin/merchants/batch', 'Merchant Invites | GoLandly Admin'],
  ['/admin/payouts', 'Payouts | GoLandly Admin'],
  ['/admin/payouts/[batchId]', 'Payouts | GoLandly Admin'],
  ['/business/onboard/[token]', 'Merchant onboarding | GoLandly Business'],
  ['/admin/prelaunch', 'Pre-Launch Leads | GoLandly Admin'],
  ['/admin/system/costs', 'Usage & Costs | GoLandly Admin'],
  ['/admin/search', 'Search | GoLandly Admin'],
  ['/admin/support', 'Support Inbox | GoLandly Admin'],
  ['/join', 'GoLandly | Local deals for people new to Israel'],
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
    const covered = new Set([...EXPECTED.map(([route]) => route), '/offers/[offerId]', '/join/[lang]'])
    const redirectOnly = new Set(['/categories/[category]'])
    const uncovered = pages.map((p) => (p === '/' ? '/' : p.replace(/\/$/, ''))).filter((p) => !covered.has(p) && !redirectOnly.has(p))
    expect(uncovered).toEqual([])
  })

  describe('/offers/[offerId]', () => {
    it("uses the perk's own title", async () => {
      offerDoc.mockResolvedValue({ data: () => ({ title: ' 10% at Aroma ' }) })
      expect(await tabTitle('/offers/[offerId]', { offerId: 'abc' })).toBe('10% at Aroma | GoLandly')
      expect(offerDoc).toHaveBeenCalledWith('abc')
    })
    it('falls back when the offer is missing', async () => {
      offerDoc.mockResolvedValue({ data: () => undefined })
      expect(await tabTitle('/offers/[offerId]', { offerId: 'gone' })).toBe('Perk | GoLandly')
    })
    it('falls back when Firestore is unreachable', async () => {
      offerDoc.mockImplementation(async () => {
        throw new Error('no credentials')
      })
      expect(await tabTitle('/offers/[offerId]', { offerId: 'abc' })).toBe('Perk | GoLandly')
    })
  })
})
