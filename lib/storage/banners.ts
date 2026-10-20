import 'server-only'
import { randomUUID } from 'node:crypto'
import { getAdminBucket } from '@/lib/firebase/admin'
import { BANNER_PREFIX, bannerPathFromUrl, storageDownloadUrl } from './bannerPath'

// The admin's banner uploads, through the Admin SDK: admins sign in with the
// admin password, not Firebase Auth, so storage.rules can't authorize them
// and the bucket takes no client writes to banners/ at all.

/** Stores an already-compressed JPEG under a fresh name and returns its public download URL. */
export async function uploadBanner(bytes: Buffer): Promise<string> {
  const bucket = getAdminBucket()
  const path = `${BANNER_PREFIX}${randomUUID()}.jpg`
  const token = randomUUID()
  await bucket.file(path).save(bytes, {
    resumable: false,
    contentType: 'image/jpeg',
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
export async function deleteBannerByUrl(url: string | null | undefined): Promise<void> {
  if (!url) return
  try {
    const bucket = getAdminBucket()
    const path = bannerPathFromUrl(url, bucket.name)
    if (path) await bucket.file(path).delete({ ignoreNotFound: true })
  } catch (error) {
    console.warn('Banner cleanup failed', error)
  }
}
