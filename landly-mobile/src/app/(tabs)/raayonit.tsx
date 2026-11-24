import { ScrollView, StyleSheet } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { isFlagship, isRaayonitOffer } from '@shared/offers/discoverTab'
import { useOffers } from '@shared/offers/useOffers'
import { useMemo } from 'react'
import RaayonitHero from '../../components/RaayonitHero'
import ScreenTitleRow from '../../components/ScreenTitleRow'
import RaayonitTab from '../../components/RaayonitTab'
import { useLang } from '../../i18n/LangProvider'
import { useLayout } from '../../lib/useLayout'
import { colors, header } from '../../theme'

// The Raayonit Card tab (web: app/raayonit/page.tsx): the purchase block with its 1-tap Buy, then the search, all 18 Raayonit categories
// and the full grid of chains. `?category=` pre-selects a category. It is the one /raayonit route (a group adds nothing to the URL), so deep
// links and every `router.push('/raayonit')` land on the tab.
export { default as ErrorBoundary } from '../../components/RouteErrorBoundary'

export default function RaayonitTabScreen() {
  const { t } = useLang()
  const { paddingLeft, paddingRight } = useLayout()
  const { category, q } = useLocalSearchParams<{ category?: string; q?: string }>()
  const { offers } = useOffers()
  const raayonit = useMemo(() => (offers ?? []).filter(isRaayonitOffer), [offers])
  const flagship = useMemo(() => raayonit.find(isFlagship) ?? null, [raayonit])
  const chains = useMemo(() => raayonit.filter((o) => !isFlagship(o)), [raayonit])
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingLeft, paddingRight }]}>
        <ScreenTitleRow title={t('raayonit_page_title')} style={styles.title} />
        <RaayonitHero offer={flagship} buy />
        <RaayonitTab key={`${category ?? 'all'}|${q ?? ''}`} offers={chains} initialCategory={category} initialQuery={q} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: header.top, paddingBottom: 24 },
  title: { marginBottom: header.gap },
})
