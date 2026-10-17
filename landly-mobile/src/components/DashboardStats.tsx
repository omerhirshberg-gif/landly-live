import { StyleSheet, View } from 'react-native'
import AppText from './AppText'
import LineIcon, { type LineIconName } from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import { formatSavingsSafe } from '../lib/formatSavings'
import { colors } from '../theme'

// My Pass snapshot row (web: components/member/DashboardStats.tsx): Active
// Perks, Perks Redeemed, Total Saved. The row follows the root direction, so
// Active Perks leads on the right in Hebrew. Each label sits in the same
// two-line band and the numbers are pinned to the card bottom, so they share
// a baseline in every language. null shows "–" while a value loads.
export default function DashboardStats({
  activePerks,
  redeemed,
  saved,
}: {
  activePerks: number | null
  redeemed: number | null
  saved: number | null
}) {
  const { t, lang } = useLang()
  return (
    <View style={styles.row}>
      <StatCard icon="tag" tint={TINTS.cyan} label={t('dash_active_perks_label')} value={activePerks === null ? '–' : String(activePerks)} />
      <StatCard icon="gift" tint={TINTS.brand} label={t('dash_perks_redeemed_label')} value={redeemed === null ? '–' : String(redeemed)} />
      <StatCard icon="banknote" tint={TINTS.green} label={t('dash_total_saved')} value={saved === null ? '–' : formatSavingsSafe(saved, lang)} />
    </View>
  )
}

// Web icon colours (cyan-600, brand, emerald-600) on their soft tints.
const TINTS = {
  cyan: { fg: '#0891b2', bg: '#ecfeff' },
  brand: { fg: colors.brand, bg: colors.brandLight },
  green: { fg: '#059669', bg: '#ecfdf5' },
}

function StatCard({ icon, tint, label, value }: { icon: LineIconName; tint: { fg: string; bg: string }; label: string; value: string }) {
  return (
    <View style={styles.card} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={[styles.iconBox, { backgroundColor: tint.bg }]}>
        <LineIcon name={icon} size={18} color={tint.fg} />
      </View>
      <View style={styles.labelBand}>
        <AppText style={styles.label} numberOfLines={2}>
          {label}
        </AppText>
      </View>
      <AppText ltr style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
        {value}
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  card: {
    flex: 1,
    minWidth: 0,
    minHeight: 112,
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    shadowColor: colors.textStrong,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  iconBox: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  // Two lines' worth, centred, so a one-line label lines up with a wrapped one.
  labelBand: { minHeight: 34, marginTop: 8, alignSelf: 'stretch', justifyContent: 'center' },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.textMuted, textAlign: 'center' },
  value: {
    marginTop: 'auto',
    paddingTop: 4,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    color: colors.heading,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
})
