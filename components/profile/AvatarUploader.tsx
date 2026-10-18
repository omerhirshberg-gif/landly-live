'use client'

import { useEffect, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import Avatar from '@/components/ui/Avatar'
import { compressAvatar } from '@/lib/avatar/compressImage'
import { uploadAvatar } from '@/lib/firebase/avatar'
import { useMemberProfile } from '@/lib/firebase/useMemberProfile'
import { useLang } from '@/lib/i18n/useLang'

// Profile photo picker for desktop and mobile browsers. One file input: on
// iOS Safari and Android Chrome it already offers the camera and the photo
// library. The pick shows at once (local preview), is cropped square and
// shrunk to a ≤512px JPEG in the browser, then uploaded to avatars/{uid};
// every avatar on the page (navbar pill included) switches when it lands.
export default function AvatarUploader({ user }: { user: User }) {
  const { t } = useLang()
  const { initials, photoURL } = useMemberProfile(user)
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Each preview's object URL is freed when it's replaced or the page unmounts.
  useEffect(() => {
    if (!preview) return
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  const choose = () => inputRef.current?.click()

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Reset, so picking the same photo again still fires a change.
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError(t('avatar_invalid'))
      return
    }
    setError(null)
    setPreview(URL.createObjectURL(file))
    setBusy(true)
    try {
      await uploadAvatar(user, await compressAvatar(file))
      // The preview stays up: it's the same picture, so swapping to the
      // uploaded URL would only flash while that loads.
    } catch {
      setPreview(null)
      setError(t('avatar_error'))
    } finally {
      setBusy(false)
    }
  }

  const hasPhoto = !!(preview || photoURL)

  return (
    <div className="flex items-center gap-4 pb-5 mb-5 border-b border-line">
      {/* The labelled button beside it is the accessible control; this is a bigger tap target for the same action. */}
      <button type="button" tabIndex={-1} aria-hidden="true" onClick={choose} disabled={busy} className="relative flex-shrink-0 rounded-full">
        <Avatar src={preview ?? photoURL} initials={initials} size={72} />
        {busy && (
          <span className="absolute inset-0 rounded-full bg-[#0B1B3D]/40 flex items-center justify-center">
            <i className="fa-solid fa-spinner fa-spin text-white" aria-hidden="true"></i>
          </span>
        )}
        <span className="absolute -bottom-0.5 -end-0.5 w-7 h-7 rounded-full bg-white border border-line shadow-sm flex items-center justify-center text-brand">
          <i className="fa-solid fa-camera text-[11px]" aria-hidden="true"></i>
        </span>
      </button>
      <div className="min-w-0">
        <button type="button" onClick={choose} disabled={busy} aria-busy={busy} className="ds-btn ds-btn-secondary ds-btn-md">
          {busy ? t('avatar_uploading') : hasPhoto ? t('avatar_change') : t('avatar_add')}
        </button>
        {error && (
          <p role="alert" className="text-xs text-red-600 font-semibold mt-2">
            {error}
          </p>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={handleChange} />
    </div>
  )
}
