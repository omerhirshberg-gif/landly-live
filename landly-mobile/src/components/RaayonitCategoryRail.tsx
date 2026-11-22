import { memo } from 'react'
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native'
import type { OfferDocument } from '@shared/firebase/offers'
import ChainTile from './ChainTile'
import SectionHeader from './SectionHeader'
import { useLang } from '../i18n/LangProvider'
import { useLayout } from '../lib/useLayout'

// One category's row on the Raayonit hub (web: components/raayonit/RaayonitCategoryRail.tsx): the heading with a "Show all" action, then up to ten
// framed venue cards in a sideways row that reaches the screen's edges (the row cancels the screen's padding and puts it back inside, so the
// first card sits on the content's line). "Show all" opens the category's full list (RaayonitCategorySheet).
export default memo(function RaayonitCategoryRail({ title, offers, hasMore, onShowAll, divider = false }: { title: string; offers: OfferDocument[]; hasMore: boolean; onShowAll: () => void; /** A hairline above the row, separating it from the previous category. */ divider?: boolean }) {
  const { t } = useLang()
  const { width } = useWindowDimensions()
  const { paddingLeft, paddingRight } = useLayout()
  const cardWidth = Math.min(232, Math.max(150, (width - 36) / 2.15))
  return (
    <View style={styles.rail}>
      {divider && <View style={styles.divider} />}
      <SectionHeader title={title} action={hasMore ? t('filter_show_all') : undefined} onAction={hasMore ? onShowAll : undefined} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false} style={{ marginLeft: -paddingLeft, marginRight: -paddingRight }}
        contentContainerStyle={[styles.row, { paddingLeft, paddingRight }]}>
        {offers.map((o) => <View key={o.id} style={{ width: cardWidth }}><ChainTile offer={o} /></View>)}
      </ScrollView>
    </View>
  )
})

const styles = StyleSheet.create({
  rail: { marginTop: 20 },
  divider: { height: StyleSheet.hairlineWidth * 2, marginBottom: 20, backgroundColor: '#E2E8F0' },
  row: { gap: 10, paddingTop: 8, paddingBottom: 12 },
})
