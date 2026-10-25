'use client'

import { useEffect, useRef, useState } from 'react'

const ZOOM_STEPS = [1, 1.5, 2, 3, 4]

const ICON_BUTTON =
  'flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white [-webkit-tap-highlight-color:transparent]'

/**
 * A photo full screen, in a modal <dialog> (focus held inside, Esc closes):
 * zoom in steps, rotate a quarter turn, download, close. A click outside
 * the photo closes it too; + / - zoom and R rotates from the keyboard.
 */
export default function MediaLightbox({ src, downloadUrl, alt, onClose }: { src: string; downloadUrl?: string; alt: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [zoom, setZoom] = useState(0)
  const [turns, setTurns] = useState(0)

  useEffect(() => {
    const dialog = ref.current
    // Leaving the page removes the dialog, and its modal state with it; closing here would fire onClose.
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const zoomBy = (step: number) => setZoom((z) => Math.min(ZOOM_STEPS.length - 1, Math.max(0, z + step)))
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === '+' || event.key === '=') zoomBy(1)
    else if (event.key === '-') zoomBy(-1)
    else if (event.key === 'r' || event.key === 'R') setTurns((t) => t + 1)
    else return
    event.preventDefault()
  }

  return (
    <dialog
      ref={ref}
      aria-label={alt}
      onClose={onClose}
      onKeyDown={onKeyDown}
      onClick={(event) => {
        if (event.target === event.currentTarget) ref.current?.close()
      }}
      className="fixed inset-0 m-0 h-[var(--app-dvh)] max-h-none w-screen max-w-none overflow-hidden bg-black/90 p-0 backdrop:bg-black/60"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-end gap-1 bg-gradient-to-b from-black/60 to-transparent p-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto flex gap-1">
          <button type="button" className={ICON_BUTTON} onClick={() => zoomBy(-1)} disabled={zoom === 0} aria-label="Zoom out">
            <i className="fa-solid fa-magnifying-glass-minus" aria-hidden="true" />
          </button>
          <button type="button" className={ICON_BUTTON} onClick={() => zoomBy(1)} disabled={zoom === ZOOM_STEPS.length - 1} aria-label="Zoom in">
            <i className="fa-solid fa-magnifying-glass-plus" aria-hidden="true" />
          </button>
          <button type="button" className={ICON_BUTTON} onClick={() => setTurns((t) => t + 1)} aria-label="Rotate">
            <i className="fa-solid fa-rotate-right" aria-hidden="true" />
          </button>
          {downloadUrl && (
            <a href={downloadUrl} className={ICON_BUTTON} aria-label="Download photo">
              <i className="fa-solid fa-download" aria-hidden="true" />
            </a>
          )}
          <button type="button" className={ICON_BUTTON} onClick={() => ref.current?.close()} aria-label="Close" autoFocus>
            <i className="fa-solid fa-xmark text-lg" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div
        className="flex h-full w-full items-center justify-center overflow-auto p-4"
        onClick={(event) => {
          if (event.target === event.currentTarget) ref.current?.close()
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a signed Storage URL, shown as is */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          style={{ transform: `scale(${ZOOM_STEPS[zoom]}) rotate(${turns * 90}deg)` }}
          className="max-h-full max-w-full select-none object-contain transition-transform duration-200 ease-out motion-reduce:transition-none"
        />
      </div>
    </dialog>
  )
}
