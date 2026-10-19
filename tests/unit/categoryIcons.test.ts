import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { CATEGORY_TILES } from '@/lib/categories'

const read = (path: string) => readFileSync(path, 'utf8')
// Pictographic emoji (not ✓-style text symbols or the ₪ sign).
const EMOJI = /\p{Extended_Pictographic}/u

describe('category vector icons', () => {
  it('gives every category a distinct Font Awesome icon, keeping the emoji for the app', () => {
    expect(CATEGORY_TILES.map((tile) => [tile.category, tile.icon])).toEqual([
      ['Restaurants and Cafes', 'fa-utensils'],
      ['Beach and Sea', 'fa-umbrella-beach'],
      ['Attractions and Tours', 'fa-map-location-dot'],
      ['Fashion and Shopping', 'fa-bag-shopping'],
      ['Sport and Fitness', 'fa-dumbbell'],
      ['Israel and Global Tourism', 'fa-plane'],
      ['Pampering Bundles', 'fa-champagne-glasses'],
      ['Beauty and Skincare', 'fa-spa'],
      ['Home and Furnishing', 'fa-couch'],
      ['Kids and Baby', 'fa-baby-carriage'],
      ['Insurance and Savings', 'fa-shield-heart'],
      ['Cars and Transport', 'fa-car-side'],
    ])
    expect(new Set(CATEGORY_TILES.map((tile) => tile.icon)).size).toBe(CATEGORY_TILES.length)
    for (const tile of CATEGORY_TILES) expect(tile.emoji).toMatch(EMOJI)
  })

  it('renders no raw emoji on the website surfaces that show categories', () => {
    for (const file of [
      'components/perks/CategoryGrid.tsx',
      'components/perks/CategoryChipsRail.tsx',
      'components/perks/CategoryRail.tsx',
      'components/discover/OfferTileRail.tsx',
      'components/discover/OfferListView.tsx',
      'components/home/PartnerMarquee.tsx',
      'components/home/SavingsShowcase.tsx',
      'components/home/PerkExampleCard.tsx',
      'app/categories/page.tsx',
      'app/categories/new/page.tsx',
      'app/categories/bestsellers/page.tsx',
      'app/olim/page.tsx',
    ]) {
      const source = read(file)
      expect(source, file).not.toMatch(EMOJI)
      expect(source, file).not.toMatch(/\btile\.emoji\b|option\.emoji/)
    }
    expect(read('app/offers/[offerId]/page.tsx')).not.toContain('tile.emoji')
  })

  it("puts /olim's newcomer categories on vector icons in brand-tint pills", () => {
    const olim = read('app/olim/page.tsx')
    for (const icon of ['fa-baby-carriage', 'fa-couch', 'fa-shield-heart', 'fa-stethoscope', 'fa-book-open', 'fa-car-side']) expect(olim).toContain(`icon: '${icon}'`)
    expect(olim).toContain('min-h-[44px] items-center gap-2.5 rounded-full border border-slate-200 bg-white')
    expect(olim).toContain('font-semibold tracking-tight')
  })

  it('heads the New and Bestsellers rails and lists with icons, not ✨ and 🔥', () => {
    const page = read('app/categories/page.tsx')
    expect(page).toContain('<OfferTileRail icon="fa-wand-magic-sparkles"')
    expect(page).toContain('<OfferTileRail icon="fa-fire"')
    expect(read('app/categories/new/page.tsx')).toContain('icon="fa-wand-magic-sparkles"')
    expect(read('app/categories/bestsellers/page.tsx')).toContain('<OfferListView icon="fa-fire"')
  })
})
