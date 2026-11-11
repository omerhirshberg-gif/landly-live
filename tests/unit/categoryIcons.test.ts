import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { CATEGORY_TILES } from '@/lib/categories'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import CategoryIcon, { CATEGORY_ICONS, Lipstick } from '@/components/ui/CategoryIcon'

const read = (path: string) => readFileSync(path, 'utf8')
// Pictographic emoji (not ✓-style text symbols or the ₪ sign).
const EMOJI = /\p{Extended_Pictographic}/u

describe('category vector icons', () => {
  it('gives every category a distinct Lucide glyph on the website', () => {
    expect(new Set(CATEGORY_TILES.map((tile) => CATEGORY_ICONS[tile.category])).size).toBe(CATEGORY_TILES.length)
    for (const tile of CATEGORY_TILES) {
      expect(tile).not.toHaveProperty('icon')
      expect(tile.emoji).toMatch(EMOJI)
    }
  })

  it('renders no raw emoji on the website surfaces that show categories', () => {
    for (const file of [
      'components/perks/CategoryGrid.tsx',
      'components/perks/CategoryChipsRail.tsx',
      'components/discover/OfferTileRail.tsx',
      'components/discover/OfferListView.tsx',
      'components/home/PerkExamples.tsx',
      'components/discover/PerkImage.tsx',
      'app/business/dashboard/support/page.tsx',
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

  it('leads Home and the perk card with the shared category icon, never an emoji', () => {
    expect(read('components/discover/OfferTags.tsx')).toContain('<CategoryIcon category={tile.category}')
    for (const file of ['components/discover/OfferCard.tsx', 'components/discover/OfferTags.tsx', 'components/home/CategoryPhotoRail.tsx', 'components/home/LoggedInHome.tsx']) expect(read(file)).not.toMatch(EMOJI)
  })

  it('draws the same glyph for every category on the website and in the app', () => {
    const web = read('components/ui/CategoryIcon.tsx')
    const app = read('landly-mobile/src/components/CategoryIcon.tsx')
    const map = (source: string) => [...source.matchAll(/^  '([A-Z][^']+)': (\w+),$/gm)].map((m) => `${m[1]}=${m[2]}`)
    expect(map(app)).toHaveLength(CATEGORY_TILES.length)
    expect(map(app)).toEqual(map(web))
  })

  it("puts /olim's newcomer categories on vector icons in brand-tint pills", () => {
    const olim = read('app/olim/page.tsx')
    for (const icon of ['Baby', 'Sofa', 'ShieldCheck', 'Stethoscope', 'BookOpen', 'CarFront']) expect(olim).toContain(`{ icon: ${icon}, labelKey:`)
    expect(olim).not.toContain('fa-solid')
    expect(olim).toContain('min-h-[44px] items-center gap-2.5 rounded-full border border-slate-200 bg-white')
    expect(olim).toContain('font-semibold tracking-tight')
  })

  it('heads the New and Bestsellers rails and lists with icons (Sparkles, Award), not ✨ and 🔥, on the web and in the app', () => {
    const page = read('app/categories/page.tsx')
    expect(page).toContain('<OfferTileRail icon={Sparkles}')
    expect(page).toContain('<OfferTileRail icon={Award}')
    expect(page).not.toContain('Flame')
    expect(read('app/categories/new/page.tsx')).toContain('icon={Sparkles}')
    expect(read('app/categories/bestsellers/page.tsx')).toContain('<OfferListView icon={Award}')
    const perks = read('landly-mobile/src/app/(tabs)/perks.tsx')
    // The app's rails take the same icons, named in landly-mobile/src/lib/categoryGlyphs.ts.
    expect(perks).toContain('<OfferTileRail glyph="new"')
    expect(perks).toContain('<OfferTileRail glyph="bestsellers"')
    expect(perks).not.toMatch(/[✨🔥🆕]/u)
    const glyphs = read('landly-mobile/src/lib/categoryGlyphs.ts')
    expect(glyphs).toContain("new: 'sparkles'")
    expect(glyphs).toContain("bestsellers: 'award'")
    expect(read('landly-mobile/src/components/OfferTileRail.tsx')).toContain('<LineIcon name={RAIL_ICONS[glyph]}')
    // The rails' heads are a bare 18px line icon (no badge); the list pages' head is dark ink in a neutral hairline frame. No Font Awesome.
    expect(read('components/discover/OfferTileRail.tsx')).toContain('<Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-ink" strokeWidth={1.5} />')
    expect(read('components/discover/OfferTileRail.tsx')).not.toContain('IconFrame')
    expect(read('components/discover/OfferListView.tsx')).toContain('<Icon aria-hidden="true" focusable="false" className="h-6 w-6 text-ink" strokeWidth={1.5} />')
    expect(read('components/discover/OfferListView.tsx')).not.toMatch(/IconFrame|brandTint|text-brand/)
    for (const file of ['components/discover/OfferTileRail.tsx', 'components/discover/OfferListView.tsx']) expect(read(file)).not.toContain('fa-solid')
  })

  it('draws Beauty and Skincare as a lipstick, a Lucide-style outline, not the Sparkles of "new"', () => {
    expect(CATEGORY_ICONS['Beauty and Skincare']).toBe(Lipstick)
    expect(Object.values(CATEGORY_ICONS).filter((icon) => icon === Lipstick)).toHaveLength(1)
    const html = renderToStaticMarkup(createElement(CategoryIcon, { category: 'Beauty and Skincare' }))
    // Lucide's own outline attributes, at the shared fine stroke, in currentColor, upright in Hebrew too.
    expect(html).toMatch(/^<svg [^>]*viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-lipstick h-5 w-5" aria-hidden="true"/)
    expect(html).not.toContain('rtl:')
    expect(html.match(/<path /g)).toHaveLength(3)
    expect(CATEGORY_TILES.find((tile) => tile.category === 'Beauty and Skincare')?.emoji).toBe('💄')
  })
})
