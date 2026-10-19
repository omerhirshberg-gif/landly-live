'use client'

import { useEffect, useRef, useState, type CSSProperties, type RefObject, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { fullSizeAvatarUrl } from '@/lib/avatar/avatar'
import { WEB_ZOOM_MAX, clampZoom, renderScale, touchDistance, zoomProgress } from '@/lib/avatar/zoom'
import { useLang } from '@/lib/i18n/useLang'

// The member's photo full size, Instagram style, in two ways:
//
// - Tapped or clicked (AvatarLightbox): a circle up to 360px across (80% of
//   the shorter screen edge on phones) over a frosted backdrop, in a native
//   <dialog> opened with showModal(), so it sits in the top layer above the
//   navbar, traps focus and closes on Esc; a tap on the backdrop closes it
//   too (the close button is there for keyboards and screen readers only,
//   shown on keyboard focus), and focus goes back to the avatar. The page
//   behind doesn't scroll meanwhile (iOS Safari scrolls it otherwise).
// - Long-pressed or click-and-held (useAvatarPeek): the same circle while the
//   finger or button stays down; letting go eases it back and it fades away.
//
// Either way two fingers pinch the whole circle up to 4.5×, freely past the
// screen's edges, and it follows them; one finger drags it; the wheel or a
// trackpad pinch (ctrl+wheel) grows it too. Letting go eases it back to
// rest, easing in without a bounce. The source is the full-resolution photo
// (fullSizeAvatarUrl).
export default function AvatarLightbox({ src, open, onClose }: { src: string; open: boolean; onClose: () => void }) {
  if (!open) return null
  return <LightboxDialog src={src} onClose={onClose} />
}

function LightboxDialog({ src, onClose }: { src: string; onClose: () => void }) {
  const { t } = useLang()
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!dialog.open) dialog.showModal()
    const root = document.documentElement
    const previousOverflow = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = previousOverflow
      if (dialog.open) dialog.close()
      opener?.focus({ preventScroll: true })
    }
  }, [])

  return (
    <dialog
      ref={ref}
      aria-label={t('avatar_viewer_title')}
      className="avatar-lightbox"
      // Esc: let React state close it, so the dialog and the state never disagree.
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      // The dialog fills the screen; a click that lands on it, not the photo, is the backdrop.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <button type="button" onClick={onClose} className="avatar-lightbox-close">
        {t('avatar_viewer_close')}
      </button>
      <ExpandingPhoto src={fullSizeAvatarUrl(src)} alt={t('avatar_viewer_title')} />
    </dialog>
  )
}

/** A long press this long opens the peek… */
const PEEK_DELAY_MS = 180
/** …unless the finger moved this far first (it's a scroll). */
const PEEK_SLOP = 10
/** The ease back's length; the peek is removed once it's done. */
const SNAP_MS = 320
/** The wheel or a trackpad pinch eases back once it's been still this long. */
const WHEEL_SETTLE_MS = 180

/**
 * Long-press (touch) or click-and-hold (mouse) peek for an avatar button:
 * spread `trigger` on the button and render `layer`. The press that opens it
 * doesn't also count as a click, so the button's own onClick (opening the
 * lightbox) only answers short taps.
 */
export function useAvatarPeek(src: string | null) {
  const [peeking, setPeeking] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const start = useRef<{ x: number; y: number } | null>(null)
  const swallowClick = useRef(false)
  // Whether the press that opened the peek is still down: one let go before
  // the layer mounted would never reach its listeners.
  const held = useRef(false)
  // Ends a mouse peek (a touch peek ends when its last finger lifts, which the layer hears).
  const release = useRef<(() => void) | null>(null)

  const cancelTimer = () => {
    clearTimeout(timer.current)
    timer.current = undefined
    start.current = null
  }

  useEffect(() => () => clearTimeout(timer.current), [])

  const trigger = {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      swallowClick.current = false
      if (!src || (e.pointerType === 'mouse' && e.button !== 0)) return
      held.current = true
      start.current = { x: e.clientX, y: e.clientY }
      timer.current = setTimeout(() => {
        timer.current = undefined
        swallowClick.current = true
        setPeeking(true)
      }, PEEK_DELAY_MS)
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      if (timer.current && start.current && touchDistance(start.current, { x: e.clientX, y: e.clientY }) > PEEK_SLOP) cancelTimer()
    },
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => {
      held.current = false
      cancelTimer()
      if (e.pointerType !== 'touch') release.current?.()
    },
    // The browser took the touch for a scroll.
    onPointerCancel: () => {
      held.current = false
      cancelTimer()
    },
    onClickCapture: (e: ReactMouseEvent<HTMLElement>) => {
      if (!swallowClick.current) return
      swallowClick.current = false
      e.preventDefault()
      e.stopPropagation()
    },
    // Android Chrome opens the context menu on a long press.
    onContextMenu: (e: ReactMouseEvent<HTMLElement>) => {
      if (timer.current || peeking) e.preventDefault()
    },
  }

  const layer =
    peeking && src && typeof document !== 'undefined'
      ? createPortal(<PeekLayer src={src} held={held} release={release} onDone={() => setPeeking(false)} />, document.body)
      : null

  return { trigger, layer }
}

