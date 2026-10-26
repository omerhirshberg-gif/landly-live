import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { FOLD_MIN_WIDTH, MODAL_MAX_WIDTH } from '@/lib/layout/foldable'
import {
  CONTENT_MAX_WIDTH,
  categoryColumns,
  feedColumns,
  formFactor,
  gridCellWidth,
  screenGutter,
  sheetMaxWidth,
  sidePadding,
  usesPanes,
} from '../../landly-mobile/src/lib/layout'

const read = (path: string) => readFileSync(`landly-mobile/src/${path}`, 'utf8')
const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? sources(path) : /\.tsx?$/.test(name) ? [path] : []
  })

describe('native foldable layout math', () => {
  it.each([
    [344, 'cover', 12, 1, 2],
    [393, 'phone', 16, 1, 2],
    [599, 'phone', 16, 1, 2],
    [600, 'unfolded', 24, 2, 3],
    [707, 'unfolded', 24, 2, 3],
    [884, 'unfolded', 24, 2, 3],
    [1024, 'tablet', 24, 3, 4],
  ] as const)('a %ipt window is %s: %ipt gutters, %i feed and %i category columns', (width, factor, gutter, feed, categories) => {
    expect(formFactor(width)).toBe(factor)
    expect(screenGutter(factor)).toBe(gutter)
    expect(feedColumns(factor)).toBe(feed)
    expect(categoryColumns(factor)).toBe(categories)
  })

  it('uses the website’s thresholds, so the app and its browser switch layouts at the same width', () => {
    expect(formFactor(FOLD_MIN_WIDTH - 1)).toBe('phone')
    expect(formFactor(FOLD_MIN_WIDTH)).toBe('unfolded')
    expect(read('lib/layout.ts')).toContain("from '../../../lib/layout/foldable'")
  })

  it('sizes grid cells so cells and gaps never overrun the row', () => {
    const { left, right } = sidePadding(707, 24, 0, 0)
    const row = 707 - left - right
    expect(row).toBe(659)
    expect(gridCellWidth(row, 2)).toBe(323)
    expect(gridCellWidth(row, 1)).toBe(row)
    for (const columns of [2, 3, 4]) expect(gridCellWidth(1000, columns) * columns + 12 * (columns - 1)).toBeLessThanOrEqual(1000)
  })

  it('pads each side by its safe-area inset plus the gutter, so content keeps the gutter beyond a cutout', () => {
    expect(sidePadding(393, 16, 0, 0)).toEqual({ left: 16, right: 16 })
    // An unfolded Fold held landscape: the camera cutout at the left only.
    const cutout = sidePadding(884, 24, 32, 0)
    expect(cutout).toEqual({ left: 56, right: 24 })
    const row = 884 - cutout.left - cutout.right
    for (const columns of [2, 3]) expect(gridCellWidth(row, columns) * columns + 12 * (columns - 1)).toBeLessThanOrEqual(row)
  })

  it('caps the member column on a wide tablet and centres it inside the safe area', () => {
    const wide = sidePadding(1366, 24, 0, 0)
    expect(wide).toEqual({ left: 63, right: 63 })
    expect(1366 - wide.left - wide.right).toBe(CONTENT_MAX_WIDTH)
    const inset = sidePadding(1366, 24, 40, 0)
    expect(1366 - inset.left - inset.right).toBe(CONTENT_MAX_WIDTH)
    expect(inset.left - 40).toBe(inset.right)
  })

  it('bounds sheets and splits panes only from 600pt', () => {
    expect(sheetMaxWidth(599)).toBeUndefined()
    expect(sheetMaxWidth(600)).toBe(MODAL_MAX_WIDTH)
    expect(usesPanes('phone')).toBe(false)
    expect(usesPanes('unfolded')).toBe(true)
  })
})

describe('native screens follow the live window', () => {
  it('never reads a static window size', () => {
    for (const file of sources('landly-mobile/src')) expect(readFileSync(file, 'utf8'), file).not.toMatch(/Dimensions\.get\(/)
  })

  it.each(['app/(tabs)/perks.tsx', 'app/(tabs)/wishlist.tsx', 'app/category/[category].tsx', 'app/(tabs)/wallet.tsx'])(
    '%s remounts its feed when folding changes the column count',
    (path) => {
      const source = read(path)
      expect(source).toContain("key={'cols-' + columns}")
      expect(source).toContain('numColumns={columns}')
      expect(source).toContain('columnWrapperStyle={feedColumnWrapper(columns)}')
      expect(source).toContain('<FeedCell>')
    }
  )

  it('only gives a multi-column list a column wrapper, which React Native rejects on one column', () => {
    expect(read('components/FeedCell.tsx')).toContain('return columns > 1 ? styles.row : undefined')
  })

  it.each(['components/OfferCarousel.tsx', 'components/OfferTileRail.tsx', 'components/CategoryRail.tsx', 'components/PerksCategoryChips.tsx'])(
    '%s bleeds through each side’s live padding (inset plus gutter), not a fixed 16',
    (path) => {
      const source = read(path)
      expect(source).toMatch(/paddingLeft, paddingRight \} = useLayout\(\)/)
      expect(source).toContain('marginLeft: -paddingLeft, marginRight: -paddingRight')
      expect(source).toContain('paddingLeft, paddingRight }')
    }
  )

  it.each(['components/SortSheet.tsx', 'components/AreaPicker.tsx', 'components/AvatarPicker.tsx'])('%s rises in a scrim-dimmed slot when bounded', (path) => {
    const source = read(path)
    expect(source).toContain('<SheetSlot>')
    expect(source).toContain('<View style={[styles.sheet, bounds, ')
  })

  it('lays the offer out as two panes in the reading direction, kept clear of the fold', () => {
    const offer = read('app/offer/[offerId].tsx')
    expect(offer).toContain("cardPanes: { flexDirection: 'row'")
    expect(offer).not.toContain('row-reverse')
    expect(offer).toContain('marginEnd: PANE_GAP / 2')
  })
})

