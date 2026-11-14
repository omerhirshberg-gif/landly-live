import { useCallback, useEffect, useRef } from 'react'
import { BackHandler, Platform } from 'react-native'
import { useFocusEffect } from 'expo-router'

// Android's back button and system back gesture for a screen that must not be
// left by accident (checkout, order success, the sign-in and onboarding cards,
// the app lock). `handler` returns true when it dealt with the press (nothing
// else runs, so the screen isn't popped), false to leave it to the navigator.
// Listeners run last-registered first, ahead of the navigator's own. iOS and
// the web have no such button: a no-op there.

function useLatest<T>(value: T) {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  })
  return ref
}

/** For a pushed screen: active only while the screen is focused, so a screen under it never answers. */
export function useFocusedBackGuard(handler: () => boolean, enabled = true) {
  const latest = useLatest(handler)
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android' || !enabled) return
      const sub = BackHandler.addEventListener('hardwareBackPress', () => latest.current())
      return () => sub.remove()
    }, [enabled, latest])
  )
}

/** For anything outside a navigator screen (the app lock overlay) or a card inside one. */
export function useBackGuard(handler: () => boolean, enabled = true) {
  const latest = useLatest(handler)
  useEffect(() => {
    if (Platform.OS !== 'android' || !enabled) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => latest.current())
    return () => sub.remove()
  }, [enabled, latest])
}
