'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { sendToLogin } from '@/lib/admin/adminSession'
import { BANNER_ASPECT, BANNER_MAX_EDGE, BANNER_QUALITY } from '@/lib/images/crop'
import { compressImage, UnreadableImageError } from '@/lib/images/compressImage'
import { ADMIN_HINT, ADMIN_LABEL, SECONDARY_BUTTON } from './formStyles'

type Tab = 'upload' | 'link'
type UploadState = { kind: 'idle' } | { kind: 'working'; progress: number | null } | { kind: 'error'; message: string }

const isUploadedUrl = (url: string) => /^https:\/\/firebasestorage\.googleapis\.com\//.test(url)

// The offer's banner. Upload (the default) takes a photo by click, tap or
// drag and drop: on iOS Safari and Android Chrome the same file input offers
// the camera and the photo library. The browser crops it to 16:9 around the
// centre and re-encodes it as a ≤1600px JPEG (~150–300KB) before it's sent to
// /api/admin/uploads, which stores it in Firebase Storage and returns the URL
// that `onChange` puts in imageUrl. "Paste link" keeps the old way: any image
// URL, previewed by `linkPreview`. Everything is logical (start/end), so the
// Hebrew admin mirrors cleanly.
export default function ImageUploadField({
  value,
  onChange,
  linkInput,
}: {
  value: string
  onChange: (url: string) => void
  /** The paste-a-link field and its preview, as OfferFormFields already renders them. */
  linkInput: React.ReactNode
}) {
  const id = useId()
  const [tab, setTab] = useState<Tab>(() => (value && !isUploadedUrl(value) ? 'link' : 'upload'))
  const [state, setState] = useState<UploadState>({ kind: 'idle' })
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const xhrRef = useRef<XMLHttpRequest | null>(null)

  useEffect(() => () => xhrRef.current?.abort(), [])
  useEffect(() => {
    if (!preview) return
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/') && file.type !== '') {
      setState({ kind: 'error', message: 'That file is not an image.' })
      return
    }
    setState({ kind: 'working', progress: null })
    let jpeg: Blob
    try {
      jpeg = await compressImage(file, { aspect: BANNER_ASPECT, maxEdge: BANNER_MAX_EDGE, quality: BANNER_QUALITY })
    } catch (error) {
      setState({
        kind: 'error',
        message:
          error instanceof UnreadableImageError
            ? "This browser can't read that image (HEIC photos only open in Safari). Save it as JPEG or PNG and try again."
            : 'The image could not be prepared. Try another one.',
      })
      return
    }
    setPreview(URL.createObjectURL(jpeg))
    // XMLHttpRequest rather than fetch: it reports upload progress.
    const xhr = new XMLHttpRequest()
    xhrRef.current = xhr
    xhr.open('POST', '/api/admin/uploads')
    // The session cookie goes along on its own (same origin).
    xhr.responseType = 'json'
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) setState({ kind: 'working', progress: event.loaded / event.total })
    }
    xhr.onload = () => {
      xhrRef.current = null
      if (xhr.status === 401) {
        sendToLogin()
        return
      }
      const body = xhr.response as { url?: string; error?: string } | null
      if (xhr.status >= 200 && xhr.status < 300 && body?.url) {
        onChange(body.url)
        setState({ kind: 'idle' })
      } else {
        setPreview(null)
        setState({ kind: 'error', message: body?.error ?? 'The upload failed. Try again.' })
      }
    }
    xhr.onerror = () => {
      xhrRef.current = null
      setPreview(null)
      setState({ kind: 'error', message: 'The upload failed. Check the connection and try again.' })
    }
    const body = new FormData()
    body.append('file', jpeg, 'banner.jpg')
    xhr.send(body)
  }

  const onFiles = (files: FileList | null) => {
    const file = files?.[0]
    if (file) void upload(file)
  }

  const working = state.kind === 'working'
  const shown = preview ?? (value && isUploadedUrl(value) ? value : null)

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <span id={`${id}-label`} className={ADMIN_LABEL.replace('mb-1.5 ', '')}>Image</span>
        <div role="tablist" aria-labelledby={`${id}-label`} className="inline-flex rounded-xl bg-[#F1F5F9] p-1">
          {(['upload', 'link'] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={tab === option}
              aria-controls={`${id}-${option}`}
              onClick={() => setTab(option)}
              className={`min-h-11 rounded-lg px-3 text-sm font-semibold transition-colors duration-150 ${
                tab === option ? 'bg-white text-[#0B1B3D] shadow-sm' : 'text-[#475569] [@media(hover:hover)]:hover:text-[#0B1B3D]'
              }`}
            >
              {option === 'upload' ? 'Upload' : 'Paste link'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'upload' ? (
        <div id={`${id}-upload`} role="tabpanel">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              if (!working) setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              if (!working) onFiles(e.dataTransfer.files)
            }}
            className={`relative overflow-hidden rounded-xl border-2 border-dashed transition-colors duration-150 ${
              dragging ? 'border-[#0038B8] bg-[#F0F7FF]' : 'border-[#CBD5E1] bg-[#F8FAFC]'
            }`}
          >
            {shown ? (
              <div className="relative aspect-[16/9] w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={shown} alt="" className="h-full w-full object-cover" />
                {working && <ProgressOverlay progress={state.progress} />}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={working}
                className="flex aspect-[16/9] min-h-12 w-full flex-col items-center justify-center gap-2 px-4 text-center text-[#475569] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#0038B8]"
              >
                {working ? (
                  <ProgressOverlay progress={state.progress} inline />
                ) : (
                  <>
                    <i className="fa-solid fa-cloud-arrow-up text-2xl text-[#0038B8]" aria-hidden="true" />
                    <span className="text-sm font-semibold text-[#0B1B3D]">Choose a photo or drop it here</span>
                    <span className="text-xs text-[#94A3B8]">Cropped to 16:9 from the centre · JPEG, PNG, WebP</span>
                  </>
                )}
              </button>
            )}
          </div>
          {shown && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={SECONDARY_BUTTON} disabled={working} onClick={() => inputRef.current?.click()}>
                <i className="fa-solid fa-arrows-rotate text-xs" aria-hidden="true" />
                Replace
              </button>
              <button
                type="button"
                className={SECONDARY_BUTTON}
                disabled={working}
                onClick={() => {
                  setPreview(null)
                  onChange('')
                }}
              >
                <i className="fa-solid fa-xmark text-xs" aria-hidden="true" />
                Remove
              </button>
            </div>
          )}
          {state.kind === 'error' && (
            <p role="alert" className="mt-2 text-xs font-medium text-[#B91C1C]">
              {state.message}
            </p>
          )}
          {value && !isUploadedUrl(value) && !preview && (
            <p className={ADMIN_HINT}>This offer uses a pasted link (see Paste link). Uploading replaces it.</p>
          )}
          <p className={ADMIN_HINT}>Saved with the offer. A replaced upload is deleted when you save.</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              onFiles(e.target.files)
              // Reset, so picking the same photo again still fires a change.
              e.target.value = ''
            }}
          />
        </div>
      ) : (
        <div id={`${id}-link`} role="tabpanel">
          {linkInput}
        </div>
      )}
    </div>
  )
}

function ProgressOverlay({ progress, inline = false }: { progress: number | null; inline?: boolean }) {
  const percent = progress === null ? null : Math.round(progress * 100)
  return (
    <div
      className={`${inline ? 'w-full max-w-xs' : 'absolute inset-0 flex items-end bg-[#0B1B3D]/35 p-4'}`}
      role="status"
      aria-live="polite"
    >
      <div className="w-full">
        <span className={`mb-1.5 block text-xs font-semibold ${inline ? 'text-[#0B1B3D]' : 'text-white'}`}>
          {percent === null ? 'Preparing image…' : `Uploading… ${percent}%`}
        </span>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/60">
          {/* Fills from the inline start, so it grows right-to-left in Hebrew. */}
          <div
            className="h-full rounded-full bg-[#0038B8] transition-[width] duration-200 ease-out motion-reduce:transition-none"
            style={{ width: `${percent ?? 8}%` }}
          />
        </div>
      </div>
    </div>
  )
}
