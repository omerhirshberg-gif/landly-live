import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LANDING_COLUMN, LANDING_RAIL } from '@/components/landing/landingColumn'

const read = (path: string) => readFileSync(path, 'utf8')

describe('the landing column', () => {
  it('puts every section on one column, its rails bleeding through the same gutter', () => {
    expect(LANDING_COLUMN).toBe('mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-8')
    for (const gutter of ['-mx-4 px-4 scroll-ps-4 scroll-pe-4', 'sm:-mx-6 sm:px-6', 'lg:-mx-8 lg:px-8']) expect(LANDING_RAIL).toContain(gutter)
    for (const path of ['components/home/HomePage.tsx', 'components/home/CategoryPhotoRail.tsx', 'components/landing/LiveDeals.tsx', 'components/landing/AudienceCards.tsx', 'components/home/HowItWorks.tsx', 'components/home/Faq.tsx']) {
      expect(read(path), path).toContain('LANDING_COLUMN')
    }
  })
})

describe('Our perks', () => {
  const deals = read('components/landing/LiveDeals.tsx')

  it('is always a sideways rail, however few the deals, closed by the see-all tile', () => {
    expect(deals).not.toContain('DEALS_GRID_MAX')
    expect(deals).not.toContain('grid')
    expect(deals).toContain('flex flex-row gap-3')
    expect(deals).toContain('snap-x snap-mandatory')
    expect(deals).toContain('const slots = deals.length + 1')
    expect(deals).toContain('<SeeAllTile />')
  })
})

describe('the discount ribbon and the navigation tiles', () => {
  it('ties the discount to the photo’s top end corner in emerald-700, on the card and the offer page', () => {
    const badge = read('components/discover/DiscountBadge.tsx')
    expect(badge).toContain('absolute top-0 end-0 rounded-es-2xl [corner-shape:squircle] bg-emerald-700')
    expect(badge).toContain('<bdi aria-hidden="true" dir="ltr">')
    const page = read('app/offers/[offerId]/page.tsx')
    expect(page).toContain('<DiscountBadge percent={discount} className="fold:rounded-se-2xl" />')
    expect(page.indexOf('<DiscountBadge')).toBeLessThan(page.indexOf('</DealMedia>'))
    expect(read('components/discover/OfferCard.tsx')).toContain('<DiscountBadge percent={discount} />')
  })

  it('ends the offer header with the address, above the folds', () => {
    const page = read('app/offers/[offerId]/page.tsx')
    expect(page.indexOf('<NavigationLinks')).toBeGreaterThan(page.indexOf('offer_detail_remaining'))
    expect(page.indexOf('<NavigationLinks')).toBeLessThan(page.indexOf('The folds.'))
  })

  it('fills the Waze tile to its edges and keeps Google Maps on a white one', () => {
    const web = read('components/offers/NavigationLinks.tsx')
    expect(web).toContain('bg-[#33ccff]')
    expect(web).toContain('src="/icons/waze.webp" alt="" width={44} height={44} className="h-full w-full object-cover"')
    expect(web).toContain('border border-slate-200/90 bg-white')
    const native = read('landly-mobile/src/components/NavigationButtons.tsx')
    expect(native).toContain('resizeMode="cover"')
    expect(native).toContain("wazeClip: { width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden' }")
  })
})
