import { Pressable, StyleSheet, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { ARCH, ARROW, EMBLEM_VIEWBOX, STAR } from '@shared/brand/emblemPaths'
import { passCountMessage } from '@shared/home/categoryRails'
import AppText from './AppText'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

// The member pass, Home's focal point, and always there as the way into My Pass
// (web: components/home/ActivePassCard.tsx): the live count, then a ticket's
// perforation and the button; the whole card is one button. `count` is null
// until the first snapshot (or if the read is refused): a "–" and an unseen
// message holding the card's height, never a fake 0.
export default function ActivePassCard({ count, onPress }: { count: number | null; onPress: () => void }) {
  const { t, isRtl } = useLang()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('home_pass_label')}: ${count ?? '–'}. ${t('home_pass_cta')}`}
      onPress={onPress}
      style={({ pressed }) => [styles.passCard, pressed && styles.passCardPressed]}
    >
      <View style={styles.passGlow} />
      {/* The Landly emblem as a watermark in the top end corner (web: components/home/LandlyMark.tsx). */}
      <Svg viewBox={`0 0 ${EMBLEM_VIEWBOX.width} ${EMBLEM_VIEWBOX.height}`} width={88} height={86} style={styles.passMark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {[STAR, ARCH, ARROW].flatMap((part) => [part.light, part.dark]).map((d) => (
          <Path key={d.slice(0, 24)} d={d} fill={colors.white} fillOpacity={0.15} fillRule="evenodd" />
        ))}
      </Svg>
      <View style={styles.passTop}>
        <View style={styles.iconBox}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.white} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4zM14 6v2M14 11v2M14 16v2" />
          </Svg>
        </View>
        <AppText style={styles.passLabel} numberOfLines={1}>
          {t('home_pass_label')}
        </AppText>
      </View>
      <View style={styles.passCount} accessibilityLiveRegion="polite">
        <AppText ltr style={styles.countText}>
          {count ?? '–'}
        </AppText>
        <AppText style={[styles.passMessage, count === null && styles.unseen]} numberOfLines={2}>
          {passCountMessage(count ?? 0, t)}
        </AppText>
      </View>
      {/* A ticket's perforation: notches cut into both edges and a dashed tear line. */}
      <View style={styles.perforation}>
        <View style={[styles.notch, styles.notchStart]} />
        <View style={styles.tearLine} />
        <View style={[styles.notch, styles.notchEnd]} />
      </View>
      <View style={styles.passCta}>
        <AppText style={styles.passCtaText} numberOfLines={1}>
          {t('home_pass_cta')}
        </AppText>
        <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={colors.brand} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={isRtl && styles.flip}>
          <Path d="M5 12h14M12 5l7 7-7 7" />
        </Svg>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  // Solid brand blue, rounded-2xl, lifted off the canvas. No wider than 576pt, so
  // on an unfolded screen it stays a ticket at the start edge rather than a
  // stretched banner.
  passCard: {
    maxWidth: 576,
    overflow: 'hidden',
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 18,
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    shadowColor: colors.brandDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 6,
    ...webOnly({ cursor: 'pointer' }),
  },
  passCardPressed: { backgroundColor: colors.brandHover },
  // A soft light disc in the top end corner, for depth without a gradient dependency.
  passGlow: {
    position: 'absolute',
    top: -70,
    end: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  passMark: { position: 'absolute', top: 12, end: 14 },
  passTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.16)', alignItems: 'center', justifyContent: 'center' },
  passLabel: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.85)' },
  // Clear of the watermark on the end side.
  passCount: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, paddingEnd: 72 },
  countText: { fontSize: 44, lineHeight: 50, fontWeight: '800', color: colors.white, fontVariant: ['tabular-nums'] },
  passMessage: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 21, fontWeight: '600', color: colors.white },
  unseen: { opacity: 0 },
  perforation: { flexDirection: 'row', alignItems: 'center', marginVertical: 14, marginHorizontal: -18 },
  notch: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.background },
  notchStart: { marginStart: -9 },
  notchEnd: { marginEnd: -9 },
  tearLine: { flex: 1, marginHorizontal: 6, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255, 255, 255, 0.35)' },
  passCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  passCtaText: { fontSize: 15, fontWeight: '700', color: colors.brand },
  flip: { transform: [{ scaleX: -1 }] },
})
