import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { type CSSTransitionProperties } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { ONBOARDING_LANGS } from '@shared/auth/onboarding'
import { ONB } from '@shared/brand/onboardingMotion'
import { RTL_LANGS, type Lang } from '@shared/i18n/translations'
import AppText from '../../components/AppText'
import { webOnly } from '../../lib/webStyles'
import { colors } from '../../theme'
import { SILK_CSS } from './motion'

// Reanimated CSS transition for selection and press (kept out of StyleSheet.create, whose types don't take it).
const TRANSITION: CSSTransitionProperties = {
  transitionProperty: ['borderColor', 'backgroundColor', 'transform', 'opacity'],
  transitionDuration: ONB.ringMs,
  transitionTimingFunction: SILK_CSS,
}

// Picking a row selects it at once; the wizard then cross-fades the card into
// the new language and direction (the root view flips `direction`) and stays
// here until Continue. All five languages (Hebrew last) as compact rows, so
// the card fits a small phone without scrolling. Rows span the card's full
// width (Expo web would otherwise shrink them to their content); the flag sits
// in a fixed box so every name starts on one line, the radio trails.
export default function LanguageStep({ selected, onSelect }: { selected: Lang; onSelect: (code: Lang) => void }) {
  return (
    <View accessibilityRole="radiogroup" style={styles.group}>
      {ONBOARDING_LANGS.map((option) => {
        const checked = option.code === selected
        return (
          <Pressable
            key={option.code}
            accessibilityRole="radio"
            accessibilityState={{ checked }}
            accessibilityLanguage={option.code}
            onPress={() => onSelect(option.code)}
            style={styles.pointer}
          >
            {({ pressed }) => (
              <Animated.View style={[styles.card, checked && styles.cardSelected, { transform: [{ scale: pressed ? ONB.pressScale : 1 }] }, TRANSITION]}>
                <View style={styles.labelRow}>
                  <AppText style={styles.flag}>{option.flag}</AppText>
                  <AppText
                    numberOfLines={1}
                    style={[styles.label, checked && styles.labelSelected, { writingDirection: (RTL_LANGS as readonly string[]).includes(option.code) ? 'rtl' : 'ltr' }]}
                  >
                    {option.label}
                  </AppText>
                </View>
                <Animated.View style={[styles.radio, checked && styles.radioSelected, TRANSITION]}>
                  <Animated.View style={[{ opacity: checked ? 1 : 0, transform: [{ scale: checked ? 1 : 0.5 }] }, TRANSITION]}>
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.white} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                      <Path d="M20 6 9 17l-5-5" />
                    </Svg>
                  </Animated.View>
                </Animated.View>
              </Animated.View>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  group: { alignSelf: 'stretch', gap: 8, marginBottom: 16 },
  pointer: { alignSelf: 'stretch', ...webOnly({ cursor: 'pointer', userSelect: 'none' }) },
  card: {
    width: '100%',
    minHeight: 52,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  // A soft brand ring around the chosen row (boxShadow renders natively on the New Architecture).
  cardSelected: { borderColor: colors.brand, backgroundColor: colors.brandLight, boxShadow: '0 0 0 4px rgba(0, 56, 184, 0.12)' },
  labelRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  flag: { width: 28, textAlign: 'center', fontSize: 20, lineHeight: 24 },
  label: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.textStrong },
  labelSelected: { color: colors.brand },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.textFaint,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.brand, backgroundColor: colors.brand },
})
