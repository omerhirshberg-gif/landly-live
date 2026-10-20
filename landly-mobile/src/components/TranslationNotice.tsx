import { Pressable, StyleSheet, View } from 'react-native'
import AppText from './AppText'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors } from '../theme'

// "Translated by Google · Show original" under machine-translated content,
// the switch flipping to "Show translation" (website:
// components/ui/TranslationNotice.tsx). The row follows the app's direction;
// shown only when something on screen is Google's wording.
export default function TranslationNotice({ showingOriginal, onToggle }: { showingOriginal: boolean; onToggle: () => void }) {
  const { t } = useLang()
  return (
    <View style={styles.row}>
      <AppText style={styles.text}>{`${t('content_translated_by_google')} ·`}</AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: showingOriginal }}
        hitSlop={12}
        onPress={onToggle}
        style={({ pressed }) => [pressed && styles.pressed, webOnly({ cursor: 'pointer' })]}
      >
        <AppText style={styles.link}>{showingOriginal ? t('content_show_translation') : t('content_show_original')}</AppText>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6, marginTop: 8 },
  text: { fontSize: 12, lineHeight: 18, color: colors.textFaint },
  link: { fontSize: 12, lineHeight: 18, fontWeight: '600', color: colors.brand },
  pressed: { opacity: 0.6 },
})
