import { compressImage } from '@/lib/images/compressImage'
import { AVATAR_QUALITY, AVATAR_SIZE } from './avatar'

// Browser-only (web and mobile web): the picked photo's centred square as a
// ≤1024px JPEG, so a 12MP phone photo uploads as ~150–350KB. The shared
// compressor (lib/images/compressImage.ts) does the work; banners use it too.
export function compressAvatar(file: Blob): Promise<Blob> {
  return compressImage(file, { aspect: 1, maxEdge: AVATAR_SIZE, quality: AVATAR_QUALITY })
}
