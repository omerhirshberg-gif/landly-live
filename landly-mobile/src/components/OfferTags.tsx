import { StyleSheet, View } from 'react-native'
import { CATEGORY_TILES } from '@shared/categories'
import { REDEMPTION_METHOD_LABEL_KEYS, type RedemptionMethod } from '@shared/offers/redemption'
import AppText from './AppText'
import CategoryIcon from './CategoryIcon'
import { useLang } from '../i18n/LangProvider'
import { colors } from '../theme'

// What kind of perk this is and how it's redeemed, as one quiet line under the
// photo, on the card and the offer screen alike (web: components/discover/
// OfferTags.tsx). A long category gives way to the method. `showCategory` is off
// in a list already scoped to one category, where every card would repeat it.
export default function OfferTags({ category, method, showCategory = true }: { category: string; method: RedemptionMethod; showCategory?: boolean }) {
  const { t } = useLang()
  const tile = CATEGORY_TILES.find((c) => c.category === category)
  return (
    <View style={styles.row}>
      {showCategory && (
        <>
          <View style={styles.category}>
            {tile && <CategoryIcon category={tile.category} size={14} color={TEXT} />}
            <AppText style={[styles.text, styles.categoryText]} numberOfLines={1}>{tile ? t(tile.labelKey) : category}</AppText>
          </View>
          <AppText style={[styles.text, styles.dot]} accessibilityElementsHidden importantForAccessibility="no">·</AppText>
        </>
      )}
      <AppText style={styles.text} numberOfLines={1}>{t(REDEMPTION_METHOD_LABEL_KEYS[method])}</AppText>
    </View>
  )
}

// Web: text-slate-600.
const TEXT = colors.body

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  category: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0 },
  text: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: TEXT },
  categoryText: { flexShrink: 1 },
  dot: { color: colors.textFaint },
})
