import { useEffect, useRef } from 'react'
import { ScrollView, StyleSheet, View, type LayoutRectangle, type StyleProp, type ViewStyle } from 'react-native'
import { CATEGORY_TILES } from '@shared/categories'
import type { CategoryFilter } from '@shared/perks/perksFilter'
import AppText from './AppText'
import ScalePressable from './ScalePressable'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { chipShadow, colors, radius } from '../theme'

const OPTIONS: { key: CategoryFilter; emoji?: string }[] = [{ key: 'all' }, ...CATEGORY_TILES.map((tile) => ({ key: tile.category, emoji: tile.emoji }))]

// The Perks tab's category filter (web: components/perks/CategoryChipsRail.tsx):
// "All" plus every category as one horizontally scrolling row of
// single-choice chips — soft slate at rest, solid brand blue when selected,
// springing to 95% on press. Bleeds to the screen edges like Home's rail; in
// Hebrew it opens at the right edge, and the selected chip is kept in view.
export default function PerksCategoryChips({
  value,
  onChange,
  style,
}: {
  value: CategoryFilter
  onChange: (next: CategoryFilter) => void
  /** Overrides the edge bleed, e.g. start-only when a button sits at the row's end. */
  style?: StyleProp<ViewStyle>
}) {
  const { t, isRtl } = useLang()
  const scroller = useRef<ScrollView>(null)
  const layouts = useRef(new Map<CategoryFilter, LayoutRectangle>())
  const viewport = useRef({ width: 0, contentWidth: 0 })

  const label = (key: CategoryFilter) => {
    if (key === 'all') return t('cats_filter_all')
    const tile = CATEGORY_TILES.find((c) => c.category === key)
    return tile ? t(tile.labelKey) : key
  }

  // Centre the selected chip when it changes (e.g. arriving from Home's
  // rail with ?cat=…). Layout x is physical, so this holds in RTL too.
  const reveal = (animated: boolean) => {
    const chip = layouts.current.get(value)
    const { width, contentWidth } = viewport.current
    if (!chip || !width) return
    const x = Math.max(0, Math.min(chip.x - (width - chip.width) / 2, contentWidth - width))
    scroller.current?.scrollTo({ x, animated })
  }

  useEffect(() => {
    reveal(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <View style={[styles.frame, style]}>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="radiogroup"
        accessibilityLabel={t('cats_category_label')}
        contentContainerStyle={styles.row}
        style={styles.scroller}
        onLayout={(e) => {
          viewport.current.width = e.nativeEvent.layout.width
        }}
        // Rows lay out right-to-left in Hebrew, but a horizontal ScrollView
        // still opens at its left edge; jump to the reading-direction start
        // unless a chip further along is selected.
        onContentSizeChange={(contentWidth) => {
          viewport.current.contentWidth = contentWidth
          if (value !== 'all') reveal(false)
          else if (isRtl) scroller.current?.scrollToEnd({ animated: false })
        }}
      >
        {OPTIONS.map((option) => {
          const selected = option.key === value
          return (
            <ScalePressable
              key={option.key}
              pressedScale={0.95}
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              accessibilityLabel={label(option.key)}
              hitSlop={{ top: 5, bottom: 5 }}
              onPress={() => onChange(option.key)}
              onLayout={(e) => layouts.current.set(option.key, e.nativeEvent.layout)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              {option.emoji && (
                <AppText style={styles.emoji} accessibilityElementsHidden importantForAccessibility="no">
                  {option.emoji}
                </AppText>
              )}
              {/* No numberOfLines: inside the horizontal scroller the chip is
                  as wide as its text, and a one-line cap made Android clip
                  bold labels short ("Restaurants an"). */}
              <AppText style={[styles.label, selected && styles.labelSelected]}>
                {label(option.key)}
              </AppText>
            </ScalePressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { marginHorizontal: -16 },
  scroller: { flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 8 },
  // Sized to its text and never squeezed: 38pt tall + 5pt hit slop each side
  // = 48pt touch target (web: .filter-chip).
  chip: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.borderLight,
    ...webOnly({ cursor: 'pointer', userSelect: 'none', transitionProperty: 'background-color', transitionDuration: '150ms' }),
  },
  chipSelected: { backgroundColor: colors.brand, ...chipShadow },
  emoji: { flexShrink: 0, fontSize: 15, lineHeight: 20 },
  label: { flexShrink: 0, fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.text },
  labelSelected: { color: colors.white },
})
