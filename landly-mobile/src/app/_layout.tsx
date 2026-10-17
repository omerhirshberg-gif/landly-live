import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useState } from 'react'
import { I18nManager, StyleSheet, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ONB } from '@shared/brand/onboardingMotion'
import { AuthProvider } from '@shared/firebase/AuthProvider'
import { WishlistProvider } from '@shared/firebase/WishlistProvider'
import { useAuth } from '@shared/firebase/useAuth'
import { SignInGateProvider, useSignInGate } from '../auth/SignInGate'
import { EntranceProvider } from '../components/Entrance'
import SplashScreen from '../components/SplashScreen'
import { LangProvider, useLang } from '../i18n/LangProvider'
import { pageFlipOptions } from '../lib/pageFlip'
import { colors } from '../theme'

// Native RTL is disabled (expo-localization plugin in app.json), so the app
// starts LTR even on a Hebrew device. Direction comes only from the chosen
// language: the root view below sets `direction`, which Yoga applies to the
// whole tree — rows, start/end margins and the tab bar flip together.
I18nManager.allowRTL(false)

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LangProvider>
        <AuthProvider>
          {/* The website's wishlist, live from the member's user document, so a
              perk saved on either side shows up on the other */}
          <WishlistProvider>
            <SignInGateProvider>
              <EntranceProvider>
                <RootNavigator />
              </EntranceProvider>
            </SignInGateProvider>
          </WishlistProvider>
        </AuthProvider>
      </LangProvider>
    </SafeAreaProvider>
  )
}

function RootNavigator() {
  const { user, loading, onboardingComplete } = useAuth()
  const { checking, onboarding } = useSignInGate()
  const { isRtl } = useLang()

  // signInCustomer already signs unverified accounts back out; checking
  // emailVerified here too keeps the tabs (whose Firestore reads require a
  // verified customer) from ever mounting without one. A member who hasn't
  // finished onboarding never gets them either: launching with such a saved
  // session opens the login screen, which resumes the wizard.
  const verified = !!user && user.emailVerified
  const signedIn = verified && !checking && !onboarding && onboardingComplete !== false

  // At launch the navigator waits for that answer too, so neither the tabs
  // nor the sign-in form flashes first. Later sign-ins hold the gate with
  // `checking` instead, so the navigator never unmounts once it's up.
  const known = !loading && (!verified || onboardingComplete !== null)
  const [booted, setBooted] = useState(false)
  useEffect(() => {
    if (known) setBooted(true)
  }, [known])
  const ready = booted || known

  // The splash plays its intro, waits for auth, hands over, then removes itself.
  const [splashDone, setSplashDone] = useState(false)
  const handleSplashDone = useCallback(() => setSplashDone(true), [])

  return (
    <View style={[styles.root, { direction: isRtl ? 'rtl' : 'ltr' }]}>
      <StatusBar style="dark" />
      {ready && (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Protected guard={signedIn}>
            {/* Signing in (or finishing onboarding) fades into the tabs instead of sliding. */}
            <Stack.Screen name="(tabs)" options={{ animation: 'fade', animationDuration: ONB.screenInMs }} />
            {/* The Profile tab's gear pushes Settings over the tabs; a swipe turns it back. */}
            <Stack.Screen name="settings" options={pageFlipOptions(isRtl)} />
            {/* A category tile (Perks grid, Home rail) opens its folder the same way. */}
            <Stack.Screen name="category/[category]" options={pageFlipOptions(isRtl)} />
            {/* So does the heart at the end of the Perks search row. */}
            <Stack.Screen name="wishlist" options={pageFlipOptions(isRtl)} />
          </Stack.Protected>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
        </Stack>
      )}
      {!splashDone && <SplashScreen ready={ready} onDone={handleSplashDone} />}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
})
