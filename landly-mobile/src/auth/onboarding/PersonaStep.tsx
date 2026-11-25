import { StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { MAX_PERSONA_NOTE_LENGTH, OTHER_CUSTOMER_TYPE } from '@shared/auth/onboarding'
import { CUSTOMER_TYPES } from '@shared/customerTypes'
import AppText from '../../components/AppText'
import OptionGrid from '../../components/OptionGrid'
import TextField from '../../components/TextField'
import { useLang } from '../../i18n/LangProvider'
import { colors } from '../../theme'
import { reveal } from './motion'

// Single-choice card grid (components/OptionGrid: two equal columns, the odd
// last card ("Other") across the row). Also the Member type settings screen (app/settings/member-type).
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
      <OptionGrid options={CUSTOMER_TYPES.map((option) => ({ value: option.value, label: t(option.labelKey) }))} value={value} onChange={onChange} />
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
  error: { marginTop: 8, fontSize: 12, fontWeight: '600', color: colors.danger },
  // TextField brings its own 16px bottom margin; -12 here plus wrap's 20 leaves 24px above Continue.
  note: { marginTop: 20, marginBottom: -12 },
})
