import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@shared/firebase/useAuth'
import { subscribeToUserVouchers, type VoucherDocument } from '@shared/firebase/vouchers'
import AppText from '../../components/AppText'
import Button from '../../components/Button'
import Notice from '../../components/Notice'
import VoucherPass from '../../components/VoucherPass'
import { useLang } from '../../i18n/LangProvider'
import { colors } from '../../theme'

type ActiveVoucher = VoucherDocument & { id: string }

// The signed-in customer's active vouchers, live from Firestore. Vouchers
// are written by the payment webhook when a purchase completes on the
// website, so a purchase there appears here within moments, and a pass the
// business redeems disappears the same way. Same query and rules as the web
// member area's PerksTab.
export default function WalletScreen() {
  const { t } = useLang()
  const { user } = useAuth()
  const router = useRouter()
  const [vouchers, setVouchers] = useState<ActiveVoucher[] | null>(null)
  const [failed, setFailed] = useState(false)
  // Bumped by pull-to-refresh to re-open the listener after an error.
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!user) return
    return subscribeToUserVouchers(
      user.uid,
      'active',
      (next) => {
        setVouchers(next)
        setFailed(false)
      },
      () => setFailed(true)
    )
  }, [user, attempt])

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={vouchers ?? []}
        keyExtractor={(voucher) => voucher.id}
        renderItem={({ item }) => <VoucherPass voucher={item} />}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={() => setAttempt((n) => n + 1)} tintColor={colors.brand} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <AppText style={styles.title}>{t('mobile_tab_wallet')}</AppText>
            {failed && <Notice message={t('mobile_load_error')} />}
          </View>
        }
        ListEmptyComponent={
          vouchers === null ? (
            failed ? null : <ActivityIndicator color={colors.brand} style={styles.spinner} />
          ) : (
            <View style={styles.empty}>
              <AppText style={styles.emptyTitle}>{t('dash_perks_empty_title')}</AppText>
              <AppText style={styles.emptySub}>{t('dash_perks_empty_sub')}</AppText>
              <Button label={t('nav_cta')} onPress={() => router.navigate('/')} />
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
  title: { fontSize: 24, fontWeight: '900', color: colors.textStrong },
  spinner: { marginTop: 48 },
  empty: { alignItems: 'stretch', marginTop: 48, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 4 },
  emptySub: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginBottom: 20 },
})
