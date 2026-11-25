import { useState } from 'react'
import { Pressable, StyleSheet } from 'react-native'
import { countryName, flagEmoji } from '@shared/auth/onboarding'
import { isCountryCode } from '@shared/profile/countryOfOrigin'
import AppText from './AppText'
import CountryOfOriginSheet from './CountryOfOriginSheet'
import DirectionalIcon from './DirectionalIcon'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

// Edit profile's "Country of origin": one selector row (flag, name, a chevron
// at the trailing edge) instead of the open search and list. Tapping it opens
// CountryOfOriginSheet. Nothing is focused until the member taps a field.
export default function OriginSelectRow({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const { t, lang } = useLang()
  const [open, setOpen] = useState(false)
  const chosen = isCountryCode(value) ? value : null
  const name = chosen ? countryName(chosen, lang) : t('profile_origin_select')
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('profile_origin_label')}: ${name}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        {chosen && <AppText style={styles.flag}>{flagEmoji(chosen)}</AppText>}
        <AppText numberOfLines={1} style={[styles.name, !chosen && styles.placeholder]}>
          {name}
        </AppText>
        <DirectionalIcon name="chevronEnd" size={18} color={colors.textFaint} />
      </Pressable>
      <CountryOfOriginSheet visible={open} value={value} onChange={onChange} onClose={() => setOpen(false)} />
    </>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    ...webOnly({ cursor: 'pointer' }),
  },
  pressed: { backgroundColor: colors.brandLight },
  flag: { fontSize: 22 },
  name: { flex: 1, fontSize: 16, color: colors.heading },
  placeholder: { color: colors.textFaint },
})
