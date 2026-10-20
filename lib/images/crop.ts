// The centred crop of a width × height image to `aspect` (width / height),
// and the size it's scaled down to so its longer edge is at most `maxEdge`.
// Pure, for the browser compressor and the unit tests. (Avatars use the
// square case through lib/avatar/avatar.ts coverCrop, which the Expo picker
// shares.)

/** Offer banners: 16:9, the shape of the perk page's hero. */
export const BANNER_ASPECT = 16 / 9
export const BANNER_MAX_EDGE = 1600
/** ~150–300KB for a 1600×900 photo. */
export const BANNER_QUALITY = 0.82

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