// The held preview, outside any <dialog> so the page isn't made inert under
// the finger that's still pressing the avatar. Decorative: the tap-opened
// lightbox is the accessible way to the photo.
function PeekLayer({
  src,
  held,
  release,
  onDone,
}: {
  src: string
  held: RefObject<boolean>
  release: RefObject<(() => void) | null>
  onDone: () => void
}) {
  const [closing, setClosing] = useState(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    if (!closing) return
    const done = setTimeout(() => onDoneRef.current(), SNAP_MS + 20)
    return () => clearTimeout(done)
  }, [closing])

  const close = () => setClosing(true)
  useEffect(() => {
    if (!held.current) setClosing(true)
    release.current = () => setClosing(true)
    return () => {
      release.current = null
    }
  }, [held, release])

  return (
    // A tap on it ends a peek that missed its release (the browser cancelled the touch).
    <div aria-hidden="true" className={`avatar-peek${closing ? ' is-closing' : ''}`} onClick={close}>
      <ExpandingPhoto src={fullSizeAvatarUrl(src)} alt="" onRelease={close} releaseOnMouseUp resting={closing} />
    </div>
  )
}

type Point = { x: number; y: number }
type View = { scale: number; x: number; y: number }
/** live follows the fingers with no transition; settle eases back to rest without overshoot. */
type Motion = 'live' | 'settle'

const REST: View = { scale: 1, x: 0, y: 0 }

// The circle's resting diameter: 80% of the shorter screen edge, at most 360px.
function restingSide() {
  if (typeof window === 'undefined') return 0
  return Math.min(window.innerWidth * 0.8, window.innerHeight * 0.8, 360)
}

const centre = (touches: TouchList): Point => {
  let x = 0
  let y = 0
  for (const touch of Array.from(touches)) {
    x += touch.clientX
    y += touch.clientY
  }
  return { x: x / touches.length, y: y / touches.length }
}

const spread = (touches: TouchList) =>
  touchDistance({ x: touches[0].clientX, y: touches[0].clientY }, { x: touches[1].clientX, y: touches[1].clientY })

