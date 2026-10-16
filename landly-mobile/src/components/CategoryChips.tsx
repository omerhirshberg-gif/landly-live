import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { CATEGORY_TILES } from '@shared/categories'
import AppText from './AppText'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

// The fade covers the row's own side padding, so at rest no chip sits under it.
const FADE_WIDTH = 16

// Horizontally scrolling category chips on a soft brand tint (web: .ds-chip),
// fading out at both screen edges. With `allLabel`, a leading "All" chip
// selects no category. The active chip is brand-filled.
export default function CategoryChips({
  active,
  onSelect,
  allLabel,
}: {
  active: string | null
  onSelect: (category: string | null) => void
  allLabel?: string
}) {
  const { t } = useLang()
  const chips = [
    ...(allLabel ? [{ key: null, label: allLabel }] : []),
    ...CATEGORY_TILES.map((tile) => ({ key: tile.category as string | null, label: `${tile.emoji}  ${t(tile.labelKey)}` })),
  ]
  return (
    <View style={styles.frame}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.scroller}>
        {chips.map((chip) => {
          const selected = chip.key === active
          return (
            <Pressable
              key={chip.key ?? 'all'}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onSelect(chip.key)}
              style={({ pressed }) => [styles.chip, selected ? styles.chipActive : pressed && styles.chipPressed]}
            >
              <AppText style={[styles.label, selected && styles.labelActive]} numberOfLines={1}>
                {chip.label}
              </AppText>
            </Pressable>
          )
        })}
      </ScrollView>
      <EdgeFade side="left" />
      <EdgeFade side="right" />
    </View>
  )
}

// The screen canvas fading in over the chips. Physical left/right: the fade
// is symmetric, so it reads the same in RTL. One gradient id per side; every
// instance draws the identical gradient, so a clash on web is harmless.
function EdgeFade({ side }: { side: 'left' | 'right' }) {
  const id = `landlyChipFade-${side}`
  return (
    <View pointerEvents="none" style={[styles.fade, side === 'left' ? styles.fadeLeft : styles.fadeRight]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.background} stopOpacity={side === 'left' ? 1 : 0} />
            <Stop offset="1" stopColor={colors.background} stopOpacity={side === 'left' ? 0 : 1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  // Bleeds to the screen edges so chips scroll out from under the padding.
  frame: { marginHorizontal: -16 },
  scroller: { flexGrow: 0 },
  row: { paddingHorizontal: 16, gap: 8 },
  chip: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.brandLight,
    justifyContent: 'center',
    ...webOnly({ cursor: 'pointer', userSelect: 'none' }),
  },
  chipActive: { backgroundColor: colors.brand },
  chipPressed: { backgroundColor: colors.brandTint },
  label: { fontSize: 14, fontWeight: '600', color: colors.heading },
  labelActive: { color: colors.white },
  fade: { position: 'absolute', top: 0, bottom: 0, width: FADE_WIDTH },
  fadeLeft: { left: 0 },
  fadeRight: { right: 0 },
})
