import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { type CSSTransitionProperties } from 'react-native-reanimated'
import { MAX_PERSONA_NOTE_LENGTH, OTHER_CUSTOMER_TYPE } from '@shared/auth/onboarding'
import { ONB } from '@shared/brand/onboardingMotion'
import { CUSTOMER_TYPES } from '@shared/customerTypes'
import AppText from '../../components/AppText'
import TextField from '../../components/TextField'
import { useLang } from '../../i18n/LangProvider'
import { webOnly } from '../../lib/webStyles'
import { colors } from '../../theme'
import { reveal, SILK_CSS } from './motion'

// Reanimated CSS transition for selection and press (kept out of StyleSheet.create, whose types don't take it).
const TRANSITION: CSSTransitionProperties = {
  transitionProperty: ['borderColor', 'backgroundColor', 'transform'],
  transitionDuration: ONB.ringMs,
  transitionTimingFunction: SILK_CSS,
}

// Single-choice chip grid (two columns, so all six fit in three rows).
// Choosing "Other" reveals an optional note below the chips, 20px under the
// grid and 24px above Continue; the stage around the card eases its height
// as it appears.
export default function PersonaStep({
  value,
  onChange,
  note,
  onNoteChange,
  onSubmit,
  error,
}: {
  value: string
  onChange: (value: string) => void
  note: string
  onNoteChange: (note: string) => void
  onSubmit: () => void
  error?: string
}) {
  const { t } = useLang()
  return (
    <View style={styles.wrap}>
      <View accessibilityRole="radiogroup" style={styles.grid}>
        {CUSTOMER_TYPES.map((option) => {
          const selected = option.value === value
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(option.value)}
              style={styles.cell}
            >
              {({ pressed }) => (
                <Animated.View style={[styles.chip, selected && styles.chipSelected, { transform: [{ scale: pressed ? ONB.pressScale : 1 }] }, TRANSITION]}>
                  <AppText style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{t(option.labelKey)}</AppText>
                </Animated.View>
              )}
            </Pressable>
          )
        })}
      </View>
      {error && (
        <Animated.View entering={reveal()}>
          <AppText accessibilityRole="alert" style={styles.error}>
            {error}
          </AppText>
        </Animated.View>
      )}
      {value === OTHER_CUSTOMER_TYPE && (
        <Animated.View entering={reveal()} style={styles.note}>
          <TextField
            label={t('onb_persona_otherLabel')}
            natural
            value={note}
            onChangeText={onNoteChange}
            placeholder={t('onb_persona_otherPlaceholder')}
            maxLength={MAX_PERSONA_NOTE_LENGTH}
            autoComplete="off"
            returnKeyType="next"
            onSubmitEditing={onSubmit}
          />
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { flexBasis: '40%', flexGrow: 1, ...webOnly({ cursor: 'pointer', userSelect: 'none' }) },
  chip: {
    minHeight: 54,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipSelected: { borderColor: colors.brand, backgroundColor: colors.brandLight, boxShadow: '0 0 0 4px rgba(0, 56, 184, 0.12)' },
  chipLabel: { fontSize: 14, lineHeight: 18, fontWeight: '600', color: colors.text, textAlign: 'center' },
  chipLabelSelected: { color: colors.brand },
  error: { marginTop: 8, fontSize: 12, fontWeight: '600', color: colors.danger },
  // TextField brings its own 16px bottom margin; -12 here plus wrap's 20 leaves 24px above Continue.
  note: { marginTop: 20, marginBottom: -12 },
})
