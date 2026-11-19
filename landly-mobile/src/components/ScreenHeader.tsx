import { StyleSheet, View } from 'react-native'
import { router, type Href } from 'expo-router'
import AppText from './AppText'
import GlassBackButton from './GlassBackButton'
import { useLang } from '../i18n/LangProvider'
import { colors } from '../theme'

const DEV_SIDE = 132

// The settings stack's header: the glass back button on the leading side
// (components/GlassBackButton.tsx, its chevron mirrored in Hebrew), the title
// centred, an equal spacer trailing. A screen that heads its own content leaves the title out.
// Back pops the stack, the same as the swipe (lib/pageFlip.ts). The settings
// stack anchors the Settings menu under every sub-screen
// (app/settings/_layout.tsx), so a sub-screen always pops back to it; with
// nothing under it at all (a deep link straight into Settings) back goes to
// `fallback`. `onBack` replaces the pop (the order confirmation goes to My Pass).
// Sits under the screen's own top safe-area inset.
export default function ScreenHeader({ title, fallback = '/settings', onBack }: { title?: string; fallback?: Href; onBack?: () => void }) {
  const { t } = useLang()

  return (
    <View style={styles.bar}>
      {/* A titled header holds equal side slots, so the centred title never reaches the back button or a development build's DEV pill. */}
      <View style={title ? styles.side : undefined}>
        <GlassBackButton label={t('settings_back')} onPress={() => (onBack ? onBack() : goBack(fallback))} />
      </View>
      {!!title && (
        <>
          <AppText accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.title}>
            {title}
          </AppText>
          <View style={styles.side} />
        </>
      )}
    </View>
  )
}

/** Back for a pushed screen, also for one that floats its button over its picture. */
export function goBack(fallback: Href) {
  if (router.canGoBack()) router.back()
  else router.replace(fallback)
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: 8 },
  // textAlign overrides AppText's reading-direction alignment: the title is centred in every language.
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.heading, textAlign: 'center' },
  // 48pt each side; development builds widen both so the DEV pill (components/DevEnvironmentBadge.tsx) has room at the trailing edge.
  side: { width: __DEV__ ? DEV_SIDE : 48 },
})
