import { ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { isFlagship, isRaayonitOffer } from '@shared/offers/discoverTab'
import { useOffers } from '@shared/offers/useOffers'
import { useMemo } from 'react'
import GlassBackButton from '../components/GlassBackButton'
import RaayonitCardDetails from '../components/RaayonitCardDetails'
import RaayonitHero from '../components/RaayonitHero'
import ScreenTitleRow from '../components/ScreenTitleRow'
import { useLang } from '../i18n/LangProvider'
import { useLayout } from '../lib/useLayout'
import { colors, header } from '../theme'

// The step between the hub's "More details & purchase" and checkout (web: app/raayonit/card/page.tsx): the card with its three values to choose
// from and "Continue to order", then what the voucher is, how to redeem it and the businesses that accept it. `?variant=` (a pool id) or
// `?denomination=` pre-selects a value; otherwise the highest value is.
export { default as ErrorBoundary } from '../components/RouteErrorBoundary'

export default function RaayonitCardScreen() {
  const { t } = useLang()
  const { paddingLeft, paddingRight } = useLayout()
  const { offers } = useOffers()
  const raayonit = useMemo(() => (offers ?? []).filter(isRaayonitOffer), [offers])
  const flagship = useMemo(() => raayonit.find(isFlagship) ?? null, [raayonit])
  const chains = useMemo(() => raayonit.filter((o) => !isFlagship(o)), [raayonit])
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.content, { paddingLeft, paddingRight }]}>
        <View style={styles.back}><GlassBackButton label={t('settings_back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/raayonit'))} /></View>
        <ScreenTitleRow title={t('raayonit_details_title')} style={styles.title} />
        <RaayonitHero offer={flagship} buy step="details" />
        <RaayonitCardDetails offer={flagship} chains={chains} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingTop: header.top, paddingBottom: 32 },
  back: { alignItems: 'flex-start', marginBottom: 4 },
  title: { marginBottom: header.gap },
})
