import { Pressable, StyleSheet, View } from 'react-native'
import { CUSTOMER_TYPES } from '@shared/customerTypes'
import AppText from '../../components/AppText'
import { useLang } from '../../i18n/LangProvider'
import { webOnly } from '../../lib/webStyles'
import { colors } from '../../theme'

// Single-choice chip grid (two columns, so all six fit in three rows).
export default function PersonaStep({ value, onChange, error }: { value: string; onChange: (value: string) => void; error?: string }) {
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
              style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
            >
              <AppText style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{t(option.labelKey)}</AppText>
            </Pressable>
          )
        })}
      </View>
      {error && (
        <AppText accessibilityRole="alert" style={styles.error}>
          {error}
        </AppText>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexBasis: '45%',
    flexGrow: 1,
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    ...webOnly({ cursor: 'pointer', userSelect: 'none' }),
  },
  chipSelected: { borderColor: colors.brand, backgroundColor: colors.brandLight },
  pressed: { transform: [{ scale: 0.97 }] },
  chipLabel: { fontSize: 14, lineHeight: 18, fontWeight: '600', color: colors.text, textAlign: 'center' },
  chipLabelSelected: { color: colors.brand },
  error: { marginTop: 8, fontSize: 12, fontWeight: '600', color: colors.danger },
})
