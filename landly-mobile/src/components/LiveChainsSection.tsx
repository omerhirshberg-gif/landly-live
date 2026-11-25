import { memo } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import type { OfferDocument } from '@shared/firebase/offers'
import { liveChainCount } from '@shared/home/chainsPreview'
import { RAAYONIT_HUB } from '@shared/offers/offerRoutes'
import LiveChainTile from './LiveChainTile'
import LiveDot from './LiveDot'
import SectionHeader from './SectionHeader'
import { useLang } from '../i18n/LangProvider'
import { useLayout } from '../lib/useLayout'

// "Available now" with a live dot on Home and Explore Perks while GoLandly has no direct perks of its own (web:
// components/perks/LiveChainsSection.tsx): one section header with its "See all" action and a sideways row of the businesses that accept
// the Raayonit Card today. `chainCount` is the real number of chains: the header shows no number until it is known, and the section is
// absent without chains. The entry (Home's carousel, Explore's row) is its own row above; it only reads the tab's data.
export default memo(function LiveChainsSection({ offers, chainCount }: { offers: OfferDocument[]; chainCount: number }) {
  const { t } = useLang()
  const router = useRouter()
  const { paddingLeft, paddingRight } = useLayout()
  const count = liveChainCount(chainCount)
  if (count === null || offers.length === 0) return null
  return (
    <View>
      <SectionHeader leading={<LiveDot />} title={t('perks_available_now')} action={t('see_all')} onAction={() => router.push(RAAYONIT_HUB)} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false} style={{ marginLeft: -paddingLeft, marginRight: -paddingRight }} contentContainerStyle={[styles.row, { paddingLeft, paddingRight }]}>
        {offers.map((o) => <LiveChainTile key={o.id} offer={o} />)}
      </ScrollView>
    </View>
  )
})

const styles = StyleSheet.create({
  row: { gap: 10, paddingTop: 8, paddingBottom: 8 },
})
