// The GoLandly brand loader, shared by the Expo app (react-native-svg + Reanimated)
// and the Next.js site (inline SVG + CSS keyframes) so both draw the same mark
// with the same motion. Plain numbers only: each platform builds its own easing
// and transform objects from these.
//
// The loader is the real emblem (lib/brand/emblemPaths.ts) in two pale tones with
// a soft blue band sweeping across it, clipped to the emblem's own silhouette:
// a skeleton in the shape of the mark. It loops with no intro and no outro (the
// band is off the mark at both ends of every cycle), and sits on the Star of
// David, not on the emblem's bounding box: the arrow reaches further right than
// the star does left, so a box-centred mark looks pushed to one side.
import { EMBLEM_AXIS_X, EMBLEM_COLORS } from './emblemPaths'

/** The Star of David's centre: its vertical axis (EMBLEM_AXIS_X) and its circumcentre row. */
export const STAR_CENTRE = { x: EMBLEM_AXIS_X, y: 260.5 } as const

/** Half the square viewBox. 340 clears the arrow tip (x 519.7) with room to spare. */
const HALF = 340

export const LOADER = {
  /** Square viewBox side; the Star of David's centre lands on (half, half). */
  half: HALF,
  size: HALF * 2,
  /** Pale emblem tones (the emblem's light and dark facets, washed out). */
  pale: { light: '#d9e6f9', dark: '#c3d6f4' },
  /** The sweep colour: the emblem's own light blue. */
  bandColor: EMBLEM_COLORS.light,
  band: { width: 190, height: 840, tiltDeg: 28, peakOpacity: 0.95 },
  /** The band's centre travels from -travel to +travel along its own axis. */
  travel: 430,
  /** One loop: the sweep, then a short rest with the band off the mark. */
  cycleMs: 1900,
  sweepShare: 0.82,
  /** The sweep's easing (cubic-bezier control points), shared by CSS and Reanimated. */
  curve: [0.5, 0, 0.3, 1],
  /** A wait shorter than this never shows the loader: it fades in after the delay, so quick loads don't flash. */
  showDelayMs: 150,
  fadeInMs: 200,
  /** Reduce Motion: a static mark that only breathes in opacity. */
  breatheMs: 1800,
  breatheFrom: 0.55,
  /** Rendered sizes in px (dp on native). */
  sizes: { sm: 56, md: 112, lg: 212 },
} as const

export type LoaderSize = keyof typeof LOADER.sizes

/** Moves the emblem's own coordinates so the Star of David sits on the viewBox centre. */
export const LOADER_OFFSET = { x: HALF - STAR_CENTRE.x, y: HALF - STAR_CENTRE.y } as const

/** +1 in LTR, -1 in RTL: the tilt and the sweep direction mirror, the mark itself never does. */
export function loaderDirection(isRtl: boolean): 1 | -1 {
  return isRtl ? -1 : 1
}

/** The band's rotation about the star's centre, in degrees. */
export function loaderTilt(isRtl: boolean): number {
  return -LOADER.band.tiltDeg * loaderDirection(isRtl)
}

/** Where the band's centre starts and ends, relative to the star's centre. */
export function loaderTravel(isRtl: boolean): { from: number; to: number } {
  const d = loaderDirection(isRtl)
  return { from: -LOADER.travel * d, to: LOADER.travel * d }
}
