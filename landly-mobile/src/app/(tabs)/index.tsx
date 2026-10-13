import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Linking, RefreshControl, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getAllOffers, type OfferDocument } from '@shared/firebase/offers'
import AppText from '../../components/AppText'
import Notice from '../../components/Notice'
import OfferCard from '../../components/OfferCard'
import { useLang } from '../../i18n/LangProvider'
import { API_BASE_URL } from '../../lib/env'
import { colors } from '../../theme'

// Bestsellers first, then newest — the same offers collection the website reads.
function sortOffers(offers: OfferDocument[]): OfferDocument[] {
  return [...offers].sort(
    (a, b) =>
      Number(b.isBestseller) - Number(a.isBestseller) ||
      (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
  )
}

export default function PerksScreen() {
  const { t } = useLang()
  const [offers, setOffers] = useState<OfferDocument[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      setOffers(sortOffers(await getAllOffers()))
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const onRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  // Checkout (Tranzila) runs on the website; the voucher it creates then
  // appears live in the wallet tab.
  const openOffer = (offer: OfferDocument) => Linking.openURL(`${API_BASE_URL}/offers/${offer.id}`)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={offers ?? []}
        keyExtractor={(offer) => offer.id}
        renderItem={({ item }) => <OfferCard offer={item} onPress={() => openOffer(item)} />}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <AppText style={styles.label}>{t('deals_label')}</AppText>
            <AppText style={styles.title}>{t('deals_title')}</AppText>
            {failed && <Notice message={t('mobile_load_error')} />}
          </View>
        }
        ListEmptyComponent={
          offers === null ? (
            failed ? null : <ActivityIndicator color={colors.brand} style={styles.spinner} />
          ) : (
            <View style={styles.empty}>
              <AppText style={styles.emptyTitle}>{t('deals_empty_title')}</AppText>
              <AppText style={styles.emptySub}>{t('deals_empty_sub')}</AppText>
            </View>
          )
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, flexGrow: 1 },
  header: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: colors.brand, letterSpacing: 1, marginBottom: 4 },
  title: { fontSize: 24, fontWeight: '900', color: colors.textStrong },
  spinner: { marginTop: 48 },
  empty: { alignItems: 'center', marginTop: 48, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 4 },
  emptySub: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
})
