'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Eraser } from 'lucide-react'

// A signature pad that works the same with a mouse, a finger or a stylus
// (Pointer Events: iOS Safari 13+, Android Chrome, Firefox, Edge, in-app
// webviews), sharp on any pixel density, and unaffected by page direction.
//
//  - Strokes are stored as fractions of the box, so resizing, rotating a phone
//    or opening the keyboard redraws the same signature at the new size.
//  - Positions come from getBoundingClientRect, never offsetX: in a right-to-left
//    page the pad is still a left-to-right pixel grid (dir="ltr" on it), so ink
//    lands under the finger. Nothing is mirrored.
//  - touch-action: none keeps the page from scrolling while signing.
//  - The pad reports a PNG (transparent, dark ink) after every stroke, and null
//    once cleared or empty.
type Point = { x: number; y: number }

const INK = '#0b1b3d'

export default function SignatureCanvas({
  onChange, label, clearLabel, hint, invalid = false, describedBy,
}: {
  onChange: (png: Blob | null) => void
  label: string
  clearLabel: string
  hint: string
  invalid?: boolean
  describedBy?: string
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const strokes = useRef<Point[][]>([])
  const active = useRef<number | null>(null)
  const [empty, setEmpty] = useState(true)

  const paint = useCallback(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const { width, height } = el.getBoundingClientRect()
    const dpr = el.width / Math.max(width, 1)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    ctx.strokeStyle = INK
    ctx.fillStyle = INK
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const stroke of strokes.current) {
      const pts = stroke.map((p) => ({ x: p.x * width, y: p.y * height }))
      if (pts.length === 1) {
        ctx.beginPath()
        ctx.arc(pts[0]!.x, pts[0]!.y, 1.4, 0, Math.PI * 2)
        ctx.fill()
        continue
      }
      ctx.beginPath()
      ctx.moveTo(pts[0]!.x, pts[0]!.y)
      for (let i = 1; i < pts.length - 1; i++) {
        const mid = { x: (pts[i]!.x + pts[i + 1]!.x) / 2, y: (pts[i]!.y + pts[i + 1]!.y) / 2 }
        ctx.quadraticCurveTo(pts[i]!.x, pts[i]!.y, mid.x, mid.y)
      }
      ctx.lineTo(pts[pts.length - 1]!.x, pts[pts.length - 1]!.y)
      ctx.stroke()
    }
  }, [])

  // Match the bitmap to the box at the device's pixel density, and redraw.
  useEffect(() => {
    const el = canvas.current
    const box = wrap.current
    if (!el || !box) return
    const fit = () => {
      const { width, height } = box.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 3)
      el.width = Math.max(1, Math.round(width * dpr))
      el.height = Math.max(1, Math.round(height * dpr))
      paint()
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(box)
    return () => observer.disconnect()
  }, [paint])

  const toPoint = (e: React.PointerEvent | PointerEvent): Point => {
    const rect = canvas.current!.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)), y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)) }
  }

  const report = () => {
    const has = strokes.current.length > 0
    setEmpty(!has)
    if (!has) return onChange(null)
    canvas.current?.toBlob((blob) => onChange(blob), 'image/png')
  }

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault()
    canvas.current?.setPointerCapture(e.pointerId)
    active.current = e.pointerId
    strokes.current.push([toPoint(e)])
    paint()
  }
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (active.current !== e.pointerId) return
    const stroke = strokes.current[strokes.current.length - 1]
    if (!stroke) return
    // Coalesced events keep fast strokes smooth where the browser batches them.
    const native = e.nativeEvent
    const events = typeof native.getCoalescedEvents === 'function' && native.getCoalescedEvents().length ? native.getCoalescedEvents() : [native]
    for (const ev of events) stroke.push(toPoint(ev))
    paint()
  }
  const up = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (active.current !== e.pointerId) return
    active.current = null
    if (canvas.current?.hasPointerCapture(e.pointerId)) canvas.current.releasePointerCapture(e.pointerId)
    report()
  }

  const clear = () => {
    strokes.current = []
    paint()
    report()
  }

  return (
    <div>
      <div
        ref={wrap}
        dir="ltr"
        className={`relative h-44 w-full overflow-hidden rounded-2xl border bg-white shadow-[inset_0_1px_2px_rgb(0,0,0,0.04)] transition-shadow focus-within:ring-4 focus-within:ring-brand/15 sm:h-52 ${invalid ? 'border-red-400' : 'border-slate-200'}`}
      >
        <canvas
          ref={canvas}
          role="img"
          aria-label={label}
          aria-describedby={describedBy}
          className="absolute inset-0 h-full w-full cursor-crosshair select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none]"
          style={{ touchAction: 'none' }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onContextMenu={(e) => e.preventDefault()}
        />
        {empty && (
          <>
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-6 bottom-12 border-b border-dashed border-slate-300" />
            <p aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-sm text-slate-400">{hint}</p>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={clear}
        disabled={empty}
        className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-slate-600 transition-colors hover:text-brand disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
      >
        <Eraser aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
        {clearLabel}
      </button>
    </div>
  )
}
