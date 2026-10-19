import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Image, Modal, PixelRatio, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import { BlurView } from 'expo-blur'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  Easing,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'
import { fullSizeAvatarUrl } from '@shared/avatar/avatar'
import { NATIVE_ZOOM_MAX, renderScale } from '@shared/avatar/zoom'
import AppText from './AppText'
import { useLang } from '../i18n/LangProvider'
import { tick } from '../lib/haptics'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

// The member's photo full size, Instagram style (web:
// components/ui/AvatarLightbox.tsx), in two ways:
//
// - Tapped (AvatarViewer): a 300pt circle (smaller on narrow or short
//   screens) over a frosted backdrop. A tap off the photo or Android's back
//   closes it; there's no close button over the view (screen readers get the
//   backdrop as one, and the iOS escape gesture). The Profile tab passes
//   `action` for a "Change photo" button under the photo; `onDismissed` fires
//   once it's fully gone (iOS can't present the photo action sheet over a
//   modal that's still fading out).
// - Long-pressed, or pinched straight away (useAvatarPeek): the same circle
//   for as long as the fingers stay down, then it eases back and fades.
//
// Either way a pinch grows the whole circle up to 5×, freely past the
// screen's edges, and a drag moves it; letting go eases it back, without a
// bounce. The
// source is the full-resolution photo (fullSizeAvatarUrl).

// The ease back on release: decelerating, with no overshoot, so the circle
// lands at rest without bouncing (the web's cubic-bezier(.16, 1, .3, 1)).
const SETTLE = { duration: 320, easing: Easing.bezier(0.16, 1, 0.3, 1) }
/** The backdrop's blur, at full strength. */
const BLUR = 40

type CircleValues = { scale: SharedValue<number>; x: SharedValue<number>; y: SharedValue<number> }

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView)

function useCircleValues(): CircleValues {
  const scale = useSharedValue(1)
  const x = useSharedValue(0)
  const y = useSharedValue(0)
  return useMemo(() => ({ scale, x, y }), [scale, x, y])
}

function settleBack({ scale, x, y }: CircleValues) {
  'worklet'
  scale.value = withTiming(1, SETTLE)
  x.value = withTiming(0, SETTLE)
  y.value = withTiming(0, SETTLE)
}

function useRestingSide() {
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  return Math.max(160, Math.min(width - 48, height - insets.top - insets.bottom - 200, 300))
}

export default function AvatarViewer({
  uri,
  visible,
  onClose,
  action,
  onDismissed,
}: {
  uri: string
  visible: boolean
  onClose: () => void
  action?: { label: string; onPress: () => void }
  onDismissed?: () => void
}) {
  const { t } = useLang()
  const side = useRestingSide()
  const values = useCircleValues()
  const { scale, x, y } = values
  // Which of the pinch and the drag is under way, and where each started.
  const pinching = useSharedValue(false)
  const panning = useSharedValue(false)
  const pinchFrom = useSharedValue(1)
  const panFrom = useSharedValue({ x: 0, y: 0 })

  // Every open starts at rest.
  useEffect(() => {
    if (!visible) return
    scale.value = 1
    x.value = 0
    y.value = 0
  }, [visible, scale, x, y])

  // Anywhere on screen: two fingers pinch the circle, and the pinch (or one finger) carries it.
  const gesture = useMemo(() => {
    const pinch = Gesture.Pinch()
      .onStart(() => {
        pinching.value = true
        pinchFrom.value = scale.value
      })
      .onUpdate((e) => {
        scale.value = Math.min(NATIVE_ZOOM_MAX, Math.max(1, pinchFrom.value * e.scale))
      })
      .onFinalize(() => {
        if (!pinching.value) return
        pinching.value = false
        if (!panning.value) settleBack(values)
      })
    const pan = Gesture.Pan()
      .averageTouches(true)
      .onStart(() => {
        panning.value = true
        panFrom.value = { x: x.value, y: y.value }
      })
      .onUpdate((e) => {
        x.value = panFrom.value.x + e.translationX
        y.value = panFrom.value.y + e.translationY
      })
      .onFinalize(() => {
        if (!panning.value) return
        panning.value = false
        if (!pinching.value) settleBack(values)
      })
    return Gesture.Simultaneous(pinch, pan)
  }, [values, scale, x, y, pinching, panning, pinchFrom, panFrom])

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
      onDismiss={onDismissed}
    >
      {/* A Modal is its own native root: gestures inside it need their own root view (Android). */}
      <GestureHandlerRootView style={styles.root}>
        <GestureDetector gesture={gesture}>
          <View style={styles.stage} accessibilityViewIsModal onAccessibilityEscape={onClose}>
            <Backdrop />
            <ZoomDim scale={scale} />
            {/* The whole backdrop is the way out; screen readers hear it as Close. */}
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('avatar_viewer_close')}
            />
            <PhotoCircle uri={fullSizeAvatarUrl(uri)} side={side} values={values} label={t('avatar_viewer_title')} />
            {action && (
              <Pressable
                accessibilityRole="button"
                onPress={action.onPress}
                style={({ pressed }) => [styles.action, pressed && styles.pressed]}
              >
                <AppText style={styles.actionLabel}>{action.label}</AppText>
              </Pressable>
            )}
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  )
}

