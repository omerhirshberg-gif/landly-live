import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { BUSINESS_CATEGORIES } from '@/lib/categories'
import { REDEMPTION_METHOD_LABEL_KEYS } from '@/lib/offers/redemption'

// The app resolves @shared/* to ../lib (tsconfig paths, metro.config.js); the root vitest config doesn't.
vi.mock('@shared/offers/dealImage', () => import('@/lib/offers/dealImage'))
vi.mock('@shared/categoryGlyphs', () => import('@/lib/categoryGlyphs'))

const { badgeLogoUri, businessInitial, dealImageRole, secureImageUrl } = await import('../src/lib/imageSource')
const { ALL_ICON, PASS_ICONS, RAIL_ICONS } = await import('../src/lib/categoryGlyphs')

const SRC = 'landly-mobile/src'
const read = (path: string) => readFileSync(join(SRC, path), 'utf8')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : /\.tsx?$/.test(name) ? [path] : []
  })
}

describe('the offer image link on a device', () => {
  it('upgrades plain http to https, which iOS loads without an ATS exception', () => {
    expect(secureImageUrl('http://cdn.example/pizza.jpg')).toBe('https://cdn.example/pizza.jpg')
    expect(secureImageUrl('HTTP://cdn.example/a.png')).toBe('https://cdn.example/a.png')
    expect(secureImageUrl('  https://cdn.example/a.png ')).toBe('https://cdn.example/a.png')
    expect(secureImageUrl('//cdn.example/a.png')).toBe('https://cdn.example/a.png')
  })

  it('drops what is not a web image, so the card falls back', () => {
    expect(secureImageUrl('')).toBe('')
    expect(secureImageUrl('   ')).toBe('')
    expect(secureImageUrl('file:///tmp/a.png')).toBe('')
    expect(secureImageUrl('data:image/png;base64,AAAA')).toBe('')
  })
})

describe('the perk card’s two pictures from one link', () => {
  it('puts a logo in the badge, known from its link at once', () => {
    expect(dealImageRole('https://cdn.example/pizza-hut-logo.png', null, false)).toBe('logo')
    expect(dealImageRole('https://cdn.example/mark.svg', null, false)).toBe('logo')
  })

  it('waits for a bitmap’s size before calling it a photo, then tells a square logo apart', () => {
    expect(dealImageRole('https://cdn.example/pizza.jpg', null, false)).toBe('pending')
    expect(dealImageRole('https://cdn.example/pizza.jpg', { width: 1600, height: 1000 }, false)).toBe('photo')
    expect(dealImageRole('https://cdn.example/mark.png', { width: 400, height: 400 }, false)).toBe('logo')
  })

  it('falls back to the category panel and the initial with no link or a failed one', () => {
    expect(dealImageRole('', null, false)).toBe('none')
    expect(dealImageRole('https://cdn.example/pizza.jpg', { width: 1600, height: 1000 }, true)).toBe('none')
  })

  it('puts the business’s own logo in the badge, never the same logo twice', () => {
    const logo = 'https://cdn.example/pizza-hut.png'
    expect(badgeLogoUri(logo, 'https://cdn.example/pizza.jpg', 'photo')).toBe(logo)
    expect(badgeLogoUri(logo, '', 'none')).toBe(logo)
    // The offer's image is a logo too: the badge keeps the business's, the hero shows the category panel.
    expect(badgeLogoUri(logo, 'https://cdn.example/old-logo.png', 'logo')).toBe(logo)
    // No business logo: one pasted as the offer's image, else the initial.
    expect(badgeLogoUri('', 'https://cdn.example/old-logo.png', 'logo')).toBe('https://cdn.example/old-logo.png')
    expect(badgeLogoUri('', 'https://cdn.example/pizza.jpg', 'photo')).toBeNull()
    expect(badgeLogoUri('', 'https://cdn.example/pizza.jpg', 'pending')).toBeNull()
  })

  it('takes the business’s initial in any script', () => {
    expect(businessInitial('pizza hut')).toBe('P')
    expect(businessInitial('  פיצה האט')).toBe('פ')
    expect(businessInitial('')).toBe('')
  })
})

