import { alphaBounds, centeredCrop, fitWithin, isLowResolution, LOGO_JPEG_QUALITY, LOGO_SHARP_EDGE, trimmedSquare } from './crop'

// Browser-only (desktop and mobile web): crops a picked photo to `aspect`
// around its centre and re-encodes it as a JPEG no larger than `maxEdge`,
// stepping the quality down only if it would be over `maxBytes`. JPEG for
// photos everywhere: Safari's canvas can't encode WebP (it silently hands
// back PNG). The browser applies EXIF rotation when it decodes, and iOS
// Safari passes HEIC picks over as JPEG already; desktop Chrome and Firefox
// can't decode HEIC at all, which surfaces as UnreadableImageError.
//
// compressLogo fits a business logo whole into a square rather than cropping
// it, as a lossless PNG with its transparency (the badge is white on every
// surface). Its transparent margins are trimmed first, so a wordmark that came
// with a wide empty border still fills the badge's width. An SVG is drawn at
// the full size, so a vector logo is as sharp as the square allows; the SVG
// itself is never stored.

export class UnreadableImageError extends Error {}

export interface PreparedImage {
  blob: Blob
  /** The source was smaller than it's shown at on high-DPI screens. */
  lowResolution: boolean
}

export async function compressImage(
  file: Blob,
  { aspect, maxEdge, qualities, maxBytes }: { aspect: number; maxEdge: number; qualities: readonly number[]; maxBytes: number }
): Promise<PreparedImage> {
  const url = URL.createObjectURL(file)
  try {
    const image = await loadImage(url)
    const box = centeredCrop(image.naturalWidth, image.naturalHeight, aspect, maxEdge)
    const canvas = document.createElement('canvas')
    canvas.width = box.width
    canvas.height = box.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas unavailable')
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    // JPEG has no alpha: a transparent PNG gets white behind it, not black.
    context.fillStyle = '#FFFFFF'
    context.fillRect(0, 0, box.width, box.height)
    context.drawImage(image, box.sx, box.sy, box.sw, box.sh, 0, 0, box.width, box.height)
    let blob = await encode(canvas, 'image/jpeg', qualities[0])
    for (const quality of qualities.slice(1)) {
      if (blob.size <= maxBytes) break
      blob = await encode(canvas, 'image/jpeg', quality)
    }
    return { blob, lowResolution: isLowResolution('banner', box.sw, box.sh) }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function compressLogo(file: Blob, { maxEdge, maxBytes }: { maxEdge: number; maxBytes: number }): Promise<PreparedImage> {
  const url = URL.createObjectURL(file)
  try {
    const image = await loadImage(url)
    const vector = file.type === 'image/svg+xml'
    // An SVG without width/height reports 0 in some browsers; its viewBox shape is then unknown, so square.
    const width = image.naturalWidth || maxEdge
    const height = image.naturalHeight || maxEdge
    // Drawn once at the fitted size to find the mark inside its transparent margins.
    const drawn = fitWithin(width, height, maxEdge, { vector })
    const probe = document.createElement('canvas')
    probe.width = drawn.width
    probe.height = drawn.height
    const probeContext = probe.getContext('2d', { willReadFrequently: true })
    if (!probeContext) throw new Error('Canvas unavailable')
    probeContext.drawImage(image, 0, 0, drawn.width, drawn.height)
    const content = alphaBounds(probeContext.getImageData(0, 0, drawn.width, drawn.height).data, drawn.width, drawn.height) ?? {
      x: 0,
      y: 0,
      width: drawn.width,
      height: drawn.height,
    }
    // Then drawn again from the source itself, so the trim never costs sharpness.
    const box = trimmedSquare(drawn, content, drawn.scale, maxEdge, { vector })
    const canvas = document.createElement('canvas')
    canvas.width = box.size
    canvas.height = box.size
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas unavailable')
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, box.dx, box.dy, box.dw, box.dh)
    const lowResolution = !vector && box.sourceEdge < LOGO_SHARP_EDGE
    const png = await encode(canvas, 'image/png')
    if (png.size <= maxBytes) return { blob: png, lowResolution }
    // A photo-like logo: JPEG on the badge's white instead.
    context.globalCompositeOperation = 'destination-over'
    context.fillStyle = '#FFFFFF'
    context.fillRect(0, 0, box.size, box.size)
    return { blob: await encode(canvas, 'image/jpeg', LOGO_JPEG_QUALITY), lowResolution }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function encode(canvas: HTMLCanvasElement, type: 'image/jpeg' | 'image/png', quality?: number): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Encoding failed'))), type, quality)
  )
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new UnreadableImageError('Not a readable image'))
    image.src = src
  })
}
