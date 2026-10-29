import { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import Animated, {
  cubicBezier,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as NativeSplash from 'expo-splash-screen'
import { glideToLockup, SPLASH_RELEASE_MS, splashGlideBackstopMs } from '@shared/brand/entranceTimeline'
import BrandHero, { HERO, LOCKUP_HEIGHT, LOCKUP_SCALE } from './BrandHero'
import { useEntrance, type Rect } from './Entrance'
import {
  BACKDROP_OUT,
  GLIDE,
  glideRemainingPx,
  LOCK_LAYOUT_WAIT_MS,
  lockupTarget,
  RELEASE_PX,
  RETARGET_SPRING,
  SLOGAN_OUT,
} from '../lib/splashMotion'
import { useGlideFrameProbe } from '../lib/useGlideFrameProbe'
import { colors } from '../theme'

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1)
// CSS-animation easing must be a Reanimated cubicBezier(), never a CSS string.
const PULSE_EASE = cubicBezier(0.42, 0, 0.58, 1)
// How long to wait for the screen underneath to report where its logo sits
// before giving up on the glide and crossfading instead.
const HANDOFF_TIMEOUT_MS = 1200
// A glide normally ends on its landing; whatever happens to that, it's
// released this long after it starts, so the splash (and its logo) can
// never be left over the screen underneath. Past the spring's own settle, so
// it never cuts a glide that is merely running a few frames late.
const GLIDE_MAX_MS = splashGlideBackstopMs(Math.max(GLIDE.login.duration, GLIDE.lock.duration))
export const SPLASH_Z = 1100

/** Where the splash logo goes: the login hero, the app lock's header, or nowhere (the tabs). */
export type Handoff = 'login' | 'lock' | 'none'

// The app lock's header lockup (AppLock.tsx: BrandLockup at LOCKUP_SCALE).
const LOCKUP_BOX = { width: HERO.width * LOCKUP_SCALE, height: LOCKUP_HEIGHT * LOCKUP_SCALE }

/** The translation that lands the splash hero on `target`. */
function landing(handoff: 'login' | 'lock', from: Rect, target: Rect): { x: number; y: number } {
  if (handoff === 'login') return { x: target.x - from.x, y: target.y - from.y }
  // Scaling about the hero's centre moves the lockup (its top part) too.
  const to = glideToLockup(from, target, LOCKUP_HEIGHT, LOCKUP_SCALE)
  return to
}

// Three dots breathing in sequence; reduced motion keeps them still.
const PULSE = {
  from: { opacity: 0.25, transform: [{ scale: 0.8 }] },
  to: { opacity: 1, transform: [{ scale: 1 }] },
}

// Branded launch overlay. BrandHero plays its staged intro (star, arrow,
// slogan, shine) with the UI thread to itself: the screens only mount once
// it reports done (`onIntroDone`, see _layout.tsx). The lock screen is the
// exception: it mounts under the splash as soon as the launch is known to be
// locked, so it is laid out and measured before the glide rather than being
// created on the glide's first frames. Then, once `ready` (the screens are
// up), the hero glides to where the screen underneath shows its logo while
// the backdrop fades, so the splash and that screen read as one continuous
// scene: the login hero at the same size, or the app lock's header lockup,
// settling to LOCKUP_SCALE as the slogan fades. Signed in and unlocked,
// there's no logo to land on: it crossfades into the tabs.
//
// The glide is one critically damped spring on a progress value `p`
// (src/lib/splashMotion.ts), shared through Entrance.tsx: the translation,
// the scale and the backdrop here, and the lock screen's rise, are all read
// off it on the UI thread, so they move as one with no React render between
// the start and the landing. Into the lock it starts once the lock has
// reported its lockup's spot and a frame has passed (or, after
// LOCK_LAYOUT_WAIT_MS, toward the spot predicted from its fixed layout); a
// spot measured mid-glide bends the path to it (`goal`, then `to` springing
// after it) instead of being ignored and snapping at the end. The screen's
// own logo takes over once less than RELEASE_PX of travel is left with the
// path on its goal, not after the spring's long invisible tail: in that same
// UI-thread frame the glide is settled onto the spot exactly, `landed`
// shows the screen's own logo and the splash starts fading off it, so the
// two logos crossfade pixel on pixel without a round trip through JS.
export default function SplashScreen({
  ready,
  handoff,
  onIntroDone,
  onDone,
}: {
  ready: boolean
  handoff: Handoff
  onIntroDone: () => void
  onDone: () => void
}) {
  const reduced = useReducedMotion()
  const { phase, heroRect, lockRect, setPhase, glide: p, landed } = useEntrance()
  const window = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const anchorRef = useRef<View>(null)
  const splashRect = useRef<Rect | null>(null)
  const started = useRef(false)
  const finished = useRef(false)
  const glideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (glideTimer.current) clearTimeout(glideTimer.current)
  }, [])

  const [introDone, setIntroDone] = useState(false)
  const handleIntroDone = useCallback(() => {
    setIntroDone(true)
    onIntroDone()
  }, [onIntroDone])
  // Where the glide ends (`to` follows `goal` when a new spot arrives); its progress is `p`.
  const toX = useSharedValue(0)
  const toY = useSharedValue(0)
  const goalX = useSharedValue(0)
  const goalY = useSharedValue(0)
  const toScale = useSharedValue(1)
  const sloganFade = useSharedValue(1)
  const overlay = useSharedValue(1)
  // Which glide is running, for a late landing spot to retarget.
  const gliding = useRef<'login' | 'lock' | null>(null)
  // The hand-over, set once the glide starts; the release reaction calls it
  // with the splash already fading (it started on the UI thread).
  const finishRef = useRef<(fading: boolean) => void>(() => {})
  const release = useCallback(() => finishRef.current(true), [])
  // Into the lock: its measured spot hasn't come in time, so the predicted one is used.
  const [lockWaitOver, setLockWaitOver] = useState(false)
  useGlideFrameProbe(p, handoff)

  // The native launch screen (expo-splash-screen, app.json) stays up until
  // the splash has drawn its first frame on the same canvas colour, then
  // fades: the intro starts from it, never from a blank or white flash.
  const nativeHidden = useRef(false)
  const hideNativeSplash = useCallback(() => {
    if (nativeHidden.current) return
    nativeHidden.current = true
    NativeSplash.hide()
  }, [])

  useEffect(() => {
    if (!ready || !introDone || started.current) return
    // Once only, whichever ends it first: the animation's callback or the timer.
    // The screen's own logo shows under the splash's (phase 'done'), then the
    // splash fades off it and unmounts.
    const finish = (fading: boolean) => {
      if (finished.current) return
      finished.current = true
      landed.set(1)
      setPhase('done')
      if (!fading) overlay.set(withTiming(0, { duration: SPLASH_RELEASE_MS, easing: EASE_OUT }))
      setTimeout(onDone, SPLASH_RELEASE_MS)
    }
    finishRef.current = finish
    const fadeOut = () => {
      started.current = true
      // The screen's own content shows under the crossfade, not after it.
      landed.set(1)
      setPhase('settling')
      overlay.set(withTiming(0, { duration: 320, easing: EASE_OUT }, (fin) => fin && scheduleOnRN(finish, true)))
    }
    const from = splashRect.current
    // The lock reports its spot from under the splash; if that's late, its fixed layout predicts it.
    const lockTarget = lockRect ?? (lockWaitOver ? lockupTarget(window, insets, LOCKUP_BOX) : null)
    const target = handoff === 'login' ? heroRect : handoff === 'lock' ? lockTarget : null
    if (handoff !== 'none' && target && from && !reduced) {
      const glideTo = handoff
      // A frame after the spot is known: whatever was mounted with it has reached the screen.
      const frame = requestAnimationFrame(() => {
        started.current = true
        gliding.current = glideTo
        setPhase('settling')
        // Not cleared when this effect re-runs (the lock may open mid-glide): only on unmount.
        glideTimer.current = setTimeout(() => finish(false), GLIDE_MAX_MS)
        const to = landing(glideTo, from, target)
        goalX.set(to.x)
        goalY.set(to.y)
        toX.set(to.x)
        toY.set(to.y)
        if (glideTo === 'lock') {
          toScale.set(LOCKUP_SCALE)
          sloganFade.set(withTiming(0, { duration: GLIDE.lock.duration * SLOGAN_OUT, easing: EASE_OUT }))
        }
        p.set(withSpring(1, GLIDE[glideTo]))
      })
      return () => cancelAnimationFrame(frame)
    }
    if (handoff === 'lock' && from && !reduced && !lockWaitOver) {
      const timer = setTimeout(() => setLockWaitOver(true), LOCK_LAYOUT_WAIT_MS)
      return () => clearTimeout(timer)
    }
    // Reduced motion lands here too: no glide, just a crossfade into the screen.
    if (target || handoff === 'none' || reduced) return fadeOut()
    const timer = setTimeout(fadeOut, HANDOFF_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [ready, introDone, handoff, heroRect, lockRect, lockWaitOver, reduced, window, insets, setPhase, onDone, overlay, p, landed, toX, toY, goalX, goalY, toScale, sloganFade])

  // A spot measured after the glide started (the lock screen laid out, its
  // insets settled): the path bends to it rather than landing off it.
  useEffect(() => {
    const kind = gliding.current
    const from = splashRect.current
    const target = kind === 'login' ? heroRect : kind === 'lock' ? lockRect : null
    if (!kind || !from || !target || finished.current) return
    const to = landing(kind, from, target)
    goalX.set(to.x)
    goalY.set(to.y)
    toX.set(withSpring(to.x, RETARGET_SPRING))
    toY.set(withSpring(to.y, RETARGET_SPRING))
  }, [heroRect, lockRect, toX, toY, goalX, goalY])

  // Landed: under half a pixel to go, on the path's goal. In this one frame:
  // settled exactly onto it (cancelling the spring's invisible tail), the
  // screen's own logo shown under the splash's and the splash fading off it;
  // JS hears of it afterwards, only to unmount the splash.
  useAnimatedReaction(
    () =>
      p.get() > 0 &&
      glideRemainingPx(p.get(), toX.get(), toY.get(), toScale.get() - 1, HERO.width) < RELEASE_PX &&
      Math.abs(toX.get() - goalX.get()) < RELEASE_PX &&
      Math.abs(toY.get() - goalY.get()) < RELEASE_PX,
    (arrived, was) => {
      if (!arrived || was) return
      p.set(1)
      toX.set(goalX.get())
      toY.set(goalY.get())
      landed.set(1)
      overlay.set(withTiming(0, { duration: SPLASH_RELEASE_MS, easing: EASE_OUT }))
      scheduleOnRN(release)
    }
  )

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.get() }))
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.get(), [BACKDROP_OUT[0], BACKDROP_OUT[1]], [1, 0], Extrapolation.CLAMP),
  }))
  const heroStyle = useAnimatedStyle(() => {
    const progress = p.get()
    return {
      transform: [
        { translateX: toX.get() * progress },
        { translateY: toY.get() * progress },
        { scale: 1 + (toScale.get() - 1) * progress },
      ],
    }
  })

  return (
    <Animated.View
      style={[styles.root, overlayStyle]}
      // Once the hand-over starts, the login screen underneath is live.
      pointerEvents={phase === 'splash' ? 'auto' : 'none'}
      onLayout={hideNativeSplash}
      accessibilityRole="progressbar"
      accessibilityLabel="Landly"
    >
      <Animated.View style={[styles.backdrop, backdropStyle]} />

      {/* The anchor is never transformed, so measuring it gives the hero's
          resting spot — not the mid-spring scaled box. */}
      <View
        ref={anchorRef}
        collapsable={false}
        onLayout={() =>
          anchorRef.current?.measureInWindow((x, y, width, height) => {
            splashRect.current = { x, y, width, height }
          })
        }
      >
        <Animated.View style={heroStyle}>
          <BrandHero intro onIntroDone={handleIntroDone} sloganFade={sloganFade} />
        </Animated.View>
      </View>

      {/* The intro is the loading state; the dots only appear if auth is still pending after it. */}
      {introDone && !ready && (
        <Animated.View style={[styles.dots, backdropStyle]}>
          {[0, 1, 2].map((i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                reduced
                  ? styles.dotStill
                  : {
                      animationName: PULSE,
                      animationDuration: 600,
                      animationDelay: i * 160,
                      animationIterationCount: 'infinite',
                      animationDirection: 'alternate',
                      animationTimingFunction: PULSE_EASE,
                      animationFillMode: 'backwards',
                    },
              ]}
            />
          ))}
        </Animated.View>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    // Above the lock screen and the privacy cover (zIndex 1000, AppLock.tsx),
    // which can engage within the intro: the full sequence always plays.
    zIndex: SPLASH_Z,
    elevation: SPLASH_Z,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.background,
  },
  // Out of flow so the hero alone is centered on screen.
  dots: { position: 'absolute', top: '50%', marginTop: 132, flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },
  dotStill: { opacity: 0.5 },
})
