import { Platform, StyleSheet, View } from 'react-native'
import Animated, { Easing, FadeInDown } from 'react-native-reanimated'
import { EASE_SILK, ONB } from '@shared/brand/onboardingMotion'
import AppText from './AppText'
import LineIcon from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import { colors } from '../theme'

// Not on web: Reanimated's web cleanup pins a custom entering animation's element with position: absolute once it ends.
const ENTER = Platform.OS === 'web' ? undefined : FadeInDown.duration(ONB.greetingMs).easing(Easing.bezier(...EASE_SILK)).withInitialValues({ opacity: 0, transform: [{ translateY: ONB.screenRisePx }] })

// The calm note for a catalogue with no direct GoLandly perks yet, on Home and Explore Perks (web: components/perks/PerksSoonCard.tsx):
// a white hairline card, a soft round 40pt badge with one line icon, a headline and one sentence. No pill, no button.
export default function PerksSoonCard({ quiet = false }: { quiet?: boolean }) {
  const { t } = useLang()
  // `quiet`: the live Raayonit chains lead the screen, so the note shrinks to plain text with no badge.
  if (quiet) {
    return (
      <Animated.View entering={ENTER} style={styles.quiet} accessibilityLiveRegion="polite">
        <AppText style={styles.quietTitle}>{t('perks_landly_soon')}</AppText>
        <AppText style={styles.sub}>{t('perks_soon_sub')}</AppText>
      </Animated.View>
    )
  }
  return (
    <Animated.View entering={ENTER} style={styles.card} accessibilityLiveRegion="polite">
      <View style={styles.badge} accessible={false} importantForAccessibility="no-hide-descendants">
        <LineIcon name="gift" size={20} color={colors.brand} strokeWidth={1.75} />
      </View>
      <View style={styles.copy}>
        <AppText accessibilityRole="header" style={styles.title}>{t('perks_landly_soon')}</AppText>
        <AppText style={styles.sub}>{t('perks_soon_sub')}</AppText>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  quiet: { marginTop: 24, gap: 2, paddingHorizontal: 2 },
  quietTitle: { fontSize: 15, lineHeight: 21, fontWeight: '700', color: colors.heading },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 24, padding: 16, borderRadius: 20, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  badge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandTint, borderWidth: 1, borderColor: colors.brandLight, flexShrink: 0 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 16, lineHeight: 22, fontWeight: '700', letterSpacing: -0.2, color: colors.heading },
  sub: { fontSize: 14, lineHeight: 20, color: colors.body },
})
