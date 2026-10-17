import { StyleSheet, TextInput, View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

// The 44pt search pill on the Perks tab and a category folder (web:
// components/perks/PerksSearchBar.tsx): icon at the start edge, text aligned
// to the reading direction, iOS's own clear button while editing.
export default function PerksSearchField({ value, onChangeText }: { value: string; onChangeText: (next: string) => void }) {
  const { t, isRtl } = useLang()
  return (
    <View style={styles.search}>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.textFaint} strokeWidth={2} strokeLinecap="round">
        <Circle cx="11" cy="11" r="7" />
        <Path d="m20 20-3.5-3.5" />
      </Svg>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={t('cats_search_placeholder')}
        placeholderTextColor={colors.textFaint}
        accessibilityLabel={t('cats_search_placeholder')}
        returnKeyType="search"
        clearButtonMode="while-editing"
        autoCorrect={false}
        style={[styles.input, { textAlign: isRtl ? 'right' : 'left', writingDirection: isRtl ? 'rtl' : 'ltr' }]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  search: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: colors.heading,
    ...webOnly({ outlineStyle: 'none' as never }),
  },
})
