'use client'

import { useEffect, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import Avatar from '@/components/ui/Avatar'
import AvatarLightbox, { useAvatarPeek } from '@/components/ui/AvatarLightbox'
import { compressAvatar } from '@/lib/avatar/compressImage'
import { uploadAvatar } from '@/lib/firebase/avatar'
import { useMemberProfile } from '@/lib/firebase/useMemberProfile'
import { useLang } from '@/lib/i18n/useLang'

// Profile photo picker for desktop and mobile browsers. One file input: on
// iOS Safari and Android Chrome it already offers the camera and the photo
// library. The pick shows at once (local preview), is cropped square and
// shrunk to a ≤1024px JPEG in the browser, then uploaded to avatars/{uid};
// every avatar on the page (navbar pill included) switches when it lands.
// With a photo on file, tapping or clicking the avatar opens it full size
// (AvatarLightbox) and a long press or click-and-hold peeks at it until let
// go (useAvatarPeek); the camera badge and the labelled button beside it
// change it.
export default function AvatarUploader({ user }: { user: User }) {
  const { t } = useLang()
  const { initials, photoURL } = useMemberProfile(user)
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewing, setViewing] = useState(false)

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

  const photoSrc = preview ?? photoURL
  const hasPhoto = !!photoSrc
  const peek = useAvatarPeek(photoSrc)

  return (
    <div className="flex items-center gap-4 pb-5 mb-5 border-b border-line">
      <div className="relative flex-shrink-0">
        {hasPhoto ? (
          <button
            type="button"
            {...peek.trigger}
            onClick={() => setViewing(true)}
            aria-label={t('avatar_view')}
            aria-haspopup="dialog"
            className="avatar-peek-trigger relative block rounded-full cursor-zoom-in"
          >
            <Avatar src={photoSrc} initials={initials} size={72} />
            {busy && <BusyOverlay />}
          </button>
        ) : (
          // The labelled button beside it is the accessible control; this is a bigger tap target for the same action.
          <button type="button" tabIndex={-1} aria-hidden="true" onClick={choose} disabled={busy} className="relative block rounded-full">
            <Avatar src={photoSrc} initials={initials} size={72} />
            {busy && <BusyOverlay />}
          </button>
        )}
        {/* A shortcut to the same file picker as the labelled button. */}
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={choose}
          disabled={busy}
          className="absolute -bottom-0.5 -end-0.5 w-7 h-7 rounded-full bg-white border border-line shadow-sm flex items-center justify-center text-brand"
        >
          <i className="fa-solid fa-camera text-[11px]" aria-hidden="true"></i>
        </button>
      </div>
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
      {photoSrc && <AvatarLightbox src={photoSrc} open={viewing} onClose={() => setViewing(false)} />}
      {peek.layer}
      <input ref={inputRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={handleChange} />
    </div>
  )
}

function BusyOverlay() {
  return (
    <span className="absolute inset-0 rounded-full bg-[#0B1B3D]/40 flex items-center justify-center">
      <i className="fa-solid fa-spinner fa-spin text-white" aria-hidden="true"></i>
    </span>
  )
}
