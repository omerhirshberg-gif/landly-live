import type { Box } from '@shared/brand/entranceTimeline'

// The splash logo's hand-over glide (SplashScreen.tsx), native only. One
// progress value `p` springs 0 -> 1 and everything the glide moves is read
// off it on the UI thread: the translation, the scale, the backdrop. The
// springs are critically damped (dampingRatio 1), so the logo lands without
// an overshoot, and the hand-over fires once less than RELEASE_PX of travel
// is left, instead of waiting out the spring's long, invisible tail (a
// duration-based spring settles at 1.5x its duration), which read as the
// logo freezing before it swapped. A fixed share of the progress left a
// glide-length-dependent offset (1.5px on a 300pt glide) that the crossfade
// showed as a jolt; under half a pixel, it's settled onto the spot exactly.
export const GLIDE = {
  login: { duration: 620, dampingRatio: 1 },
  lock: { duration: 700, dampingRatio: 1 },
} as const

/**
 * Gliding into the lock, the glide waits for the lock screen (mounted under
 * the splash) to report where its lockup sits, then one more frame, so no
 * view is still being created on the UI thread as the logo starts to move.
 * If the report hasn't come by then, it starts toward the predicted spot.
 */
export const LOCK_LAYOUT_WAIT_MS = 250

/** The lock screen's hub, greeting and actions rise in over this stretch of the glide's progress. */
export const LOCK_RISE_PROGRESS = [0.2, 0.85] as const

/** A landing spot reported after the glide starts bends the path toward it. */
export const RETARGET_SPRING = { duration: 250, dampingRatio: 1 } as const

/** How close (in points, of travel or of the logo's edge as it scales) the glide gets before the screen's own logo takes over. */
export const RELEASE_PX = 0.5

/** The travel still left at progress `p`: the largest of the x, y and edge-scaling distances. */
export function glideRemainingPx(p: number, toX: number, toY: number, scaleDelta: number, heroWidth: number): number {
  'worklet'
  return (1 - p) * Math.max(Math.abs(toX), Math.abs(toY), Math.abs(scaleDelta) * heroWidth)
}

/** The backdrop fades out over this stretch of the glide's progress. */
export const BACKDROP_OUT = [0.15, 0.7] as const

/** The slogan is gone by this share of the glide (the lock's header has none). */
export const SLOGAN_OUT = 0.3

// The lock screen's layout (AppLock.tsx): the lockup sits at the top of a
// centred column, `insets.top + 36` down, inside a 24pt gutter.
export const LOCK_TOP_GAP = 36
export const LOCK_GUTTER = 24

/**
 * Where the app lock's header lockup will sit, from the lock screen's fixed
 * layout, so the glide can start the moment the intro ends instead of
 * waiting for the lock screen to mount and measure. Centred, so the same in
 * both directions; the measured spot (once it arrives) only corrects it.
 */
export function lockupTarget(
  window: { width: number },
  insets: { top: number; left: number; right: number },
  lockup: { width: number; height: number }
): Box {
  const start = insets.left + LOCK_GUTTER
  const content = window.width - start - (insets.right + LOCK_GUTTER)
  return { x: start + (content - lockup.width) / 2, y: insets.top + LOCK_TOP_GAP, width: lockup.width, height: lockup.height }
}
