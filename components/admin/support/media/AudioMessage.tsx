'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { InboxMedia } from '@/lib/whatsapp/adminInbox'
import MediaUnavailable from './MediaUnavailable'
import { fileSize } from './format'
import { useFailedSrc } from './useFailedSrc'

const subscribe = () => () => {}

/**
 * Whether this browser can play the type. Voice notes are Opus in Ogg, which
 * Safari on iPhone can't play; the server render assumes it can.
 */
function useCanPlay(mimeType?: string) {
  return useSyncExternalStore(
    subscribe,
    () => !mimeType || document.createElement('audio').canPlayType(mimeType) !== '',
    () => true
  )
}

type Decoded = { state: 'idle' } | { state: 'decoding' } | { state: 'ready'; src: string } | { state: 'failed' }

/**
 * Where the browser can't play the format: decoded in the page on the first
 * tap (decodeOggOpus.ts), then the browser's own player on a WAV copy.
 */
function useDecodedAudio(fileUrl?: string) {
  const [decoded, setDecoded] = useState<Decoded>({ state: 'idle' })
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (decoded.state !== 'ready') return
    return () => URL.revokeObjectURL(decoded.src)
  }, [decoded])
  useEffect(() => () => abortRef.current?.abort(), [])

  const decode = async () => {
    if (!fileUrl || decoded.state === 'decoding') return
    const controller = new AbortController()
    abortRef.current = controller
    setDecoded({ state: 'decoding' })
    try {
      const { decodeOggOpusToWav } = await import('./decodeOggOpus')
      const wav = await decodeOggOpusToWav(fileUrl, controller.signal)
      if (!controller.signal.aborted) setDecoded({ state: 'ready', src: URL.createObjectURL(wav) })
    } catch (err) {
      if (controller.signal.aborted) return
      console.error('[support-inbox] voice note could not be decoded:', err instanceof Error ? err.message : err)
      setDecoded({ state: 'failed' })
    }
  }
  return { decoded, decode }
}

/** A voice note or audio clip: the browser's player, a decoded copy where it can't play the format, or a download. */
export default function AudioMessage({ media }: { media: InboxMedia }) {
  const canPlay = useCanPlay(media.mimeType)
  const { broken, onError } = useFailedSrc(media.url)
  const { decoded, decode } = useDecodedAudio(media.fileUrl)
  const decodedRef = useRef<HTMLAudioElement>(null)

  // The tap that started decoding asked to listen: start once it's ready (a browser that refuses leaves the controls).
  useEffect(() => {
    if (decoded.state === 'ready') decodedRef.current?.play().catch(() => {})
  }, [decoded])

  if (!media.url || broken) return <MediaUnavailable kind="audio" media={media} />
  const label = media.voice ? 'Voice note' : 'Audio'
  const noun = label.toLowerCase()
  return (
    <div className="flex w-72 max-w-full flex-col gap-1.5">
      {canPlay ? (
        <audio controls preload="metadata" src={media.url} onError={onError} aria-label={label} className="h-10 w-full">
          <a href={media.downloadUrl}>Download {noun}</a>
        </audio>
      ) : decoded.state === 'ready' ? (
        <audio ref={decodedRef} controls preload="auto" src={decoded.src} aria-label={label} className="h-10 w-full" />
      ) : media.fileUrl && decoded.state !== 'failed' ? (
        <button
          type="button"
          onClick={decode}
          disabled={decoded.state === 'decoding'}
          aria-busy={decoded.state === 'decoding'}
          className="flex min-h-11 w-full items-center gap-2.5 rounded-full bg-[#F1F5F9] px-3 text-[13px] font-semibold text-[#0F172A] transition-colors hover:bg-[#E2E8F0] disabled:cursor-progress focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8] [-webkit-tap-highlight-color:transparent]"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0038B8] text-white">
            <i className={`fa-solid ${decoded.state === 'decoding' ? 'fa-spinner fa-spin motion-reduce:animate-none' : 'fa-play'} text-xs`} aria-hidden="true" />
          </span>
          {decoded.state === 'decoding' ? `Preparing ${noun}…` : `Play ${noun}`}
        </button>
      ) : (
        <p className="text-[13px] text-[#64748B]">
          {decoded.state === 'failed' ? `This ${noun} couldn't be played here.` : `This browser can't play this ${noun}.`} Download it to listen.
        </p>
      )}
      <div className="flex items-center gap-2 text-[11px] text-[#94A3B8]">
        <i className={`fa-solid ${media.voice ? 'fa-microphone' : 'fa-music'}`} aria-hidden="true" />
        <span>{label}</span>
        {media.size !== undefined && <bdi dir="ltr">{fileSize(media.size)}</bdi>}
        {media.downloadUrl && (
          <a href={media.downloadUrl} className="ms-auto font-semibold text-[#0038B8] hover:underline" aria-label={`Download ${noun}`}>
            <i className="fa-solid fa-download me-1" aria-hidden="true" />
            Download
          </a>
        )}
      </div>
    </div>
  )
}
