import { centeredCrop } from './crop'

// Browser-only (desktop and mobile web): crops a picked photo to `aspect`
// around its centre and re-encodes it as a JPEG no larger than `maxEdge`, so
// a 12MP phone photo uploads as a few hundred KB. JPEG everywhere: Safari's
// canvas can't encode WebP (it silently hands back PNG). The browser applies
// EXIF rotation when it decodes, and iOS Safari passes HEIC picks over as
// JPEG already; desktop Chrome and Firefox can't decode HEIC at all, which
// surfaces as UnreadableImageError.

export class UnreadableImageError extends Error {}

export async function compressImage(file: Blob, { aspect, maxEdge, quality }: { aspect: number; maxEdge: number; quality: number }): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const image = await loadImage(url)
    const box = centeredCrop(image.naturalWidth, image.naturalHeight, aspect, maxEdge)
    const canvas = document.createElement('canvas')
    canvas.width = box.width
    canvas.height = box.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas unavailable')
    context.imageSmoothingQuality = 'high'
    // JPEG has no alpha: a transparent PNG gets white behind it, not black.
    context.fillStyle = '#FFFFFF'
    context.fillRect(0, 0, box.width, box.height)
    context.drawImage(image, box.sx, box.sy, box.sw, box.sh, 0, 0, box.width, box.height)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Encoding failed'))), 'image/jpeg', quality)
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new UnreadableImageError('Not a readable image'))
    image.src = src
  })
}
