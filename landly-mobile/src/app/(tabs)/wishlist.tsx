import { useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getOffersByIds, type OfferDocument } from '@shared/firebase/offers'
import { useWishlist } from '@shared/firebase/useWishlist'
import AppText from '../../components/AppText'
import FeedCell, { feedColumnWrapper } from '../../components/FeedCell'
import Notice from '../../components/Notice'
import ScreenTitleRow from '../../components/ScreenTitleRow'
import OfferCard from '../../components/OfferCard'
import { OfferListSkeleton } from '../../components/Skeleton'
import { useLang } from '../../i18n/LangProvider'
import { openOffer } from '../../lib/openOffer'
import { useLayout } from '../../lib/useLayout'
import { colors, header } from '../../theme'

// The saved perks (web: /wishlist), the Wishlist tab. The list follows the live wishlist in the order it was saved, as on the website:
// un-hearting a card drops it at once, and only newly saved ids are fetched.
// An id whose offer was deleted is skipped.
export default function WishlistScreen() {
  const { t } = useLang()
  // Columns follow the window (two unfolded, three on a tablet); the key
  // remounts the list when folding changes them, as numColumns requires.
  const { columns, paddingLeft, paddingRight } = useLayout()
  const { wishlistIds } = useWishlist()
  // Every id looked up so far, found (an offer) or not (null).
  const [cache, setCache] = useState<Map<string, OfferDocument | null> | null>(null)
  const [failed, setFailed] = useState(false)
  // Looking up newly saved ids (the cached cards stay up meanwhile).
  const [pending, setPending] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const cacheRef = useRef(cache)
  // Kept current from an effect (render must not write refs); declared first,
  // so it runs before the lookup effect below in the same commit.
  useEffect(() => {
    cacheRef.current = cache
  }, [cache])

  const fetchInto = async (ids: string[], base: Map<string, OfferDocument | null>) => {
    const found = await getOffersByIds(ids)
    const next = new Map(base)
    for (const id of ids) next.set(id, found.find((offer) => offer.id === id) ?? null)
    return next
  }

  useEffect(() => {
    const known = cacheRef.current ?? new Map<string, OfferDocument | null>()
    const missing = wishlistIds.filter((id) => !known.has(id))
    if (cacheRef.current && missing.length === 0) {
      // A lookup this replaced (e.g. a perk saved then un-saved) never settles.
      setPending(false)
      return
    }
    let cancelled = false
    setPending(true)
    fetchInto(missing, known)
      .then((next) => {
        if (cancelled) return
        setCache(next)
        setFailed(false)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
      .finally(() => {
        if (!cancelled) setPending(false)
      })
    return () => {
      cancelled = true
    }
  }, [wishlistIds])

  // Pull-to-refresh looks every saved id up again.
  const onRefresh = async () => {
    setRefreshing(true)
    try {
      setCache(await fetchInto(wishlistIds, new Map()))
      setFailed(false)
    } catch {
      setFailed(true)
    }
    setRefreshing(false)
  }

  const offers = useMemo(
    () => (cache ? wishlistIds.map((id) => cache.get(id)).filter((offer): offer is OfferDocument => !!offer) : null),
    [cache, wishlistIds]
  )

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        key={'cols-' + columns}
        data={offers ?? []}
        keyExtractor={(offer) => offer.id}
        numColumns={columns}
        columnWrapperStyle={feedColumnWrapper(columns)}
        renderItem={({ item }) => (
          <FeedCell>
            <OfferCard offer={item} onPress={() => openOffer(item)} />
          </FeedCell>
        )}
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
          offers === null || pending ? (
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: header.top, paddingBottom: 24, flexGrow: 1 },
  title: { marginBottom: header.gap },
  notice: { marginBottom: 16 },
  empty: { alignItems: 'center', marginTop: 48, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.heading, textAlign: 'center', marginBottom: 4 },
  emptySub: { fontSize: 14, color: colors.body, textAlign: 'center' },
})
