import { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  cubicBezier,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { glideToLockup, LOCK_GLIDE_SPRING } from '@shared/brand/entranceTimeline'
import BrandHero, { LOCKUP_HEIGHT, LOCKUP_SCALE } from './BrandHero'
import { ENTRANCE_SPRING, useEntrance, type Rect } from './Entrance'
import { colors } from '../theme'

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1)
// CSS-animation easing must be a Reanimated cubicBezier(), never a CSS string.
const PULSE_EASE = cubicBezier(0.42, 0, 0.58, 1)
// How long to wait for the screen underneath to report where its logo sits
// before giving up on the glide and crossfading instead.
const HANDOFF_TIMEOUT_MS = 1200
// A glide normally ends on its spring's callback; whatever happens to that,
// the splash (and its logo) is gone by this long after the glide starts, so
// it can never be left over the screen underneath.
const GLIDE_MAX_MS = 1600
export const SPLASH_Z = 1100

/** Where the splash logo goes: the login hero, the app lock's header, or nowhere (the tabs). */
export type Handoff = 'login' | 'lock' | 'none'

// Three dots breathing in sequence; reduced motion keeps them still.
const PULSE = {
  from: { opacity: 0.25, transform: [{ scale: 0.8 }] },
  to: { opacity: 1, transform: [{ scale: 1 }] },
}

// Branded launch overlay. BrandHero plays its staged intro (star, arrow,
// slogan, shine) with the UI thread to itself: the screens only mount once
// it reports done (`onIntroDone`, see _layout.tsx). Then, once `ready` (the
// screens are up), the hero glides to where the screen underneath shows its
// logo while the backdrop fades, so the splash and that screen read as one
// continuous scene: the login hero at the same size, or the app lock's
// header lockup, settling to LOCKUP_SCALE as the slogan fades. Signed in
// and unlocked, there's no logo to land on: it crossfades into the tabs.
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
  const { phase, heroRect, lockRect, setPhase } = useEntrance()
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
  const tx = useSharedValue(0)
  const ty = useSharedValue(0)
  const scale = useSharedValue(1)
  const sloganFade = useSharedValue(1)
  const backdrop = useSharedValue(1)
  const overlay = useSharedValue(1)

  useEffect(() => {
    if (!ready || !introDone || started.current) return
    // Once only, whichever ends it first: the animation's callback or the timer.
    const finish = () => {
      if (finished.current) return
      finished.current = true
      setPhase('done')
      onDone()
    }
    const fadeOut = () => {
      started.current = true
      setPhase('settling')
      overlay.set(withTiming(0, { duration: 320, easing: EASE_OUT }, (fin) => fin && scheduleOnRN(finish)))
    }
    const from = splashRect.current
    const target = handoff === 'login' ? heroRect : handoff === 'lock' ? lockRect : null
    if (target && from && !reduced) {
      started.current = true
      setPhase('settling')
      // Not cleared when this effect re-runs (the lock may open mid-glide): only on unmount.
      glideTimer.current = setTimeout(finish, GLIDE_MAX_MS)
      backdrop.set(withTiming(0, { duration: 380, easing: EASE_OUT }))
      if (handoff === 'login') {
        tx.set(withSpring(target.x - from.x, ENTRANCE_SPRING))
        ty.set(withSpring(target.y - from.y, ENTRANCE_SPRING, (fin) => fin && scheduleOnRN(finish)))
        return
      }
      // Scaling about the hero's centre moves the lockup (its top part) too.
      const to = glideToLockup(from, target, LOCKUP_HEIGHT, LOCKUP_SCALE)
      sloganFade.set(withTiming(0, { duration: 200, easing: EASE_OUT }))
      scale.set(withSpring(LOCKUP_SCALE, LOCK_GLIDE_SPRING))
      tx.set(withSpring(to.x, LOCK_GLIDE_SPRING))
      ty.set(withSpring(to.y, LOCK_GLIDE_SPRING, (fin) => fin && scheduleOnRN(finish)))
      return
    }
    // Reduced motion lands here too: no glide, just a crossfade into the screen.
    if (target || handoff === 'none' || reduced) return fadeOut()
    const timer = setTimeout(fadeOut, HANDOFF_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [ready, introDone, handoff, heroRect, lockRect, reduced, setPhase, onDone, overlay, backdrop, tx, ty, scale, sloganFade])

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.get() }))
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.get() }))
  const heroStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }],
  }))

  return (
    <Animated.View
      style={[styles.root, overlayStyle]}
      // Once the hand-over starts, the login screen underneath is live.
      pointerEvents={phase === 'splash' ? 'auto' : 'none'}
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
