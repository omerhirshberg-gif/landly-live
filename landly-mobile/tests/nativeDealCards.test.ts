import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { BUSINESS_CATEGORIES } from '@/lib/categories'
import { REDEMPTION_METHOD_LABEL_KEYS } from '@/lib/offers/redemption'

// The app resolves @shared/* to ../lib (tsconfig paths, metro.config.js); the root vitest config doesn't.
vi.mock('@shared/offers/imageFit', () => import('@/lib/offers/imageFit'))

const { badgeLogoUri, businessInitial, dealImageRole, secureImageUrl } = await import('../src/lib/imageSource')
const { ALL_GLYPH, CATEGORY_GLYPHS, FALLBACK_GLYPH, PASS_GLYPHS, RAIL_GLYPHS, categoryGlyph } = await import('../src/lib/categoryGlyphs')

const SRC = 'landly-mobile/src'
const read = (path: string) => readFileSync(join(SRC, path), 'utf8')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : /\.tsx?$/.test(name) ? [path] : []
  })
}

/** One emoji, fully qualified: a code point that isn't emoji by default carries U+FE0F. */
function fullyQualified(glyph: string): boolean {
  if (!/^\p{RGI_Emoji}$/v.test(glyph)) return false
  const [first, second] = Array.from(glyph)
  return /\p{Emoji_Presentation}/u.test(first!) || second === '\u{FE0F}'
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

describe('native category emoji', () => {
  it('gives every category its own fully qualified emoji', () => {
    for (const category of BUSINESS_CATEGORIES) {
      const glyph = CATEGORY_GLYPHS[category]
      expect(fullyQualified(glyph), category).toBe(true)
      expect(categoryGlyph(category)).toBe(glyph)
    }
    expect(new Set(Object.values(CATEGORY_GLYPHS)).size).toBe(BUSINESS_CATEGORIES.length)
    expect(Object.keys(CATEGORY_GLYPHS).sort()).toEqual([...BUSINESS_CATEGORIES].sort())
  })

  it('covers "All", an unknown category, the Perks rails and My Pass, all fully qualified', () => {
    expect(categoryGlyph('Not a category')).toBe(FALLBACK_GLYPH)
    for (const glyph of [ALL_GLYPH, FALLBACK_GLYPH, ...Object.values(RAIL_GLYPHS), ...Object.values(PASS_GLYPHS)]) {
      expect(fullyQualified(glyph), glyph).toBe(true)
    }
    expect(RAIL_GLYPHS).toEqual({ new: '🆕', bestsellers: '🔥' })
    expect(PASS_GLYPHS).toEqual({
      activePerks: '🎟\u{FE0F}',
      redeemed: '🎁',
      saved: '💰',
      emptyActive: '🎁',
      emptyRedeemed: '🧾',
      validity: '📅',
      redeemedMark: '✅',
    })
  })

  it('shows the redemption method as text only, with no emoji, on every native screen', () => {
    for (const path of ['components/OfferCard.tsx', 'components/VoucherPass.tsx', 'components/RedeemedPass.tsx', 'app/offer/[offerId].tsx', 'app/voucher/[voucherId].tsx']) {
      const source = read(path)
      expect(source, path).toContain('REDEMPTION_METHOD_LABEL_KEYS')
      expect(source, path).not.toMatch(/redemptionGlyph|REDEMPTION_GLYPHS|REDEMPTION_METHOD_ICONS/)
    }
    expect(read('lib/categoryGlyphs.ts')).not.toContain('REDEMPTION')
  })

  it('draws the Perks rails’ headings and the My Pass stats, empty states and pass marks as emoji, not vectors', () => {
    expect(read('components/OfferTileRail.tsx')).not.toContain('LineIcon')
    const stats = read('components/DashboardStats.tsx')
    expect(stats).not.toContain('LineIcon')
    for (const key of ['activePerks', 'redeemed', 'saved']) expect(stats).toContain(`glyph={PASS_GLYPHS.${key}}`)
    const wallet = read('app/(tabs)/wallet.tsx')
    expect(wallet).not.toContain('LineIcon')
    expect(wallet).toContain('<EmptyState glyph={PASS_GLYPHS.emptyActive}')
    expect(wallet).toContain('<EmptyState glyph={PASS_GLYPHS.emptyRedeemed}')
    expect(read('components/VoucherPass.tsx')).toContain('<Emoji glyph={PASS_GLYPHS.validity} size={13} />')
    expect(read('components/RedeemedPass.tsx')).toContain('<Emoji glyph={PASS_GLYPHS.redeemedMark} size={14} />')
    // The pass card's chevron is a control, so it stays a line glyph.
    expect(read('components/VoucherPass.tsx')).toContain('<LineIcon name="chevronEnd"')
  })

  it('keeps every emoji in categoryGlyphs.ts, drawn through <Emoji>', () => {
    for (const file of walk(SRC)) {
      if (file.endsWith('categoryGlyphs.ts')) continue
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/\p{Extended_Pictographic}/u)
    }
    for (const path of ['components/CategoryGrid.tsx', 'components/CategoryRail.tsx', 'components/PerksCategoryChips.tsx', 'app/category/[category].tsx']) {
      const source = read(path)
      expect(source, path).toContain('<Emoji glyph=')
      expect(source, path).not.toMatch(/\btile\.emoji\b|option\.emoji/)
    }
  })

  it('sizes an emoji in the same box on iOS and Android', () => {
    const emoji = read('components/Emoji.tsx')
    expect(emoji).toContain('const box = Math.round(size * 1.25)')
    expect(emoji).toContain("android: { includeFontPadding: false, textAlignVertical: 'center' as const }")
    expect(emoji).toContain('maxFontSizeMultiplier={1.3}')
  })
})

