import { type Href, router, Stack, usePathname } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useRef, useState } from 'react'
import { I18nManager, StyleSheet, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ONB, UNLOCK } from '@shared/brand/onboardingMotion'
import { AuthProvider } from '@shared/firebase/AuthProvider'
import { WishlistProvider } from '@shared/firebase/WishlistProvider'
import { useAuth } from '@shared/firebase/useAuth'
import { AppLockOverlay, AppLockProvider, useAppLock } from '../auth/AppLock'
import { SignInGateProvider, useSignInGate } from '../auth/SignInGate'
import { AvatarPeekProvider } from '../components/AvatarViewer'
import DevEnvironmentBadge from '../components/DevEnvironmentBadge'
import { EntranceProvider } from '../components/Entrance'
import SplashScreen, { type Handoff } from '../components/SplashScreen'
import { LangProvider, useLang } from '../i18n/LangProvider'
import { clearPendingDeepLink, pendingDeepLink } from '../lib/deepLinks'
import { pageFlipOptions } from '../lib/pageFlip'
import { colors } from '../theme'

// Native RTL is disabled (expo-localization plugin in app.json), so the app
// starts LTR even on a Hebrew device. Direction comes only from the chosen
// language: the root view below sets `direction`, which Yoga applies to the
// whole tree — rows, start/end margins and the tab bar flip together.
I18nManager.allowRTL(false)

const UNLOCK_EASE = Easing.bezier(...UNLOCK.curve)

