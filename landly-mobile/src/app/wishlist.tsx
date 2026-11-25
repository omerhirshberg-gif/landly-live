import { useCallback, useMemo, useState } from 'react'
import { RefreshControl, StyleSheet, View } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { OfferDocument } from '@shared/firebase/offers'
import { useOffers } from '@shared/offers/useOffers'
import { useWishlist } from '@shared/firebase/useWishlist'
import AppText from '../components/AppText'
import FeedCell from '../components/FeedCell'
import Notice from '../components/Notice'
import ScreenHeader from '../components/ScreenHeader'
import ScreenTitleRow from '../components/ScreenTitleRow'
import OfferCard from '../components/OfferCard'
import { OfferListSkeleton } from '../components/Skeleton'
import { useLang } from '../i18n/LangProvider'
import { openOffer } from '../lib/openOffer'
import { useLayout } from '../lib/useLayout'
import { colors, header } from '../theme'

// The saved perks (web: /wishlist), opened from the Profile tab's heart. The list follows the live wishlist in the order it was saved, as on the website:
// un-hearting a card drops it at once. An id whose offer is no longer on sale is skipped.
// A render error here shows the retry card; the rest of the app stays up.
export { default as ErrorBoundary } from '../components/RouteErrorBoundary'

export default function WishlistScreen() {
  const { t } = useLang()
  // Columns follow the window (two unfolded, three on a tablet); the key
  // remounts the list when folding changes them.
  const { columns, cellWidth, paddingLeft, paddingRight } = useLayout()
  const { wishlistIds } = useWishlist()
  // The saved ids against the shared catalog (lib/offers/offersStore.ts): drawn
  // from the held copy on the first frame, no lookup per id. A heart un-saved
  // anywhere drops its card on the tap's frame (the wishlist is optimistic).
  const { offers: catalog, failed, refresh } = useOffers()
  const [refreshing, setRefreshing] = useState(false)
  const byId = useMemo(() => (catalog ? new Map(catalog.map((offer) => [offer.id, offer])) : null), [catalog])
  const offers = useMemo(() => (byId ? wishlistIds.flatMap((id) => byId.get(id) ?? []) : null), [byId, wishlistIds])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }, [refresh])

  const cardWidth = columns > 1 ? cellWidth : undefined
  const renderItem = useCallback(
    ({ item, index }: { item: OfferDocument; index: number }) => (
      <FeedCell column={index}>
        <OfferCard offer={item} onOpen={openOffer} width={cardWidth} />
      </FeedCell>
    ),
    [cardWidth]
  )

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader fallback="/" />
      <FlashList
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        key={'cols-' + columns}
        data={offers ?? []}
        keyExtractor={offerKey}
        numColumns={columns}
        renderItem={renderItem}
        contentContainerStyle={[styles.content, { paddingLeft, paddingRight }]}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        ListHeaderComponent={
          <>
            <ScreenTitleRow title={t('wishlist_title')} style={styles.title} />
            {failed && <View style={styles.notice}><Notice message={t('mobile_load_error')} /></View>}
          </>
        }
        ListEmptyComponent={
          offers === null ? (
            failed ? null : <OfferListSkeleton />
          ) : (
            <View style={styles.empty}>
              <AppText style={styles.emptyTitle}>{t('wishlist_empty_title')}</AppText>
              <AppText style={styles.emptySub}>{t('wishlist_empty_sub')}</AppText>
            </View>
          )
        }
      />
    </SafeAreaView>
  )
}

const offerKey = (offer: OfferDocument) => offer.id

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: header.top, paddingBottom: 24, flexGrow: 1 },
  title: { marginBottom: header.gap },
  notice: { marginBottom: 16 },
  empty: { alignItems: 'center', marginTop: 48, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.heading, textAlign: 'center', marginBottom: 4 },
  emptySub: { fontSize: 14, color: colors.body, textAlign: 'center' },
})