// The photo's circle and its gestures, on the document's touch events so
// fingers anywhere count, the one already holding the avatar included:
// scale = current finger distance / starting distance (1×–4.5×, no screen
// bounds), moved by the fingers' midpoint; with one finger, a drag. When
// the last finger lifts it eases back (320ms, decelerating, no overshoot) and
// `onRelease` fires. The circle is laid out larger than it rests
// (renderScale) and scaled down, so it's rasterised with every pixel the
// 1024px photo has and stays sharp, will-change and all, however far it
// grows.
function ExpandingPhoto({
  src,
  alt,
  onRelease,
  releaseOnMouseUp = false,
  resting = false,
}: {
  src: string
  alt: string
  onRelease?: () => void
  /** The peek: a mouse button let go anywhere ends it. */
  releaseOnMouseUp?: boolean
  /** Ease to rest and stay there (the peek while it fades). */
  resting?: boolean
}) {
  const [side, setSide] = useState(restingSide)
  const [pixelRatio, setPixelRatio] = useState(() => (typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1))
  const [view, setViewState] = useState<View>(REST)
  const [motion, setMotion] = useState<Motion>('live')
  // Gesture listeners read the latest values without waiting for a render.
  const viewRef = useRef<View>(REST)
  const releaseRef = useRef(onRelease)
  releaseRef.current = onRelease
  const restingRef = useRef(resting)
  restingRef.current = resting

  const setView = (next: View, nextMotion: Motion) => {
    viewRef.current = next
    setMotion(nextMotion)
    setViewState(next)
  }

  useEffect(() => {
    if (resting) setView(REST, 'settle')
  }, [resting])

  useEffect(() => {
    const onResize = () => {
      setSide(restingSide())
      setPixelRatio(window.devicePixelRatio || 1)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    let pinch: { distance: number; mid: Point; from: View } | null = null
    let drag: { start: Point; from: View } | null = null
    let settle: ReturnType<typeof setTimeout> | undefined

    // A finger landed or lifted: carry on from where the circle is now.
    const rebase = (touches: TouchList) => {
      const from = viewRef.current
      pinch = touches.length >= 2 ? { distance: Math.max(1, spread(touches)), mid: centre(touches), from } : null
      drag = touches.length === 1 ? { start: centre(touches), from } : null
    }
    const settleBack = () => {
      pinch = null
      drag = null
      setView(REST, 'settle')
      releaseRef.current?.()
    }

    const onTouchStart = (e: TouchEvent) => {
      if (!restingRef.current) rebase(e.touches)
    }
    const onTouchMove = (e: TouchEvent) => {
      // Keeps the browser from zooming or scrolling the page under the gesture.
      if (e.cancelable) e.preventDefault()
      if (restingRef.current) return
      if (!pinch && !drag) rebase(e.touches)
      if (pinch && e.touches.length >= 2) {
        const mid = centre(e.touches)
        const scale = clampZoom(pinch.from.scale * (spread(e.touches) / pinch.distance), WEB_ZOOM_MAX)
        setView({ scale, x: pinch.from.x + mid.x - pinch.mid.x, y: pinch.from.y + mid.y - pinch.mid.y }, 'live')
      } else if (drag && e.touches.length === 1) {
        const at = centre(e.touches)
        setView({ scale: drag.from.scale, x: drag.from.x + at.x - drag.start.x, y: drag.from.y + at.y - drag.start.y }, 'live')
      }
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) settleBack()
      else rebase(e.touches)
    }
    // React's wheel listener is passive, so it can't stop the page from zooming (ctrl+wheel) or scrolling.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (restingRef.current) return
      const delta = e.deltaY * (e.deltaMode === 1 ? 16 : 1)
      // A trackpad pinch arrives as ctrl+wheel with small deltas: more sensitive than a mouse wheel.
      const factor = Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0015))
      const current = viewRef.current
      setView({ ...current, scale: clampZoom(current.scale * factor, WEB_ZOOM_MAX) }, 'live')
      clearTimeout(settle)
      // Held with the mouse, the peek waits for the button instead.
      if (!releaseOnMouseUp) settle = setTimeout(() => setView(REST, 'settle'), WHEEL_SETTLE_MS)
    }
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') settleBack()
    }

    const active = { passive: false } as const
    document.addEventListener('touchstart', onTouchStart, active)
    document.addEventListener('touchmove', onTouchMove, active)
    document.addEventListener('touchend', onTouchEnd)
    document.addEventListener('touchcancel', onTouchEnd)
    document.addEventListener('wheel', onWheel, active)
    if (releaseOnMouseUp) document.addEventListener('pointerup', onPointerUp)
    return () => {
      clearTimeout(settle)
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchEnd)
      document.removeEventListener('wheel', onWheel)
      document.removeEventListener('pointerup', onPointerUp)
    }
  }, [releaseOnMouseUp])

  const render = renderScale(side, pixelRatio, WEB_ZOOM_MAX)
  const laidOut = side * render

  return (
    <>
      {/* Deepens behind the circle as it grows. */}
      <div aria-hidden="true" className={`avatar-lightbox-dim is-${motion}`} style={{ opacity: zoomProgress(view.scale, WEB_ZOOM_MAX) }} />
      {/* Carries the opening pop, so it never fights the gesture's transform. */}
      <div className="avatar-lightbox-pop" style={{ width: side, height: side }}>
        <div
          className={`avatar-lightbox-frame is-${motion}`}
          style={
            {
              width: laidOut,
              height: laidOut,
              transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale / render})`,
              // The ring and halo are drawn at the laid-out size, so they read 2px / 8px at rest.
              '--avatar-render': render,
            } as CSSProperties
          }
        >
          {/* Storage and Google photo URLs; no-referrer keeps Google's CDN from refusing it. */}
          <img src={src} alt={alt} referrerPolicy="no-referrer" decoding="async" draggable={false} className="avatar-lightbox-img" />
        </div>
      </div>
    </>
  )
}
