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
import BrandHero from './BrandHero'
import { ENTRANCE_SPRING, useEntrance, type Rect } from './Entrance'
import { colors } from '../theme'

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1)
// CSS-animation easing must be a Reanimated cubicBezier(), never a CSS string.
const PULSE_EASE = cubicBezier(0.42, 0, 0.58, 1)
// After auth resolves, how long to wait for the login screen to report its
// hero. Signed-in users go to the tabs instead, so none arrives: fade out.
const HERO_GRACE_MS = 300

// Three dots breathing in sequence; reduced motion keeps them still.
const PULSE = {
  from: { opacity: 0.25, transform: [{ scale: 0.8 }] },
  to: { opacity: 1, transform: [{ scale: 1 }] },
}

// Branded launch overlay. BrandHero plays its staged intro (star, arrow,
// slogan + glow, shine); once that has finished and `ready` is true, the
// hero glides to the login screen's hero position while the backdrop fades,
// so splash and sign-in read as one continuous scene.
export default function SplashScreen({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const reduced = useReducedMotion()
  const { phase, heroRect, setPhase } = useEntrance()
  const anchorRef = useRef<View>(null)
  const splashRect = useRef<Rect | null>(null)
  const started = useRef(false)

  const [introDone, setIntroDone] = useState(false)
  const handleIntroDone = useCallback(() => setIntroDone(true), [])
  const tx = useSharedValue(0)
  const ty = useSharedValue(0)
  const backdrop = useSharedValue(1)
  const overlay = useSharedValue(1)

  useEffect(() => {
    if (!ready || !introDone || started.current) return
    const finish = () => {
      setPhase('done')
      onDone()
    }
    const fadeOut = () => {
      started.current = true
      setPhase('settling')
      overlay.set(withTiming(0, { duration: 320, easing: EASE_OUT }, (fin) => fin && scheduleOnRN(finish)))
    }
    const from = splashRect.current
    if (heroRect && from && !reduced) {
      started.current = true
      setPhase('settling')
      backdrop.set(withTiming(0, { duration: 380, easing: EASE_OUT }))
      tx.set(withSpring(heroRect.x - from.x, ENTRANCE_SPRING))
      ty.set(withSpring(heroRect.y - from.y, ENTRANCE_SPRING, (fin) => fin && scheduleOnRN(finish)))
      return
    }
    // Reduced motion lands here too: no glide, just a crossfade into the screen.
    if (heroRect || reduced) return fadeOut()
    const timer = setTimeout(fadeOut, HERO_GRACE_MS)
    return () => clearTimeout(timer)
  }, [ready, introDone, heroRect, reduced, setPhase, onDone, overlay, backdrop, tx, ty])

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.get() }))
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.get() }))
  const heroStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }],
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
          <BrandHero intro onIntroDone={handleIntroDone} />
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
    zIndex: 10,
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
