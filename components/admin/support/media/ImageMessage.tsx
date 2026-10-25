'use client'

import { useState } from 'react'
import type { InboxMedia } from '@/lib/whatsapp/adminInbox'
import MediaLightbox from './MediaLightbox'
import MediaUnavailable from './MediaUnavailable'
import { useFailedSrc } from './useFailedSrc'

/** A photo in the bubble; a tap opens it full screen. */
export default function ImageMessage({ media, caption }: { media: InboxMedia; caption: string }) {
  const [open, setOpen] = useState(false)
  const { broken, onError } = useFailedSrc(media.url)
  if (!media.url || broken) return <MediaUnavailable kind="image" media={media} />
  const alt = caption ? `Photo from the member: ${caption}` : 'Photo from the member'
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open photo"
        className="block min-h-11 min-w-11 overflow-hidden rounded-xl bg-[#F1F5F9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8] [-webkit-tap-highlight-color:transparent]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a signed Storage URL, shown as is */}
        <img src={media.url} alt={alt} loading="lazy" onError={onError} className="block max-h-80 w-auto max-w-full object-cover" />
      </button>
      {open && <MediaLightbox src={media.url} downloadUrl={media.downloadUrl} alt={alt} onClose={() => setOpen(false)} />}
    </>
  )
}
