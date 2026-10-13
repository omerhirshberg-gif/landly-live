import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useState } from 'react'
import { I18nManager, StyleSheet, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider } from '@shared/firebase/AuthProvider'
import { useAuth } from '@shared/firebase/useAuth'
import { SignInGateProvider, useSignInGate } from '../auth/SignInGate'
import { EntranceProvider } from '../components/Entrance'
import SplashScreen from '../components/SplashScreen'
import { LangProvider, useLang } from '../i18n/LangProvider'
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
          <SignInGateProvider>
            <EntranceProvider>
              <RootNavigator />
            </EntranceProvider>
          </SignInGateProvider>
        </AuthProvider>
      </LangProvider>
    </SafeAreaProvider>
  )
}

function RootNavigator() {
  const { user, loading } = useAuth()
  const { checking } = useSignInGate()
  const { isRtl } = useLang()

  // signInCustomer already signs unverified accounts back out; checking
  // emailVerified here too keeps the tabs (whose Firestore reads require a
  // verified customer) from ever mounting without one.
  const signedIn = !!user && user.emailVerified && !checking

  // The splash plays its intro, waits for auth, hands over, then removes itself.
  const [splashDone, setSplashDone] = useState(false)
  const handleSplashDone = useCallback(() => setSplashDone(true), [])

  return (
    <View style={[styles.root, { direction: isRtl ? 'rtl' : 'ltr' }]}>
      <StatusBar style="dark" />
      {!loading && (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Protected guard={signedIn}>
            <Stack.Screen name="(tabs)" />
          </Stack.Protected>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
        </Stack>
      )}
      {!splashDone && <SplashScreen ready={!loading} onDone={handleSplashDone} />}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
})
