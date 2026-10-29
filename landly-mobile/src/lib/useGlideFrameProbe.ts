import { useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

// Development builds only: measures the splash glide (SplashScreen.tsx) on
// the UI thread and logs one line to Metro once it lands, e.g.
//   [glide:lock] 52 frames, worst 9.1ms, 0 dropped (refresh 8.3ms)
// A frame counts as dropped when it took over 1.5x the shortest frame seen
// (the display's refresh interval: 8.3ms on ProMotion, 16.7ms at 60Hz).
// It checks the hand-over on a real device without any screen capture.
const DROPPED_FACTOR = 1.5

function report(label: string, frames: number, worst: number, dropped: number, refresh: number) {
  console.log(`[glide:${label}] ${frames} frames, worst ${worst.toFixed(1)}ms, ${dropped} dropped (refresh ${refresh.toFixed(1)}ms)`)
}

export function useGlideFrameProbe(progress: SharedValue<number>, label: string) {
  const frames = useSharedValue(0)
  const worst = useSharedValue(0)
  const shortest = useSharedValue(Number.POSITIVE_INFINITY)
  const deltas = useSharedValue<number[]>([])
  const done = useSharedValue(false)

  useFrameCallback((frame) => {
    'worklet'
    if (done.get()) return
    const p = progress.get()
    if (p <= 0) return
    const delta = frame.timeSincePreviousFrame
    if (delta !== null && frames.get() > 0) {
      worst.set(Math.max(worst.get(), delta))
      shortest.set(Math.min(shortest.get(), delta))
      deltas.modify((list) => {
        'worklet'
        list.push(delta)
        return list
      })
    }
    frames.set(frames.get() + 1)
    if (p < 1) return
    done.set(true)
    const refresh = shortest.get()
    const dropped = deltas.get().filter((d) => d > refresh * DROPPED_FACTOR).length
    scheduleOnRN(report, label, frames.get(), worst.get(), dropped, Number.isFinite(refresh) ? refresh : 0)
  }, __DEV__)
}