describe('native vector icons', () => {
  it('gives every category its own lucide-react-native glyph', () => {
    const icons = read('components/CategoryIcon.tsx')
    expect(icons).toContain("from 'lucide-react-native/icons/compass'")
    const names = [...icons.matchAll(/^  '([A-Z][^']+)': (\w+),$/gm)]
    expect(names.map((m) => m[1]).sort()).toEqual([...BUSINESS_CATEGORIES].sort())
    expect(new Set(names.map((m) => m[2])).size).toBe(BUSINESS_CATEGORIES.length)
    expect(icons).toContain('CATEGORY_ICONS[category] ?? Tag')
    expect(icons).toContain('strokeWidth = 1.5')
  })

  it('names the Perks rails and My Pass icons in one place', () => {
    expect(ALL_ICON).toBe('sparkles')
    expect(RAIL_ICONS).toEqual({ new: 'sparkles', bestsellers: 'award' })
    expect(PASS_ICONS).toEqual({ activePerks: 'ticket', redeemed: 'gift', saved: 'piggyBank', emptyActive: 'gift', emptyRedeemed: 'receipt', validity: 'calendar', redeemedMark: 'circleCheck' })
    // One file per icon: the package's root would put the whole library in the bundle.
    expect(read('components/LineIcon.tsx')).toContain("from 'lucide-react-native/icons/globe'")
    for (const path of ['components/LineIcon.tsx', 'components/CategoryIcon.tsx']) expect(read(path), path).not.toContain("from 'lucide-react-native'")
  })

  it('shows the redemption method as text only, with no emoji, on every native screen', () => {
    for (const path of ['components/OfferTags.tsx', 'components/OfferCard.tsx', 'components/RedeemedPass.tsx', 'app/voucher/[voucherId].tsx']) {
      const source = read(path)
      expect(source, path).toContain('REDEMPTION_METHOD_LABEL_KEYS')
      expect(source, path).not.toMatch(/redemptionGlyph|REDEMPTION_GLYPHS|REDEMPTION_METHOD_ICONS/)
    }
    expect(read('lib/categoryGlyphs.ts')).not.toContain('REDEMPTION')
  })

  it('draws the Perks rails’ headings and the My Pass stats, empty states and pass marks as vectors', () => {
    expect(read('components/OfferTileRail.tsx')).toContain('<LineIcon name={RAIL_ICONS[glyph]}')
    // A bare 18pt glyph at 1.5 stroke: no badge frame (SectionHeader.tsx, OfferTileRail.tsx).
    expect(read('components/OfferTileRail.tsx')).toContain('size={18} color={colors.textStrong} strokeWidth={1.5}')
    expect(read('components/OfferTileRail.tsx')).not.toContain('iconFrame')
    const stats = read('components/DashboardStats.tsx')
    for (const key of ['activePerks', 'redeemed', 'saved']) expect(stats).toContain(`icon={PASS_ICONS.${key}}`)
    const wallet = read('app/(tabs)/wallet.tsx')
    expect(wallet).toContain('<EmptyState icon={PASS_ICONS.emptyActive}')
    expect(wallet).toContain('<EmptyState icon={PASS_ICONS.emptyRedeemed}')
    expect(read('components/VoucherPass.tsx')).toContain('<LineIcon name="clock"')
    expect(read('components/RedeemedPass.tsx')).toContain('<LineIcon name={PASS_ICONS.redeemedMark}')
    // The pass card's chevron stays a directional, mirrored line glyph.
    expect(read('components/VoucherPass.tsx')).toContain('<LineIcon name="chevronEnd"')
  })

  it('draws no emoji anywhere in the app', () => {
    for (const file of walk(SRC)) expect(readFileSync(file, 'utf8'), file).not.toMatch(/\p{Extended_Pictographic}/u)
    for (const path of ['components/CategoryGrid.tsx', 'components/PerksCategoryChips.tsx', 'app/category/[category].tsx']) {
      const source = read(path)
      expect(source, path).toMatch(/<(CategoryIcon category=|LineIcon name=)/)
      expect(source, path).not.toMatch(/\btile\.emoji\b|option\.emoji/)
    }
  })
})