describe('native safe-area insets held landscape', () => {
  const screens = sources('landly-mobile/src/app')
  // Screens laid out by useLayout() pad by inset plus gutter themselves; every other screen takes the side insets from its SafeAreaView.
  const LAYOUT_SCREENS = ['(tabs)/index.tsx', '(tabs)/perks.tsx', '(tabs)/wishlist.tsx', '(tabs)/wallet.tsx', 'category/[category].tsx', 'offer/[offerId].tsx']

  it.each(screens.filter((file) => readFileSync(file, 'utf8').includes('<SafeAreaView')))('%s keeps content clear of a side cutout', (file) => {
    const source = readFileSync(file, 'utf8')
    if (LAYOUT_SCREENS.some((screen) => file.endsWith(screen))) {
      expect(source).toMatch(/\{ paddingLeft, paddingRight \}/)
    } else {
      expect(source).toMatch(/edges=\{\[[^\]]*'left', 'right'\]\}/)
    }
  })

  it('reads the insets in useLayout, so the side padding and grid cells follow a cutout', () => {
    const hook = read('lib/useLayout.ts')
    expect(hook).toContain('const { left: insetLeft, right: insetRight } = useSafeAreaInsets()')
    expect(hook).toContain('sidePadding(width, gutter, insetLeft, insetRight)')
  })

  it('steps the offer and category header bars, which sit outside their lists, in from a side cutout', () => {
    expect(read('app/offer/[offerId].tsx')).toContain('<View style={{ paddingLeft: insets.left, paddingRight: insets.right }}>')
    expect(read('app/category/[category].tsx')).toContain('{ paddingLeft: insets.left + 8, paddingRight: insets.right + 8 }')
  })
})

describe('native two-pane profile', () => {
  const profile = read('app/(tabs)/profile.tsx')

  it('puts identity (with the member type and Sign out) leading and the details trailing from 600pt', () => {
    expect(profile).toContain("panes: { flexDirection: 'row', alignItems: 'flex-start', gap: PANE_GAP }")
    expect(profile).toContain('leadingPane: { flex: 2, minWidth: 0 }')
    expect(profile).toContain('trailingPane: { flex: 3, minWidth: 0 }')
    expect(profile.indexOf('<SegmentBadge')).toBeLessThan(profile.indexOf('{panes && signOutButton}'))
    expect(profile.indexOf('{panes && signOutButton}')).toBeLessThan(profile.indexOf('<ProfileDetails'))
    expect(profile).toContain('{!panes && signOutButton}')
    expect(profile).not.toContain('row-reverse')
  })

  it('shares the member-type pill with My Pass', () => {
    expect(read('app/(tabs)/wallet.tsx')).toContain('<SegmentBadge customerType={profile?.customerType}')
  })
})

describe('native scroll indicators', () => {
  /** Every JSX opening tag of a scrolling list (generic ones like <FlatList<Voucher> and Reanimated's <Animated.FlatList> included), up to its closing ">". */
  const listTags = (source: string) => {
    const tags: string[] = []
    for (const match of source.matchAll(/<(?:Animated\.)?(ScrollView|FlatList|SectionList)(?:<[^>]+>)?(?=\s|>)/g)) {
      const before = source.slice(Math.max(0, match.index - 12), match.index)
      if (/\b(useRef|RefObject|typeof)$/.test(before)) continue
      let depth = 0
      let i = match.index + match[0].length
      for (; i < source.length; i++) {
        if (source[i] === '{') depth++
        else if (source[i] === '}') depth--
        else if (source[i] === '>' && depth === 0) break
      }
      tags.push(source.slice(match.index, i))
    }
    return tags
  }

  it('finds the lists it guards', () => {
    expect(listTags(read('app/(tabs)/wallet.tsx'))).toHaveLength(1)
    expect(listTags(read('components/CategoryRail.tsx'))).toHaveLength(1)
    expect(sources('landly-mobile/src').flatMap((file) => listTags(readFileSync(file, 'utf8'))).length).toBeGreaterThanOrEqual(28)
  })

  it.each(sources('landly-mobile/src').filter((file) => listTags(readFileSync(file, 'utf8')).length))('%s hides both scroll indicators on every list', (file) => {
    for (const tag of listTags(readFileSync(file, 'utf8'))) {
      expect(tag, tag.slice(0, 80)).toContain('showsVerticalScrollIndicator={false}')
      expect(tag, tag.slice(0, 80)).toContain('showsHorizontalScrollIndicator={false}')
    }
  })
})

describe('section header', () => {
  it('pins See all to the reading-direction end of the padded row', () => {
    const header = read('components/SectionHeader.tsx')
    expect(header).toContain("row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch', width: '100%', gap: 12, marginTop: 28, marginBottom: 12 }")
    expect(header).toContain('title: { flex: 1, minWidth: 0 }')
    expect(header).toContain("action: { flexShrink: 0, minHeight: 44, justifyContent: 'center',")
    expect(header).not.toContain('row-reverse')
    const web = readFileSync('components/home/CuratedOffers.tsx', 'utf8')
    expect(web).toContain('<div className="flex items-center justify-between gap-3 mb-4">')
    expect(web).toContain('className="min-w-0 text-xl font-bold text-ink"')
    expect(web).toContain('tap-target inline-flex shrink-0 items-center')
  })
})
