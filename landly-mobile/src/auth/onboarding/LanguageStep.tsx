import { Pressable, StyleSheet, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { ONBOARDING_LANGS } from '@shared/auth/onboarding'
import { RTL_LANGS } from '@shared/i18n/translations'
import { useLang } from '../../i18n/LangProvider'
import { webOnly } from '../../lib/webStyles'
import { colors } from '../../theme'
import AppText from '../../components/AppText'

// Step 1. Picking a card switches the whole app's language and direction at
// once (LangProvider persists it; the root view flips `direction`), then
// `onPick` moves on to the next step. All five languages as compact rows,
// so the card fits a small phone without scrolling.
export default function LanguageStep({ onPick }: { onPick: () => void }) {
  const { lang, setLang } = useLang()
  return (
    <View accessibilityRole="radiogroup" style={styles.group}>
      {ONBOARDING_LANGS.map((option) => {
        const selected = option.code === lang
        return (
          <Pressable
            key={option.code}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLanguage={option.code}
            onPress={() => {
              if (option.code !== lang) setLang(option.code)
              onPick()
            }}
            style={({ pressed }) => [styles.card, selected && styles.cardSelected, pressed && styles.pressed]}
          >
            <View style={styles.labelRow}>
              <AppText style={styles.flag}>
                {option.flag}
              </AppText>
              <AppText
                style={[styles.label, selected && styles.labelSelected, { writingDirection: (RTL_LANGS as readonly string[]).includes(option.code) ? 'rtl' : 'ltr' }]}
              >
                {option.label}
              </AppText>
            </View>
            <View style={[styles.radio, selected && styles.radioSelected]}>
              {selected && (
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.white} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M20 6 9 17l-5-5" />
                </Svg>
              )}
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  group: { gap: 8, marginBottom: 16 },
  card: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    ...webOnly({ cursor: 'pointer', userSelect: 'none' }),
  },
  cardSelected: { borderColor: colors.brand, backgroundColor: colors.brandLight },
  pressed: { transform: [{ scale: 0.98 }] },
  labelRow: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  flag: { fontSize: 20, lineHeight: 24 },
  label: { flexShrink: 1, fontSize: 17, fontWeight: '700', color: colors.textStrong },
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
