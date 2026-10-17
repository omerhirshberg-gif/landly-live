import { useRef } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { CATEGORY_TILES } from '@shared/categories'
import AppText from './AppText'
import ScalePressable from './ScalePressable'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

const TILE_WIDTH = 76
const ICON_SIZE = 56

// Home's quick category scroller (web: components/perks/CategoryRail.tsx):
// round icon tiles with short labels, sized so four sit fully in view on a
// 393pt phone with the fifth peeking. Ends with "View all".
export default function CategoryRail({ onSelect, onViewAll }: { onSelect: (category: string) => void; onViewAll: () => void }) {
  const { t, isRtl } = useLang()
  const scroller = useRef<ScrollView>(null)
  return (
    <View style={styles.frame}>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        style={styles.scroller}
        // Rows lay out right-to-left in Hebrew, but a horizontal ScrollView
        // still opens at its left edge; jump to the reading-direction start.
        onContentSizeChange={() => {
          if (isRtl) scroller.current?.scrollToEnd({ animated: false })
        }}
      >
        {CATEGORY_TILES.map((tile) => (
          <ScalePressable
            key={tile.category}
            pressedScale={0.92}
            accessibilityRole="button"
            accessibilityLabel={t(tile.labelKey)}
            onPress={() => onSelect(tile.category)}
            style={styles.tile}
          >
            <View style={styles.icon}>
              <AppText style={styles.emoji}>{tile.emoji}</AppText>
            </View>
            <AppText style={styles.label} numberOfLines={2}>
              {t(tile.labelKey)}
            </AppText>
          </ScalePressable>
        ))}
        <ScalePressable pressedScale={0.92} accessibilityRole="link" onPress={onViewAll} style={styles.tile}>
          <View style={[styles.icon, styles.viewAllIcon]}>
            <Svg
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.white}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={isRtl ? styles.flip : undefined}
            >
              <Path d="M5 12h14M13 6l6 6-6 6" />
            </Svg>
          </View>
          <AppText style={[styles.label, styles.viewAllLabel]} numberOfLines={2}>
            {t('cats_view_all')}
          </AppText>
        </ScalePressable>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  // Bleeds to the screen edges so tiles scroll out from under the padding.
  frame: { marginHorizontal: -16 },
  scroller: { flexGrow: 0 },
  row: { paddingHorizontal: 16, gap: 12 },
  tile: { width: TILE_WIDTH, alignItems: 'center', gap: 8, ...webOnly({ cursor: 'pointer', userSelect: 'none' }) },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: radius.pill,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 26, lineHeight: 32, textAlign: 'center' },
  viewAllIcon: { backgroundColor: colors.brand },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.heading, textAlign: 'center' },
  viewAllLabel: { color: colors.brand },
  flip: { transform: [{ scaleX: -1 }] },
})
