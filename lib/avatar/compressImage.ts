import { MAX_UPLOAD_BYTES } from '@/lib/images/crop'
import { compressImage } from '@/lib/images/compressImage'
import { AVATAR_QUALITY, AVATAR_SIZE } from './avatar'

// Browser-only (web and mobile web): the picked photo's centred square as a
// ≤1024px JPEG, so a 12MP phone photo uploads as ~150–350KB. The shared
// compressor (lib/images/compressImage.ts) does the work; banners use it too.
export async function compressAvatar(file: Blob): Promise<Blob> {
  const { blob } = await compressImage(file, { aspect: 1, maxEdge: AVATAR_SIZE, qualities: [AVATAR_QUALITY], maxBytes: MAX_UPLOAD_BYTES })
  return blob
}
