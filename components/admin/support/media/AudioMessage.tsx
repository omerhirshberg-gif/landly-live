'use client'

import { useSyncExternalStore } from 'react'
import type { InboxMedia } from '@/lib/whatsapp/adminInbox'
import MediaUnavailable from './MediaUnavailable'
import { fileSize } from './format'
import { useFailedSrc } from './useFailedSrc'

const subscribe = () => () => {}

/**
 * Whether this browser can play the type. Voice notes are Opus in Ogg, which
 * Safari before 17 can't play; the server render assumes it can.
 */
function useCanPlay(mimeType?: string) {
  return useSyncExternalStore(
    subscribe,
    () => !mimeType || document.createElement('audio').canPlayType(mimeType) !== '',
    () => true
  )
}

/** A voice note or audio clip: the browser's player, or a download where it can't play the format. */
export default function AudioMessage({ media }: { media: InboxMedia }) {
  const canPlay = useCanPlay(media.mimeType)
  const { broken, onError } = useFailedSrc(media.url)
  if (!media.url || broken) return <MediaUnavailable kind="audio" media={media} />
  const label = media.voice ? 'Voice note' : 'Audio'
  return (
    <div className="flex w-72 max-w-full flex-col gap-1.5">
      {canPlay ? (
        <audio controls preload="metadata" src={media.url} onError={onError} aria-label={label} className="h-10 w-full">
          <a href={media.downloadUrl}>Download {label.toLowerCase()}</a>
        </audio>
      ) : (
        <p className="text-[13px] text-[#64748B]">This browser can&apos;t play this {label.toLowerCase()}. Download it to listen.</p>
      )}
      <div className="flex items-center gap-2 text-[11px] text-[#94A3B8]">
        <i className={`fa-solid ${media.voice ? 'fa-microphone' : 'fa-music'}`} aria-hidden="true" />
        <span>{label}</span>
        {media.size !== undefined && <bdi dir="ltr">{fileSize(media.size)}</bdi>}
        {media.downloadUrl && (
          <a href={media.downloadUrl} className="ms-auto font-semibold text-[#0038B8] hover:underline" aria-label={`Download ${label.toLowerCase()}`}>
            <i className="fa-solid fa-download me-1" aria-hidden="true" />
            Download
          </a>
        )}
      </div>
    </div>
  )
}
