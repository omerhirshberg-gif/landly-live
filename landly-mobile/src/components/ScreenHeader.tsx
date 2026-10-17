import { Pressable, StyleSheet, View } from 'react-native'
import { router, type Href } from 'expo-router'
import AppText from './AppText'
import LineIcon from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors } from '../theme'

// The settings stack's header: a 44pt back button on the leading side (its
// chevron mirrored in Hebrew), the title centred, an equal spacer trailing.
// Back pops the stack, the same as the swipe (lib/pageFlip.ts). The settings
// stack anchors the Settings menu under every sub-screen
// (app/settings/_layout.tsx), so a sub-screen always pops back to it; with
// nothing under it at all (a deep link straight into Settings) back goes to
// `fallback`. Sits under the screen's own top safe-area inset.
export default function ScreenHeader({ title, fallback = '/settings' }: { title: string; fallback?: Href }) {
  const { t, isRtl } = useLang()

  const goBack = () => {
    if (router.canGoBack()) router.back()
    else router.replace(fallback)
  }

  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('settings_back')}
        onPress={goBack}
        hitSlop={8}
        style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
      >
        <LineIcon name="chevronStart" size={24} color={colors.heading} strokeWidth={2.2} flip={isRtl} />
      </Pressable>
      <AppText accessibilityRole="header" numberOfLines={1} style={styles.title}>
        {title}
      </AppText>
      <View style={styles.spacer} />
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: 8 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', ...webOnly({ cursor: 'pointer' }) },
  backPressed: { backgroundColor: colors.borderLight },
  // textAlign overrides AppText's reading-direction alignment: the title is centred in every language.
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.heading, textAlign: 'center' },
  spacer: { width: 44 },
})
