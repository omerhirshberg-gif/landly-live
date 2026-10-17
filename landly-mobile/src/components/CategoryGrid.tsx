import { StyleSheet, View } from 'react-native'
import { perksCountLabel, type CategoryTile } from '@shared/categories'
import AppText from './AppText'
import ScalePressable from './ScalePressable'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

const GAP = 12

// The category discovery grid, two cards per row (web:
// components/perks/CategoryGrid.tsx). Rows follow the root view's direction,
// so the first card sits on the right in Hebrew. `counts` is null while
// offers load, which shows a placeholder bar in place of the perk count.
export default function CategoryGrid({
  tiles,
  counts,
  onSelect,
}: {
  tiles: readonly CategoryTile[]
  counts: Map<string, number> | null
  onSelect: (category: string) => void
}) {
  const { t } = useLang()
  const rows: CategoryTile[][] = []
  for (let i = 0; i < tiles.length; i += 2) rows.push(tiles.slice(i, i + 2))
  return (
    <View style={styles.grid}>
      {rows.map((row) => (
        <View key={row[0].category} style={styles.row}>
          {row.map((tile) => (
            <ScalePressable
              key={tile.category}
              accessibilityRole="button"
              accessibilityLabel={
                counts ? `${t(tile.labelKey)}, ${perksCountLabel(counts.get(tile.category) ?? 0, t)}` : t(tile.labelKey)
              }
              onPress={() => onSelect(tile.category)}
              style={styles.card}
            >
              <AppText style={styles.emoji} accessibilityElementsHidden importantForAccessibility="no">
                {tile.emoji}
              </AppText>
              <AppText style={styles.title} numberOfLines={2}>
                {t(tile.labelKey)}
              </AppText>
              {counts ? (
                <AppText style={styles.count} numberOfLines={1}>
                  {perksCountLabel(counts.get(tile.category) ?? 0, t)}
                </AppText>
              ) : (
                <View style={styles.countPlaceholder} />
              )}
            </ScalePressable>
          ))}
          {row.length === 1 && <View style={styles.spacer} />}
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
    padding: 16,
    gap: 6,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.white,
    ...webOnly({ cursor: 'pointer', userSelect: 'none' }),
  },
  spacer: { flex: 1 },
  emoji: { fontSize: 32, lineHeight: 40, marginBottom: 6 },
  // Two lines reserved so cards in a row line up whether a label wraps or not.
  title: { fontSize: 15, lineHeight: 20, minHeight: 40, fontWeight: '700', color: colors.textStrong },
  count: { fontSize: 12, lineHeight: 16, color: colors.textMuted },
  countPlaceholder: { height: 12, width: 80, marginTop: 2, borderRadius: radius.pill, backgroundColor: colors.borderLight },
})