describe('native perk card layout', () => {
  it('places everything by start/end, so Hebrew mirrors it', () => {
    for (const path of ['components/DealMedia.tsx', 'components/MerchantBadge.tsx', 'components/OfferCard.tsx']) {
      expect(read(path), path).not.toMatch(/\b(left|right|marginLeft|marginRight|paddingLeft|paddingRight|borderTopLeftRadius|borderTopRightRadius)\s*:/)
    }
  })

  it('keeps the tag line’s icon and label as separate views, under the photo on the card and the screen', () => {
    const tags = read('components/OfferTags.tsx')
    expect(tags).toMatch(/<CategoryIcon category=\{tile\.category\}[^>]*\/>\}\s*<AppText style=\{\[styles\.text, styles\.categoryText/)
    const card = read('components/OfferCard.tsx')
    // On the card the method (and category) is a small tag over the photo's top start corner, not a row under it.
    expect(card).not.toContain('<OfferTags')
    expect(card.indexOf('styles.method')).toBeLessThan(card.indexOf('</DealMedia>'))
    expect(card.indexOf('styles.method')).toBeGreaterThan(card.indexOf('<DealMedia'))
    expect(read('app/offer/[offerId].tsx')).toContain('<OfferTags category={offer.category} method={offer.redemptionMethod} />')
  })

  it('fades the photo in over 180ms, and floats the logo box on the hero’s corner, the title under it', () => {
    const media = read('components/DealMedia.tsx')
    const card = read('components/OfferCard.tsx')
    expect(read('lib/useDealImage.ts')).toContain('export const DEAL_FADE_MS = 180')
    expect(card).toContain('useDealImage(offer.imageUrl)')
    expect(media).not.toContain('<MerchantBadge')
    expect(card).toContain("logoUri={badgeLogoUri(secureImageUrl(offer.businessLogoUrl ?? ''), image.uri, image.role)}")
    expect(card.indexOf('<MerchantBadge')).toBeLessThan(card.indexOf('</DealMedia>'))
    expect(card.indexOf('<MerchantBadge')).toBeGreaterThan(card.indexOf('<DealMedia'))
    expect(card).toContain("logo: { position: 'absolute', bottom: -16, start: 12 }")
  })

  it('fits the business logo whole in a 40pt tall tile on every card', () => {
    expect(read('components/OfferCard.tsx')).toContain('const LOGO_HEIGHT = 40')
    const badge = read('components/MerchantBadge.tsx')
    // A rounded white tile (16pt corners, a hairline edge), the logo fitted whole, 10pt either side.
    expect(badge).toContain('const BADGE_RADIUS = 16')
    expect(badge).toContain('const BADGE_PADDING = 10')
    expect(badge).toContain('borderColor: colors.borderLight')
    expect(badge).toContain('resizeMode="contain"')
    expect(badge).toContain('resizeMethod="scale"')
    expect(badge).not.toContain('borderRadius: size / 2')
    // Home's carousel is the compact card, and the Perks rails draw through it.
    expect(read('components/OfferCarousel.tsx')).toContain('variant="carousel"')
    expect(read('components/OfferTileRail.tsx')).toContain('<OfferCarousel offers={offers} onOpen={onOpen} autoAdvance={autoAdvance} autoAdvanceOffsetMs={autoAdvanceOffsetMs} />')
  })
})

describe('the perk page’s logo badge', () => {
  const page = () => read('app/offer/[offerId].tsx')

  it('picks the badge’s logo as the cards do, from the same image hook', () => {
    const offer = page()
    expect(offer).toContain("const image = useDealImage(offer?.imageUrl ?? '')")
    expect(offer).toContain("logoUri={badgeLogoUri(secureImageUrl(offer.businessLogoUrl ?? ''), image.uri, image.role)}")
    expect(offer).toContain('initial={businessInitial(businessName.text)}')
    // One picture with the cards: DealMedia draws only a photo, a logo in the offer's image goes to the badge.
    expect(offer).toContain("<DealMedia image={image} category={offer.category} corners={panes ? 'all' : 'none'} containRatio={4 / 5} containMaxHeight={380}>")
    expect(offer).not.toContain('<PerkImage')
    expect(offer).not.toContain('resizeMode')
  })

  it('floats the logo on the sheet’s edge on a phone and on the picture in two panes, so Hebrew mirrors it', () => {
    const offer = page()
    expect(offer).toContain('height={panes ? 64 : 56}')
    expect(offer).toContain('large')
    expect(offer).toContain('{!panes && logo}')
    expect(offer).toContain('{panes && logo}')
    expect(offer).toMatch(/sheet: \{\s+zIndex: 2,\s+marginTop: -20/)
    expect(offer).toContain("<Accordion title={t('offer_how_title')} defaultOpen>")
    expect(offer).not.toMatch(/\b(left|right|marginLeft|marginRight|borderTopLeftRadius|borderTopRightRadius)\s*:/)
  })

  it('heads the screen once, shows the description only if it adds something, and keeps the price on one baseline', () => {
    const offer = page()
    expect(offer).toContain('<ScreenHeader fallback="/perks" />')
    expect(offer).toContain('distinctDescription(title.text, description.text)')
    expect(offer).toContain('{descriptionText}</ContentText>')
    expect(offer).toContain("priceRow: { flexDirection: 'row', alignItems: 'baseline'")
    expect(offer).toContain('backgroundColor: colors.discountBadge')
    expect(offer).toContain('`-${discount}%`')
  })

  it('keeps the expiry and what remains in one row, with the address the header’s last row', () => {
    const offer = page()
    expect(offer).toContain('<View style={styles.chips}>')
    expect(offer).toContain('methodChip: { flexShrink: 0,')
    expect(offer.indexOf('<NavigationButtons')).toBeGreaterThan(offer.indexOf('<View style={styles.chips}>'))
    expect(offer.indexOf('<NavigationButtons')).toBeLessThan(offer.indexOf('<View style={styles.folds}>'))
  })

  it('draws the pills compact and text only, in one shape', () => {
    const offer = page()
    expect(offer).toContain("chip: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }")
    expect(offer.match(/<View style=\{\[styles\.chip, /g)).toHaveLength(2)
    expect(offer).not.toContain('<Emoji')
  })
})
