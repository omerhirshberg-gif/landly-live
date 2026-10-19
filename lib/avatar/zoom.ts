// Pinch-to-zoom maths for the avatar previews (web:
// components/ui/AvatarLightbox.tsx, app: AvatarViewer.tsx), Instagram style:
// the whole circle grows with the pinch, freely past the screen's edges, and
// follows the fingers; letting go springs it back. No dependencies beyond the
// avatar constants, so the unit tests and both platforms share it (the app's
// gesture worklets import the constants only).
import { AVATAR_SIZE } from './avatar'

/** The furthest a pinch grows the circle on the web… */
export const WEB_ZOOM_MAX = 4.5
/** …and in the app. */
export const NATIVE_ZOOM_MAX = 5

export function clampZoom(scale: number, max: number): number {
  return Math.min(max, Math.max(1, scale))
}

/** 0 at rest to 1 fully grown: how much the extra dimming behind the circle shows. */
export function zoomProgress(scale: number, max: number): number {
  if (max <= 1) return 0
  return Math.min(1, Math.max(0, (scale - 1) / (max - 1)))
}

/**
 * How many times its resting size the circle is laid out at (then scaled
 * down to rest), so the photo is drawn with every pixel the 1024px source
 * has, however far the pinch takes it: AVATAR_SIZE device pixels across, and
 * no more, since past that the source itself is what's being enlarged.
 */
export function renderScale(side: number, pixelRatio: number, max: number): number {
  if (side <= 0 || pixelRatio <= 0) return 1
  return Math.min(max, Math.max(1, AVATAR_SIZE / (side * pixelRatio)))
}

export function touchDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}
