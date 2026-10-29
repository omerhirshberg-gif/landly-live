// The centred crop of a width × height image to `aspect` (width / height),
// and the size it's scaled down to so its longer edge is at most `maxEdge`.
// Pure, for the browser compressor and the unit tests. (Avatars use the
// square case through lib/avatar/avatar.ts coverCrop, which the Expo picker
// shares.) Business logos are never cropped: containedSquare fits the whole
// logo inside a square instead, so a wide wordmark keeps its ends. Nothing
// is ever upscaled: a small source stays its own size (and the admin is told
// it may look soft), except a vector, which is drawn at the full size.

/** Offer banners: 16:9, the shape of the perk page's hero. */
export const BANNER_ASPECT = 16 / 9
/** A desktop detail hero (~1200 CSS px) at 2x; a phone at 430pt @3x needs 1290. */
export const BANNER_MAX_EDGE = 2400
/** Tried in order until the JPEG fits under MAX_UPLOAD_BYTES (~400–900KB at 0.9 for 2400×1350). */
export const BANNER_QUALITIES = [0.9, 0.86, 0.82] as const
/** Narrower than this, a banner is softer than a phone's screen at @3x. */
export const BANNER_SHARP_WIDTH = 1600

/** Business logos: a square up to 1024px, ~6x the largest badge (56pt @3x = 168px). */
export const LOGO_MAX_EDGE = 1024
/**
 * Logos are stored as lossless PNG, transparency kept. A photo-like logo
 * whose PNG is over the cap falls back to a JPEG on white at this quality.
 */
export const LOGO_JPEG_QUALITY = 0.95
/** Smaller than this, a logo is softer than the badge at @3x on a big card. */
export const LOGO_SHARP_EDGE = 512

/** Under Vercel's 4.5MB request body limit, with room for the multipart envelope. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

export interface CropBox {
  sx: number
  sy: number
  sw: number
  sh: number
  width: number
  height: number
}

export function centeredCrop(width: number, height: number, aspect: number, maxEdge: number): CropBox {
  const w = Math.max(1, Math.floor(width))
  const h = Math.max(1, Math.floor(height))
  const sw = w / h > aspect ? Math.max(1, Math.round(h * aspect)) : w
  const sh = w / h > aspect ? h : Math.max(1, Math.round(w / aspect))
  const scale = Math.min(1, maxEdge / Math.max(sw, sh))
  return {
    sx: Math.floor((w - sw) / 2),
    sy: Math.floor((h - sh) / 2),
    sw,
    sh,
    width: Math.max(1, Math.round(sw * scale)),
    height: Math.max(1, Math.round(sh * scale)),
  }
}

/** Where the whole image goes inside a square canvas of side `size`, centred. */
export interface ContainBox {
  size: number
  dx: number
  dy: number
  dw: number
  dh: number
}

/**
 * `vector`: the source has no fixed pixel size (an SVG), so it's drawn at
 * `maxEdge` whatever size it declares.
 */
export function containedSquare(width: number, height: number, maxEdge: number, { vector = false } = {}): ContainBox {
  const w = Math.max(1, Math.floor(width))
  const h = Math.max(1, Math.floor(height))
  const size = vector ? Math.max(1, maxEdge) : Math.max(1, Math.min(maxEdge, Math.max(w, h)))
  const scale = size / Math.max(w, h)
  const dw = Math.max(1, Math.round(w * scale))
  const dh = Math.max(1, Math.round(h * scale))
  return { size, dx: Math.floor((size - dw) / 2), dy: Math.floor((size - dh) / 2), dw, dh }
}

/** The size an image is drawn at to fit `maxEdge` (a vector: exactly; a bitmap: never upscaled). */
export function fitWithin(width: number, height: number, maxEdge: number, { vector = false } = {}): { width: number; height: number; scale: number } {
  const w = Math.max(1, Math.floor(width))
  const h = Math.max(1, Math.floor(height))
  const scale = vector ? maxEdge / Math.max(w, h) : Math.min(1, maxEdge / Math.max(w, h))
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)), scale }
}

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

/**
 * The box around every pixel more opaque than `threshold` in RGBA `data` of
 * a width × height image, or null when there's none. A logo's transparent
 * margins are trimmed with it, so its mark fills the badge.
 */
export function alphaBounds(data: ArrayLike<number>, width: number, height: number, threshold = 8): Bounds | null {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3]! <= threshold) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

/**
 * Where to draw a logo, already rendered at `drawn` px (`sourceScale` × its
 * own size), so that its `content` (the trimmed box, in drawn px) sits whole
 * and centred in a square: as large as the source's own pixels allow up to
 * `maxEdge`, or exactly `maxEdge` for a vector. `dx`/`dy`/`dw`/`dh` place the
 * whole drawing; what's outside the square is clipped.
 */
export function trimmedSquare(
  drawn: { width: number; height: number },
  content: Bounds,
  sourceScale: number,
  maxEdge: number,
  { vector = false } = {}
): ContainBox & { sourceEdge: number } {
  const contentEdge = Math.max(content.width, content.height)
  const sourceEdge = contentEdge / sourceScale
  const size = vector ? Math.max(1, maxEdge) : Math.max(1, Math.round(Math.min(maxEdge, sourceEdge)))
  const k = size / contentEdge
  return {
    size,
    dx: Math.round((size - content.width * k) / 2 - content.x * k),
    dy: Math.round((size - content.height * k) / 2 - content.y * k),
    dw: Math.max(1, Math.round(drawn.width * k)),
    dh: Math.max(1, Math.round(drawn.height * k)),
    sourceEdge,
  }
}

/** Whether a picked image is too small to look crisp where it's shown (the admin gets a warning). */
export function isLowResolution(kind: 'banner' | 'logo', width: number, height: number): boolean {
  return kind === 'logo' ? Math.max(width, height) < LOGO_SHARP_EDGE : width < BANNER_SHARP_WIDTH
}
