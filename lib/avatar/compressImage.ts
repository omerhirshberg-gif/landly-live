import { AVATAR_QUALITY, coverCrop } from './avatar'

// Browser-only (web and mobile web): crops the picked photo to its centred
// square and re-encodes it as a ≤1024px JPEG, so a 12MP phone photo uploads as
// ~150–350KB. The browser applies the photo's EXIF rotation when it decodes, and
// iOS Safari hands over HEIC picks as JPEG already.
export async function compressAvatar(file: Blob): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const image = await loadImage(url)
    const { originX, originY, side, output } = coverCrop(image.naturalWidth, image.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = output
    canvas.height = output
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas unavailable')
    context.imageSmoothingQuality = 'high'
    // JPEG has no alpha: a transparent PNG gets white behind it, not black.
    context.fillStyle = '#FFFFFF'
    context.fillRect(0, 0, output, output)
    context.drawImage(image, originX, originY, side, side, 0, 0, output, output)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Encoding failed'))), 'image/jpeg', AVATAR_QUALITY)
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Not a readable image'))
    image.src = src
  })
}
