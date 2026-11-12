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
 * a width × height image, or null when there's none.
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

/** At least this bright in every channel reads as the white around a logo; JPEG noise stays under it. */
export const NEAR_WHITE = 242
/** How many of the four corners of the opaque box must be white for the white around the mark to be trimmed. */
const WHITE_CORNERS_NEEDED = 3
/** An edge line whose every opaque pixel is at least this bright (its dimmest channel) and within BAND_SPREAD of the others is blank paper, not mark. */
const LIGHT_EDGE = 190
const BAND_SPREAD = 20
/** Breathing room kept around the trimmed mark, as a share of its long edge, on every side. */
export const LOGO_INSET = 0.04

/**
 * The box around a logo's mark: its alpha bounds, then, when at least three of
 * the four corners of those are opaque white (a logo on a white background; the
 * odd corner may carry a shadow, a tint or JPEG noise), without that white too.
 * A white mark on transparency keeps its alpha bounds, as does an all-white
 * image, which has no mark to find.
 */
export function logoBounds(data: ArrayLike<number>, width: number, height: number): Bounds | null {
  const box = alphaBounds(data, width, height)
  if (!box) return null
  const white = (x: number, y: number) => {
    const i = (y * width + x) * 4
    return data[i + 3]! > 250 && data[i]! >= NEAR_WHITE && data[i + 1]! >= NEAR_WHITE && data[i + 2]! >= NEAR_WHITE
  }
  const right = box.x + box.width - 1
  const bottom = box.y + box.height - 1
  const whiteCorners = [white(box.x, box.y), white(right, box.y), white(box.x, bottom), white(right, bottom)].filter(Boolean).length
  if (whiteCorners < WHITE_CORNERS_NEEDED) return lightBandBounds(data, width, box)
  let minX = right
  let minY = bottom
  let maxX = box.x - 1
  let maxY = box.y - 1
  for (let y = box.y; y <= bottom; y++) {
    for (let x = box.x; x <= right; x++) {
      if (white(x, y) || data[(y * width + x) * 4 + 3]! <= 8) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  return maxX < box.x ? box : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

/**
 * `box` without the blank light bands along its edges: rows and columns (from
 * each side in, stopping at the first that isn't) whose opaque pixels are all
 * light and alike (a flat white or light-grey scanner edge: a logo whose corners
 * are not all white, so the white rule above does not apply). A pale mark varies
 * along its line, so it is kept. Nothing left to trim to (a wholly pale image)
 * gives `box` back unchanged.
 */
function lightBandBounds(data: ArrayLike<number>, width: number, box: Bounds): Bounds {
  const blank = (fixed: number, from: number, to: number, row: boolean): boolean => {
    let lo = 255
    let hi = 0
    for (let k = from; k <= to; k++) {
      const i = (row ? fixed * width + k : k * width + fixed) * 4
      if (data[i + 3]! <= 8) continue
      const m = Math.min(data[i]!, data[i + 1]!, data[i + 2]!)
      if (m < LIGHT_EDGE) return false
      if (m < lo) lo = m
      if (m > hi) hi = m
      if (hi - lo > BAND_SPREAD) return false
    }
    return true
  }
  let left = box.x
  let right = box.x + box.width - 1
  let top = box.y
  let bottom = box.y + box.height - 1
  while (top <= bottom && blank(top, left, right, true)) top++
  while (bottom >= top && blank(bottom, left, right, true)) bottom--
  if (top > bottom) return box
  while (left <= right && blank(left, top, bottom, false)) left++
  while (right >= left && blank(right, top, bottom, false)) right--
  if (left > right) return box
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }
}

/**
 * `box` grown by `inset` of its long edge on every side, so the trimmed mark
 * never touches the badge's edge. It may reach past the image (that part is
 * transparent, i.e. the badge's white).
 */
export function insetBounds(box: Bounds, inset = LOGO_INSET): Bounds {
  const pad = Math.round(Math.max(box.width, box.height) * inset)
  return { x: box.x - pad, y: box.y - pad, width: box.width + pad * 2, height: box.height + pad * 2 }
}

/**
 * What to keep of a logo (RGBA `data`): its mark with the margins trimmed and
 * the small breathing inset back, or the whole image when there is no mark to
 * find. The one rule behind the admin upload and the one-off re-trim script.
 */
export function logoContentBox(data: ArrayLike<number>, width: number, height: number): Bounds {
  const mark = logoBounds(data, width, height)
  return mark ? insetBounds(mark) : { x: 0, y: 0, width, height }
}

/**
 * Where to draw a logo, already rendered at `drawn` px (`sourceScale` × its
 * own size), so that only its `content` (the trimmed box, in drawn px) fills
 * a canvas of the same shape: as large as the source's own pixels allow up to
 * `maxEdge` on the long side, or exactly `maxEdge` for a vector. A wordmark
 * stays wide, so the badge can grow with it. `dx`/`dy`/`dw`/`dh` place the
 * whole drawing; what's outside the canvas is clipped.
 */
export function trimmedBox(
  drawn: { width: number; height: number },
  content: Bounds,
  sourceScale: number,
  maxEdge: number,
  { vector = false } = {}
): Omit<ContainBox, 'size'> & { width: number; height: number; sourceEdge: number } {
  const contentEdge = Math.max(content.width, content.height)
  const sourceEdge = contentEdge / sourceScale
  const size = vector ? Math.max(1, maxEdge) : Math.max(1, Math.round(Math.min(maxEdge, sourceEdge)))
  const k = size / contentEdge
  return {
    width: Math.max(1, Math.round(content.width * k)),
    height: Math.max(1, Math.round(content.height * k)),
    dx: Math.round(-content.x * k),
    dy: Math.round(-content.y * k),
    dw: Math.max(1, Math.round(drawn.width * k)),
    dh: Math.max(1, Math.round(drawn.height * k)),
    sourceEdge,
  }
}

/** Whether a picked image is too small to look crisp where it's shown (the admin gets a warning). */
export function isLowResolution(kind: 'banner' | 'logo', width: number, height: number): boolean {
  return kind === 'logo' ? Math.max(width, height) < LOGO_SHARP_EDGE : width < BANNER_SHARP_WIDTH
}