// The frosted backdrop: a real blur on iOS and the web build; Android's
// BlurView falls back to its translucent tint (a true blur there needs the
// content behind wrapped in a BlurTargetView). `intensity` may be animated.
function Backdrop({ intensity }: { intensity?: SharedValue<number> }) {
  const animatedProps = useAnimatedProps(() => ({ intensity: intensity ? intensity.value * BLUR : BLUR }))
  return (
    <>
      <AnimatedBlurView tint="dark" intensity={BLUR} animatedProps={animatedProps} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.shade]} />
    </>
  )
}

// Deepens behind the circle as it grows.
function ZoomDim({ scale }: { scale: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, (scale.value - 1) / (NATIVE_ZOOM_MAX - 1))) }))
  return <Animated.View pointerEvents="none" style={[styles.dim, style]} />
}

// The photo's circle, moved and scaled by `values`, clipped round at every
// size. It's laid out larger than it rests (renderScale) and scaled down, so
// the photo is decoded with every pixel the 1024px source has and stays sharp
// however far it grows; negative margins keep its footprint the resting
// size, so the "Change photo" button below doesn't move.
function PhotoCircle({ uri, side, values, label }: { uri: string; side: number; values: CircleValues; label?: string }) {
  const render = renderScale(side, PixelRatio.get(), NATIVE_ZOOM_MAX)
  const laidOut = side * render
  const { scale, x, y } = values
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value / render }],
  }))
  return (
    <Animated.View
      style={[
        styles.frame,
        {
          width: laidOut,
          height: laidOut,
          borderRadius: laidOut / 2,
          margin: -(laidOut - side) / 2,
          // Ring and halo drawn at the laid-out size, so they read 2px / 8px at rest.
          borderWidth: 2 * render,
          boxShadow: `0 0 0 ${8 * render}px rgba(255, 255, 255, 0.06), 0 ${24 * render}px ${64 * render}px rgba(0, 0, 0, 0.45)`,
        },
        style,
      ]}
    >
      <Image source={{ uri }} accessibilityLabel={label} accessible={!!label} style={styles.photo} resizeMode="cover" />
    </Animated.View>
  )
}

// ── The long-press peek ────────────────────────────────────────────────────
//
// The peek has to keep following the fingers that started it on the avatar,
// so it isn't a Modal (a separate touch surface on both platforms, which
// would strand them): AvatarPeekProvider, in the root layout, draws it above
// every screen in the app's own view tree and lets touches through, while the
// avatar's own gesture (useAvatarPeek) drives it.

type Peek = { uri: string; values: CircleValues; fade: SharedValue<number> }

const PeekContext = createContext<(peek: Peek | null) => void>(() => {})

export function AvatarPeekProvider({ children }: { children: ReactNode }) {
  const [peek, setPeek] = useState<Peek | null>(null)
  return (
    <PeekContext.Provider value={setPeek}>
      {children}
      {peek && <PeekOverlay peek={peek} />}
    </PeekContext.Provider>
  )
}

function PeekOverlay({ peek }: { peek: Peek }) {
  const side = useRestingSide()
  const style = useAnimatedStyle(() => ({ opacity: peek.fade.value }))
  // Decorative: the tap-opened viewer is the accessible way to the photo.
  return (
    <View pointerEvents="none" style={styles.peek} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* The blur fades by its intensity: iOS mishandles a blur view's opacity. */}
      <Backdrop intensity={peek.fade} />
      <Animated.View style={[StyleSheet.absoluteFill, styles.stage, style]}>
        <ZoomDim scale={peek.values.scale} />
        <PhotoCircle uri={peek.uri} side={side} values={peek.values} />
      </Animated.View>
    </View>
  )
}

