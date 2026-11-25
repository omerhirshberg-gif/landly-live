import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import AppText from './AppText'
import Corner from './Corner'
import { useLang } from '../i18n/LangProvider'
import { colors, radius } from '../theme'

// An empty perk slot on Home's category rows (web: components/discover/OfferCardPlaceholder.tsx): the
// OfferCard's frame (white, hairline border, 16pt corners, 16:9 picture) in neutral blocks with a
// muted "Coming soon". Not pressable: it has no offer to open. A published perk takes its place.
export default memo(function OfferCardPlaceholder({ width }: { width?: number }) {
  const { t } = useLang()
  return (
    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={[styles.card, width ? { width } : null]}>
      <View style={styles.media}>
        <Corner at="top-start" top={10} start={10}>
          <View style={styles.tag}>
            <AppText style={styles.tagText} numberOfLines={1}>{t('home_coming_soon')}</AppText>
          </View>
        </Corner>
      </View>
      <View style={styles.body}>
        <View style={[styles.line, { width: '50%', height: 12 }]} />
        <View style={[styles.line, { width: '92%', height: 13, marginTop: 10 }]} />
        <View style={[styles.line, { width: '60%', height: 13, marginTop: 6 }]} />
        <View style={styles.priceRow}>
          <View style={[styles.line, { width: 80, height: 20 }]} />
          <View style={[styles.line, { width: 48, height: 16, opacity: 0.6 }]} />
        </View>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  card: { flex: 1, backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  media: { aspectRatio: 16 / 9, backgroundColor: colors.borderLight },
  tag: { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: colors.border },
  tagText: { fontSize: 11, lineHeight: 16, fontWeight: '600', color: colors.textMuted },
  body: { flexGrow: 1, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 },
  line: { backgroundColor: colors.borderLight, borderRadius: 8 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
})