export default function RootLayout() {
  return (
    // Gesture Handler's root, for gestures outside modals (the avatar's long-press peek).
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <LangProvider>
          <AuthProvider>
            {/* The website's wishlist, live from the member's user document, so a
                perk saved on either side shows up on the other */}
            <WishlistProvider>
              <SignInGateProvider>
                {/* The Face ID / fingerprint lock over a saved session: on by default, off in Privacy & Security. */}
                <AppLockProvider>
                  <EntranceProvider>
                    {/* Draws an avatar's long-press peek above every screen. */}
                    <AvatarPeekProvider>
                      <RootNavigator />
                    </AvatarPeekProvider>
                  </EntranceProvider>
                </AppLockProvider>
              </SignInGateProvider>
            </WishlistProvider>
          </AuthProvider>
        </LangProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

function RootNavigator() {
  const { user, loading, onboardingComplete } = useAuth()
  const { checking, onboarding } = useSignInGate()
  const { known: lockKnown, locked } = useAppLock()
  const { isRtl, ready: langReady } = useLang()

  // signInCustomer already signs unverified accounts back out; checking
  // emailVerified here too keeps the tabs (whose Firestore reads require a
  // verified customer) from ever mounting without one. A member who hasn't
  // finished onboarding never gets them either: launching with such a saved
  // session opens the login screen, which resumes the wizard.
  const verified = !!user && user.emailVerified
  const signedIn = verified && !checking && !onboarding && onboardingComplete !== false

  // At launch the navigator waits for that answer too, so neither the tabs
  // nor the sign-in form flashes first. Later sign-ins hold the gate with
  // `checking` instead, so the navigator never unmounts once it's up. With
  // the app lock on, it also waits to know the lock, so the tabs never show
  // before the lock screen covers them (or before a session idle for 30
  // days is signed out to the login form). Every screen also waits for the saved
  // language, so the login form and the tabs open in it, never in English first.
  const known = langReady && !loading && (!verified || (onboardingComplete !== null && lockKnown))
  // A latch: once known, the navigator stays up (set during render, not in an effect).
  const [booted, setBooted] = useState(false)
  if (known && !booted) setBooted(true)
  const ready = booted || known

  // The splash intro (0–2950ms) gets the UI thread to itself: the screens,
  // and the lock over them, mount only once it has played, so creating the
  // tab bar, Home's cards and their images never drops its frames.
  const [introDone, setIntroDone] = useState(false)
  const handleIntroDone = useCallback(() => setIntroDone(true), [])
  const screensUp = ready && introDone
  // Where the splash logo lands: the login hero, the lock's header, or (signed
  // in and unlocked) nowhere.
  const handoff: Handoff = !signedIn ? 'login' : locked ? 'lock' : 'none'

  // Unlocking: from UNLOCK.revealDelayMs the screens rise UNLOCK.risePx and
  // fade in, landing as the lock screen finishes dissolving (AppLock.tsx).
  // They're reset the moment the lock engages, under it, so nothing remounts.
  // The fade is a veil in the canvas colour lifting off the screens, never
  // their own opacity: UIKit's materials (the iOS tab bar's Liquid Glass)
  // render wrong or not at all under an ancestor with alpha below 1.
  const reveal = useSharedValue(1)
  const wasLocked = useRef(false)
  useEffect(() => {
    if (locked) reveal.set(0)
    else if (wasLocked.current) {
      const ms = UNLOCK.ms - UNLOCK.revealDelayMs
      reveal.set(withDelay(UNLOCK.revealDelayMs, withTiming(1, { duration: ms, easing: UNLOCK_EASE })))
    }
    wasLocked.current = locked
  }, [locked, reveal])
  const riseStyle = useAnimatedStyle(() => ({ transform: [{ translateY: UNLOCK.risePx * (1 - reveal.get()) }] }))
  const veilStyle = useAnimatedStyle(() => ({ opacity: 1 - reveal.get() }))

  // An offer or voucher link (app/+native-intent.tsx) that arrived signed out
  // was bounced to sign-in by Stack.Protected; open it once the member is in.
  // One that reached its screen directly is simply forgotten.
  const pathname = usePathname()
  useEffect(() => {
    if (pathname === pendingDeepLink()) clearPendingDeepLink()
  }, [pathname])
  const sawSignedOut = useRef(false)
  useEffect(() => {
    if (!screensUp) return
    if (!signedIn) {
      sawSignedOut.current = true
      return
    }
    const target = pendingDeepLink()
    clearPendingDeepLink()
    if (target && sawSignedOut.current) router.push(target as Href)
    sawSignedOut.current = false
  }, [screensUp, signedIn])

  // The splash plays its intro, waits for auth, hands over, then removes itself.
  const [splashDone, setSplashDone] = useState(false)
  const handleSplashDone = useCallback(() => setSplashDone(true), [])

  return (
    <View style={[styles.root, { direction: isRtl ? 'rtl' : 'ltr' }]}>
      <StatusBar style="dark" />
      {/* Every pushed screen can be swiped back; the page-flip screens below add the full-screen drag. */}
      <Animated.View style={[styles.root, riseStyle]}>
        {screensUp && (
          <Stack screenOptions={{ headerShown: false, gestureEnabled: true, contentStyle: { backgroundColor: colors.background } }}>
            <Stack.Protected guard={signedIn}>
              {/* Signing in (or finishing onboarding) fades into the tabs instead of sliding. */}
              <Stack.Screen name="(tabs)" options={{ animation: 'fade', animationDuration: ONB.screenInMs }} />
              {/* The Profile tab's gear pushes Settings over the tabs; a swipe turns it back. */}
              <Stack.Screen name="settings" options={pageFlipOptions(isRtl)} />
              {/* A category tile (Perks grid, Home rail) opens its folder the same way. */}
              <Stack.Screen name="category/[category]" options={pageFlipOptions(isRtl)} />
              {/* A My Pass card's "View Voucher" opens the voucher on its own screen. */}
              <Stack.Screen name="voucher/[voucherId]" options={pageFlipOptions(isRtl)} />
              {/* A perk card opens its offer natively, never in the browser (lib/openOffer.ts). */}
              <Stack.Screen name="offer/[offerId]" options={pageFlipOptions(isRtl)} />
              {/* The offer's Buy opens checkout in the app too; a purchase replaces it with the confirmation. */}
              <Stack.Screen name="checkout/[offerId]" options={pageFlipOptions(isRtl)} />
              <Stack.Screen name="order-success/[orderId]" options={pageFlipOptions(isRtl)} />
            </Stack.Protected>
            <Stack.Protected guard={!signedIn}>
              <Stack.Screen name="(auth)" />
            </Stack.Protected>
          </Stack>
        )}
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.veil, veilStyle]} />
      {/* Above the screens, under the splash (its zIndex outranks the lock's). */}
      {screensUp && <AppLockOverlay />}
      {!splashDone && <SplashScreen ready={screensUp} handoff={handoff} onIntroDone={handleIntroDone} onDone={handleSplashDone} />}
      {__DEV__ && <DevEnvironmentBadge />}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  veil: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.background },
})