/** A long press opens the peek after this long… */
const PEEK_DELAY_MS = 180

/**
 * Long-press peek for an avatar: wrap it in `<GestureDetector gesture={peek.gesture}>`,
 * call `peek.pressIn()` from its Pressable's onPressIn, and skip its onPress
 * when `peek.wasPeek()`. Holding 180ms opens the peek (with a haptic tick),
 * as does pinching it straight away; while it's open the pinch grows the
 * circle up to 5× and the drag moves it, and when the last finger lifts it
 * eases back and fades out.
 */
export function useAvatarPeek(uri: string | null) {
  const show = useContext(PeekContext)
  const values = useCircleValues()
  const fade = useSharedValue(0)
  const peeking = useSharedValue(false)
  const pinchFrom = useSharedValue(1)
  const panFrom = useSharedValue({ x: 0, y: 0 })
  const pressedAt = useRef(0)
  const peekedAt = useRef(0)
  const source = uri ? fullSizeAvatarUrl(uri) : null

  // Plain JS, called from the gesture worklets on the JS thread.
  const open = () => {
    if (!source) return
    peekedAt.current = Date.now()
    show({ uri: source, values, fade })
    tick()
  }
  const hide = () => show(null)

  const gesture = useMemo(() => {
    const { scale, x, y } = values
    const begin = () => {
      'worklet'
      if (peeking.value) return
      peeking.value = true
      scale.value = 1
      x.value = 0
      y.value = 0
      fade.value = withTiming(1, { duration: 150 })
      scheduleOnRN(open)
    }
    const end = () => {
      'worklet'
      if (!peeking.value) return
      peeking.value = false
      settleBack(values)
      fade.value = withDelay(
        120,
        withTiming(0, { duration: 200 }, (finished) => {
          if (finished) scheduleOnRN(hide)
        })
      )
    }

    // Never activates: it only hears when the last finger on the avatar lifts (or the touch is taken away).
    const enabled = !!source
    const touches = Gesture.Manual().enabled(enabled).onFinalize(end)
    const hold = Gesture.LongPress().enabled(enabled).minDuration(PEEK_DELAY_MS).onStart(begin)
    const pinch = Gesture.Pinch()
      .enabled(enabled)
      .onStart(() => {
        begin()
        pinchFrom.value = scale.value
      })
      .onUpdate((e) => {
        scale.value = Math.min(NATIVE_ZOOM_MAX, Math.max(1, pinchFrom.value * e.scale))
      })
    // Only takes over once the peek is open, so a scroll that starts on the avatar still scrolls.
    const pan = Gesture.Pan()
      .enabled(enabled)
      .averageTouches(true)
      .manualActivation(true)
      .onTouchesMove((_e, manager) => {
        if (peeking.value) manager.activate()
      })
      .onStart((e) => {
        panFrom.value = { x: x.value - e.translationX, y: y.value - e.translationY }
      })
      .onUpdate((e) => {
        x.value = panFrom.value.x + e.translationX
        y.value = panFrom.value.y + e.translationY
      })
    return Gesture.Simultaneous(touches, hold, pinch, pan)
    // open and hide only read refs and the context setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, values, fade, peeking, pinchFrom, panFrom])

  return {
    gesture,
    pressIn: () => {
      pressedAt.current = Date.now()
    },
    /** The press that just ended opened the peek, so it isn't also a tap. */
    wasPeek: () => peekedAt.current >= pressedAt.current && pressedAt.current > 0,
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // overflow stays visible so the circle can grow past the screen's edges.
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  peek: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1000, elevation: 1000, overflow: 'visible' },
  shade: { backgroundColor: 'rgba(0, 0, 0, 0.45)', ...webOnly({ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }) },
  dim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0, 0, 0, 0.35)' },
  // Overflow clips the photo to the circle on Android too.
  frame: {
    overflow: 'hidden',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: colors.borderLight,
  },
  photo: { width: '100%', height: '100%' },
  action: {
    marginTop: 24,
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    ...webOnly({ cursor: 'pointer' }),
  },
  actionLabel: { fontSize: 15, fontWeight: '700', color: colors.brand },
  pressed: { opacity: 0.8 },
})
