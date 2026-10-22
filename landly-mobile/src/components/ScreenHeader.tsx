import { StyleSheet, View } from 'react-native'
import { router, type Href } from 'expo-router'
import AppText from './AppText'
import GlassBackButton from './GlassBackButton'
import { useLang } from '../i18n/LangProvider'
import { colors } from '../theme'

// The settings stack's header: the glass back button on the leading side
// (components/GlassBackButton.tsx, its chevron mirrored in Hebrew), the title
// centred, an equal spacer trailing.
// Back pops the stack, the same as the swipe (lib/pageFlip.ts). The settings
// stack anchors the Settings menu under every sub-screen
// (app/settings/_layout.tsx), so a sub-screen always pops back to it; with
// nothing under it at all (a deep link straight into Settings) back goes to
// `fallback`. Sits under the screen's own top safe-area inset.
export default function ScreenHeader({ title, fallback = '/settings' }: { title: string; fallback?: Href }) {
  const { t } = useLang()

  const goBack = () => {
    if (router.canGoBack()) router.back()
    else router.replace(fallback)
  }

  return (
    <View style={styles.bar}>
      <GlassBackButton label={t('settings_back')} onPress={goBack} />
      <AppText accessibilityRole="header" numberOfLines={1} style={styles.title}>
        {title}
      </AppText>
      <View style={styles.spacer} />
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: 8 },
  // textAlign overrides AppText's reading-direction alignment: the title is centred in every language.
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.heading, textAlign: 'center' },
  spacer: { width: 48 },
})
