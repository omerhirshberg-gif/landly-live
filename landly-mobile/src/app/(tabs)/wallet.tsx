import { useEffect, useState, type ReactNode } from 'react'
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@shared/firebase/useAuth'
import { useMemberProfile } from '@shared/firebase/useMemberProfile'
import { subscribeToUserVouchers, type VoucherDocument } from '@shared/firebase/vouchers'
import { totalSaved } from '@shared/member/savings'
import AppText from '../../components/AppText'
import Button from '../../components/Button'
import DashboardStats from '../../components/DashboardStats'
import FeedCell, { feedColumnWrapper } from '../../components/FeedCell'
import LineIcon, { type LineIconName } from '../../components/LineIcon'
import Notice from '../../components/Notice'
import RedeemedPass from '../../components/RedeemedPass'
import ScreenTitleRow from '../../components/ScreenTitleRow'
import SegmentBadge from '../../components/SegmentBadge'
import SegmentedControl from '../../components/SegmentedControl'
import VoucherPass from '../../components/VoucherPass'
import { PassListSkeleton } from '../../components/Skeleton'
import { useLang } from '../../i18n/LangProvider'
import { useLayout } from '../../lib/useLayout'
import { colors, header } from '../../theme'

type Voucher = VoucherDocument & { id: string }
type PassTab = 'perks' | 'redeemed'

// The member dashboard (web: /member): the My Pass title and customer-type
// badge (no welcome: Home already greets the member), the Active / Redeemed / Saved snapshot, then My Perks (scannable passes)
// and Redeemed. Both lists are live from Firestore: a purchase on the
// website appears within moments, and a pass the business redeems moves
// across the same way.
export default function WalletScreen() {
  const { t } = useLang()
  // Passes two to a row on an unfolded foldable, three on a tablet; the key
  // remounts the list when folding changes the count, as numColumns requires.
  const { columns, paddingLeft, paddingRight } = useLayout()
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

  const list = tab === 'perks' ? active : redeemed

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList<Voucher>
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        key={'cols-' + columns}
        data={list ?? []}
        keyExtractor={(voucher) => voucher.id}
        numColumns={columns}
        columnWrapperStyle={feedColumnWrapper(columns)}
        renderItem={({ item }) => <FeedCell>{tab === 'perks' ? <VoucherPass voucher={item} /> : <RedeemedPass voucher={item} />}</FeedCell>}
        contentContainerStyle={[styles.content, { paddingLeft, paddingRight }]}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => setAttempt((n) => n + 1)} tintColor={colors.brand} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.identity}>
              <ScreenTitleRow title={t('pass_screen_title')} style={styles.titleRow} />
              {/* The badge waits for the profile read, so a fallback never flashes first; its slot holds the space. */}
              <View style={styles.badgeSlot}>
                {loaded && <SegmentBadge customerType={profile?.customerType} customerTypeOther={profile?.customerTypeOther} />}
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
            failed ? null : <PassListSkeleton />
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
  content: { paddingHorizontal: 16, paddingTop: header.top, paddingBottom: 24, flexGrow: 1 },
  // Title and badge, the stats, then the tabs: header.gap apart, and header.gap before the first pass.
  header: { marginBottom: header.gap, gap: 0 },
  identity: { marginBottom: header.gap, alignItems: 'flex-start', gap: 10 },
  titleRow: { alignSelf: 'stretch' },
  badgeSlot: { minHeight: 26, maxWidth: '100%' },
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
