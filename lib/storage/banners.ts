import 'server-only'
import { randomUUID } from 'node:crypto'
import { getAdminBucket } from '@/lib/firebase/admin'
import { BANNER_PREFIX, bannerPathFromUrl, LOGO_PREFIX, logoPathFromUrl, storageDownloadUrl } from './bannerPath'

// The admin's banner and logo uploads, through the Admin SDK: admins sign in
// with the admin password, not Firebase Auth, so storage.rules can't
// authorize them and the bucket takes no client writes to banners/ or logos/.

export type UploadImageType = 'image/jpeg' | 'image/png'

/** Stores an already-compressed banner JPEG under a fresh name and returns its public download URL. */
export function uploadBanner(bytes: Buffer): Promise<string> {
  return uploadImage(BANNER_PREFIX, bytes, 'image/jpeg')
}

/** The same for a business logo (already fitted into a square): a lossless PNG, or a JPEG, under logos/. */
export function uploadLogo(bytes: Buffer, type: UploadImageType): Promise<string> {
  return uploadImage(LOGO_PREFIX, bytes, type)
}

async function uploadImage(prefix: string, bytes: Buffer, type: UploadImageType): Promise<string> {
  const bucket = getAdminBucket()
  const path = `${prefix}${randomUUID()}.${type === 'image/png' ? 'png' : 'jpg'}`
  const token = randomUUID()
  await bucket.file(path).save(bytes, {
    resumable: false,
    contentType: type,
    metadata: {
      // A new name per upload, so the file never changes and can be cached for a year.
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: { firebaseStorageDownloadTokens: token },
    },
  })
  return storageDownloadUrl(bucket.name, path, token)
}

/**
 * Deletes the banner behind `url` if it's one of our uploads; external links
 * and empty values are ignored. Never throws: a leftover file costs a few
 * hundred KB, while a failed save would cost the admin's edit.
 */
export function deleteBannerByUrl(url: string | null | undefined): Promise<void> {
  return deleteUploadByUrl(url, bannerPathFromUrl)
}

/** The same for a business logo under logos/. */
export function deleteLogoByUrl(url: string | null | undefined): Promise<void> {
  return deleteUploadByUrl(url, logoPathFromUrl)
}

async function deleteUploadByUrl(url: string | null | undefined, pathOf: (url: string, bucket: string) => string | null): Promise<void> {
  if (!url) return
  try {
    const bucket = getAdminBucket()
    const path = pathOf(url, bucket.name)
    if (path) await bucket.file(path).delete({ ignoreNotFound: true })
  } catch (error) {
    console.warn('Upload cleanup failed', error)
  }
}
