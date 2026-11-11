import { StyleSheet, View } from 'react-native'
import AppText from './AppText'
import { useLang } from '../i18n/LangProvider'
import { PASS_ICONS } from '../lib/categoryGlyphs'
import { formatSavingsSafe } from '../lib/formatSavings'
import { colors } from '../theme'
import LineIcon, { type LineIconName } from './LineIcon'

// My Pass snapshot row (web: components/member/DashboardStats.tsx): Active
// Perks, Perks Redeemed, Total Saved. The row follows the root direction, so
// Active Perks leads on the right in Hebrew. Each label sits in the same
// two-line band and the numbers are pinned to the card bottom, so they share
// a baseline in every language. null shows "–" while a value loads. Each
// leads with its icon (PASS_ICONS: a ticket, a gift, a piggy bank) in a quiet
// slate frame, no coloured discs.
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
      <StatCard icon={PASS_ICONS.activePerks} label={t('dash_active_perks_label')} value={activePerks === null ? '–' : String(activePerks)} />
      <StatCard icon={PASS_ICONS.redeemed} label={t('dash_perks_redeemed_label')} value={redeemed === null ? '–' : String(redeemed)} />
      <StatCard icon={PASS_ICONS.saved} label={t('dash_total_saved')} value={saved === null ? '–' : formatSavingsSafe(saved, lang)} />
    </View>
  )
}

function StatCard({ icon, label, value }: { icon: LineIconName; label: string; value: string }) {
  return (
    <View style={styles.card} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={styles.iconBox}>
        <LineIcon name={icon} size={18} color={colors.textStrong} strokeWidth={1.5} />
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
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.white,
    shadowColor: colors.textStrong,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  // A quiet 36pt slate frame with a hairline: no tinted disc, one brand-blue line glyph.
  iconBox: { width: 36, height: 36, borderRadius: 12, borderCurve: 'continuous', backgroundColor: colors.background, borderWidth: 1, borderColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' },
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