describe('native perk card layout', () => {
  it('places everything by start/end, so Hebrew mirrors it', () => {
    for (const path of ['components/DealMedia.tsx', 'components/MerchantBadge.tsx', 'components/Emoji.tsx', 'components/OfferCard.tsx']) {
      expect(read(path), path).not.toMatch(/\b(left|right|marginLeft|marginRight|paddingLeft|paddingRight|borderTopLeftRadius|borderTopRightRadius)\s*:/)
    }
  })

  it('keeps the category pill’s emoji and label as separate views', () => {
    const card = read('components/OfferCard.tsx')
    expect(card).toMatch(/<Emoji glyph=\{categoryGlyph\(tile\.category\)\}[^>]*\/>\s*<AppText style=\{\[styles\.categoryText/)
    expect(card).not.toContain('`${tile.emoji}')
  })

  it('hangs the merchant badge over the hero’s foot and fades the photo in over 180ms', () => {
    const media = read('components/DealMedia.tsx')
    expect(read('lib/useDealImage.ts')).toContain('export const DEAL_FADE_MS = 180')
    expect(media).toContain('useDealImage(rawUri)')
    expect(media).toContain('{ start: inset, bottom: -badge / 2 }')
    expect(media).toContain('logoUri={badgeLogoUri(businessLogo, uri, role)}')
    expect(read('components/OfferCard.tsx')).toContain('{ marginStart: badge + 8 }')
  })

  it('shows the business logo large: 56pt on full cards, 48pt on the Home and Perks carousels', () => {
    expect(read('components/DealMedia.tsx')).toContain('export const DEAL_BADGE: Record<DealMediaSize, number> = { standard: 56, compact: 48 }')
    const badge = read('components/MerchantBadge.tsx')
    // A rounded white tile (12–16pt corners, a hairline edge), the logo fitted whole with 6–8pt around it.
    expect(badge).toContain('return Math.min(16, Math.max(12, Math.round(size * 0.25)))')
    expect(badge).toContain('return size >= 56 ? 8 : 6')
    expect(badge).toContain("borderColor: 'rgba(0, 0, 0, 0.06)'")
    expect(badge).toContain('resizeMode="contain"')
    expect(badge).toContain('resizeMethod="scale"')
    expect(badge).not.toContain('borderRadius: size / 2')
    expect(read('components/OfferCard.tsx')).toContain("logoUri={offer.businessLogoUrl ?? ''}")
    // Home's carousel is the compact card, and the Perks rails draw through it.
    expect(read('components/OfferCarousel.tsx')).toContain('variant="carousel"')
    expect(read('components/OfferTileRail.tsx')).toContain('<OfferCarousel offers={offers} onOpen={onOpen} />')
  })
})

describe('the perk page’s logo badge', () => {
  const page = () => read('app/offer/[offerId].tsx')

  it('picks the badge’s logo as the cards do, from the same image hook', () => {
    const offer = page()
    expect(offer).toContain("const image = useDealImage(offer?.imageUrl ?? '')")
    expect(offer).toContain("logoUri={badgeLogoUri(secureImageUrl(offer.businessLogoUrl ?? ''), image.uri, image.role)}")
    expect(offer).toContain('initial={businessInitial(businessName.text)}')
    // A logo in the offer's image goes to the circle, never shown twice: the picture draws only a photo.
    expect(offer).toContain("(image.role === 'pending' || image.role === 'photo') && (")
    expect(offer).not.toContain('<PerkImage')
  })

  it('hangs a 64pt badge half over the picture’s foot by its start edge, so Hebrew mirrors it', () => {
    const offer = page()
    expect(offer).toContain('const DETAIL_BADGE = 64')
    expect(offer).toContain("badge: { position: 'absolute', start: DETAIL_BADGE_INSET, bottom: -DETAIL_BADGE / 2 }")
    // Outside the clipped frame, so its hanging half is drawn.
    expect(offer.indexOf('<MerchantBadge')).toBeGreaterThan(offer.indexOf('<GlassHeartButton'))
    expect(offer).toContain("heroWrap: { marginHorizontal: HERO_INSET, marginTop: HERO_INSET, zIndex: 1 }")
    expect(offer).not.toMatch(/\b(left|right|marginLeft|marginRight|borderTopLeftRadius|borderTopRightRadius)\s*:/)
  })

  it('keeps the chips one inline row clear of the badge in one column, and the badge inside the card in two panes', () => {
    const offer = page()
    expect(offer).toContain('<View style={[styles.chips, !panes && styles.chipsBesideBadge]}>')
    expect(offer).toContain("chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }")
    // Beside the badge, the category truncates; the method never drops under it.
    expect(offer).toContain("chipsBesideBadge: { flexWrap: 'nowrap', marginStart: HERO_INSET + DETAIL_BADGE_INSET + DETAIL_BADGE + 8 - BODY_PADDING }")
    expect(offer).toContain('categoryChip: { flexShrink: 1, minWidth: 0,')
    expect(offer).toContain('methodChip: { flexShrink: 0,')
    expect(offer).toContain('marginBottom: HERO_INSET + DETAIL_BADGE / 2')
  })

  it('draws both chips as compact, text-only pills of one shape', () => {
    const offer = page()
    expect(offer).toContain("chip: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }")
    expect(offer.match(/<View style=\{\[styles\.chip, styles\.(category|method)Chip\]\}>/g)).toHaveLength(2)
    expect(offer).not.toContain('<Emoji')
  })
})
