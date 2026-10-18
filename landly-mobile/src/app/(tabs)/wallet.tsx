import { useEffect, useState, type ReactNode } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CUSTOMER_TYPES, CUSTOMER_TYPE_UNSET_COLOR, customerTypeLabel } from '@shared/customerTypes'
import { useAuth } from '@shared/firebase/useAuth'
import { useMemberProfile } from '@shared/firebase/useMemberProfile'
import { subscribeToUserVouchers, type VoucherDocument } from '@shared/firebase/vouchers'
import { totalSaved } from '@shared/member/savings'
import AppText from '../../components/AppText'
import Button from '../../components/Button'
import DashboardStats from '../../components/DashboardStats'
import LineIcon, { type LineIconName } from '../../components/LineIcon'
import Notice from '../../components/Notice'
import RedeemedPass from '../../components/RedeemedPass'
import SegmentedControl from '../../components/SegmentedControl'
import VoucherPass from '../../components/VoucherPass'
import { useLang } from '../../i18n/LangProvider'
import { colors, radius, type } from '../../theme'

type Voucher = VoucherDocument & { id: string }
type PassTab = 'perks' | 'redeemed'

// The member dashboard (web: /member): the My Pass title and customer-type
// badge (no welcome: Home already greets the member), the Active / Redeemed / Saved snapshot, then My Perks (scannable passes)
// and Redeemed. Both lists are live from Firestore: a purchase on the
// website appears within moments, and a pass the business redeems moves
// across the same way.
export default function WalletScreen() {
  const { t } = useLang()
  const { user } = useAuth()
  const router = useRouter()
  const { loaded, profile } = useMemberProfile(user)
  const [tab, setTab] = useState<PassTab>('perks')
  const [active, setActive] = useState<Voucher[] | null>(null)
  const [redeemed, setRedeemed] = useState<Voucher[] | null>(null)
  const [saved, setSaved] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)
  // Bumped by pull-to-refresh to re-open the listeners after an error.
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!user) return
    const onError = () => setFailed(true)
    const stopActive = subscribeToUserVouchers(user.uid, 'active', (next) => {
      setActive(next)
      setFailed(false)
    }, onError)
    const stopRedeemed = subscribeToUserVouchers(user.uid, 'redeemed', setRedeemed, onError)
    return () => {
      stopActive()
      stopRedeemed()
    }
  }, [user, attempt])

  // Savings count from purchase (lib/member/savings.ts): active and redeemed passes alike.
  useEffect(() => {
    if (!active || !redeemed) return
    let cancelled = false
    totalSaved([...active, ...redeemed])
      .then((amount) => {
        if (!cancelled) setSaved(amount)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [active, redeemed])

  const segment = CUSTOMER_TYPES.find((o) => o.value === profile?.customerType)
  // "Other" shows what the member typed for it.
  const segmentLabel = customerTypeLabel(profile?.customerType ?? '', profile?.customerTypeOther ?? '', t) ?? t('dash_segment_value_unset')

  const list = tab === 'perks' ? active : redeemed

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList<Voucher>
        data={list ?? []}
        keyExtractor={(voucher) => voucher.id}
        renderItem={({ item }) => (tab === 'perks' ? <VoucherPass voucher={item} /> : <RedeemedPass voucher={item} />)}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => setAttempt((n) => n + 1)} tintColor={colors.brand} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.identity}>
              <AppText accessibilityRole="header" style={type.screenTitle}>
                {t('pass_screen_title')}
              </AppText>
              {/* The badge waits for the profile read, so a fallback never flashes first; its slot holds the space. */}
              <View style={styles.badgeSlot}>
                {loaded && (
                  <View style={[styles.badge, { backgroundColor: segment?.color ?? CUSTOMER_TYPE_UNSET_COLOR }]}>
                    <AppText style={styles.badgeText} numberOfLines={1}>
                      {segmentLabel}
                    </AppText>
                  </View>
                )}
              </View>
            </View>

            <DashboardStats activePerks={active?.length ?? null} redeemed={redeemed?.length ?? null} saved={saved} />

            <SegmentedControl
              tone="brand"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'perks', label: t('dash_tab_perks') },
                { value: 'redeemed', label: t('dash_tab_redeemed') },
              ]}
            />
            {failed && <Notice message={t('mobile_load_error')} />}
          </View>
        }
        ListEmptyComponent={
          list === null ? (
            failed ? null : <ActivityIndicator color={colors.brand} style={styles.spinner} />
          ) : tab === 'perks' ? (
            <EmptyState icon="gift" title={t('dash_perks_empty_title')} sub={t('dash_perks_empty_sub')}>
              <Button label={t('nav_cta')} onPress={() => router.navigate({ pathname: '/perks', params: { cat: '', sort: '' } })} />
            </EmptyState>
          ) : (
            <EmptyState icon="receipt" title={t('dash_redeemed_empty_title')} sub={t('dash_redeemed_empty_sub')} />
          )
        }
      />
    </SafeAreaView>
  )
}

function EmptyState({ icon, title, sub, children }: { icon: LineIconName; title: string; sub: string; children?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <LineIcon name={icon} size={30} color={colors.textFaint} strokeWidth={1.8} />
      </View>
      <AppText style={styles.emptyTitle}>{title}</AppText>
      <AppText style={styles.emptySub}>{sub}</AppText>
      {children && <View style={styles.emptyAction}>{children}</View>}
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, flexGrow: 1 },
  header: { marginBottom: 20, gap: 0 },
  identity: { marginBottom: 20, alignItems: 'flex-start', gap: 10 },
  badgeSlot: { minHeight: 26, maxWidth: '100%' },
  // The customer-type badge (web: .segment-badge): solid type colour, white text.
  badge: { maxWidth: '100%', paddingHorizontal: 13, paddingVertical: 5, borderRadius: radius.pill },
  badgeText: { fontSize: 12, fontWeight: '800', color: colors.white },
  spinner: { marginTop: 48 },
  empty: { alignItems: 'center', marginTop: 40, paddingHorizontal: 24 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.heading, textAlign: 'center', marginBottom: 4 },
  emptySub: { fontSize: 14, lineHeight: 20, color: colors.body, textAlign: 'center' },
  emptyAction: { alignSelf: 'stretch', marginTop: 20 },
})
