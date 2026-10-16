import { updateProfile, type User } from 'firebase/auth'
import { doc, updateDoc } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { avatarPath, withAvatarVersion } from '@/lib/avatar/avatar'
import { db, storage } from './config'
import { publishAvatar } from './useMemberProfile'

/**
 * Uploads an already-compressed JPEG to avatars/{uid} (storage.rules: the
 * owner only, verified, image/*, under 2MB), then points both the Auth record
 * and users/{uid}.photoURL at it, and tells every mounted avatar. Shared by
 * the web uploader and the Expo picker; returns the new URL.
 */
export async function uploadAvatar(user: User, image: Blob): Promise<string> {
  const objectRef = ref(storage, avatarPath(user.uid))
  await uploadBytes(objectRef, image, { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000' })
  const url = withAvatarVersion(await getDownloadURL(objectRef), Date.now())
  await Promise.all([updateProfile(user, { photoURL: url }), updateDoc(doc(db, 'users', user.uid), { photoURL: url })])
  publishAvatar(user.uid, url)
  return url
}
