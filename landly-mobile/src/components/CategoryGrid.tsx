import { StyleSheet, View } from 'react-native'
import type { CategoryTile } from '@shared/categories'
import AppText from './AppText'
import Emoji from './Emoji'
import ScalePressable from './ScalePressable'
import { useLang } from '../i18n/LangProvider'
import { categoryGlyph } from '../lib/categoryGlyphs'
import { useLayout } from '../lib/useLayout'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

const GAP = 12

// The category discovery grid, two cards per row on a phone, three on an
// unfolded foldable, four on a tablet (web: components/perks/CategoryGrid.tsx;
// src/lib/layout.ts), re-laid out as the phone folds. Rows follow the root view's direction,
// so the first card sits on the right in Hebrew. Each card is the category's
// glyph and name, with no perk count (a young catalogue's small numbers read
// as empty). Every card is 116pt tall (the web's height on a phone): the glyph
// at the top, the name held to the foot in a fixed two-line box.
export default function CategoryGrid({
  tiles,
  onSelect,
}: {
  tiles: readonly CategoryTile[]
  onSelect: (category: string) => void
}) {
  const { t } = useLang()
  const { categoryColumns: columns } = useLayout()
  const rows: CategoryTile[][] = []
  for (let i = 0; i < tiles.length; i += columns) rows.push(tiles.slice(i, i + columns))
  return (
    <View style={styles.grid}>
      {rows.map((row) => (
        <View key={row[0].category} style={styles.row}>
          {row.map((tile) => (
            <ScalePressable
              key={tile.category}
              accessibilityRole="button"
              accessibilityLabel={t(tile.labelKey)}
              onPress={() => onSelect(tile.category)}
              style={styles.card}
            >
              <Emoji glyph={categoryGlyph(tile.category)} size={32} />
              <View style={styles.titleBox}>
                <AppText style={styles.title} numberOfLines={2}>
                  {t(tile.labelKey)}
                </AppText>
              </View>
            </ScalePressable>
          ))}
          {/* A short last row keeps its cards the width of the rest. */}
          {Array.from({ length: columns - row.length }, (_, i) => (
            <View key={`spacer-${i}`} style={styles.spacer} />
          ))}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { gap: GAP },
  row: { flexDirection: 'row', gap: GAP },
  card: {
    flex: 1,
    minWidth: 0,
    height: 116,
    padding: 16,
    justifyContent: 'space-between',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.white,
    ...webOnly({ cursor: 'pointer', userSelect: 'none' }),
  },
  spacer: { flex: 1 },
  // Two lines reserved, the name sitting on the box's foot, so every card's label shares one baseline.
  titleBox: { height: 40, justifyContent: 'flex-end' },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: colors.textStrong },
})
