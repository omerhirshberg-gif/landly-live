import { Stack } from 'expo-router'
import { useLang } from '../../i18n/LangProvider'
import { pageFlipOptions } from '../../lib/pageFlip'
import { colors } from '../../theme'

// The settings stack, pushed over the tabs from the Profile tab's gear:
// Settings, then Language & Region (and its Country of origin list), Privacy
// & Security, Support & Help, Terms of Service and Privacy Policy, all native
// screens. Every push is a page flip (lib/pageFlip.ts): a full-screen swipe
// turns it back, in the reading direction of the chosen language. Each
// screen draws its own header (components/ScreenHeader.tsx) with the back button.
//
// Settings is the anchor for deep links: a sub-screen opened from a URL still
// has the Settings menu under it. The Profile tab's Edit buttons push
// without it, so back and the swipe return to Profile, not to Settings.
export const unstable_settings = { anchor: 'index' }

export default function SettingsLayout() {
  const { isRtl } = useLang()
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, ...pageFlipOptions(isRtl) }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="language-region" />
      <Stack.Screen name="origin" />
      <Stack.Screen name="privacy-security" />
      <Stack.Screen name="support" />
      <Stack.Screen name="terms" />
      <Stack.Screen name="privacy" />
    </Stack>
  )
}
