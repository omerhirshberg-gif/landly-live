'use client'

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

const GAP = 8
const EDGE = 8

export interface PanelPlacement {
  top: number
  left: number
  width: number
  maxHeight: number
}

/**
 * Where a panel of `width` goes under an anchor: its end edge on the anchor's, then clamped inside the viewport.
 * Every number is a whole pixel: a panel on a fractional offset is rasterised on sub-pixels and its text goes soft.
 * Pure, so tests can pin it.
 */
export function placePanel(
  anchor: { top: number; bottom: number; left: number; right: number },
  viewport: { width: number; height: number },
  want: { width: number; maxHeight: number },
  rtl: boolean
): PanelPlacement {
  const width = Math.round(Math.min(want.width, viewport.width - EDGE * 2))
  const wanted = rtl ? anchor.left : anchor.right - width
  const left = Math.round(Math.max(EDGE, Math.min(wanted, viewport.width - width - EDGE)))
  const top = Math.round(anchor.bottom + GAP)
  const maxHeight = Math.max(160, Math.round(Math.min(want.maxHeight, viewport.height - top - EDGE)))
  return { top, left, width, maxHeight }
}

interface Props {
  open: boolean
  onClose: (returnFocus: boolean) => void
  anchorRef: RefObject<HTMLElement | null>
  width: number
  maxHeight?: number
  dir: 'ltr' | 'rtl'
  role: 'menu' | 'dialog'
  label: string
  id?: string
  className?: string
  children: ReactNode
}

// A dropdown panel rendered in <body> rather than inside the navbar. The bar is
// frosted (backdrop-filter), and text inside a backdrop-filtered ancestor is
// composited on fractional offsets and renders soft in Chrome and Safari; out
// here it is plain, pixel-aligned content. Opacity-only entrance (no scale or
// fractional translate). Outside press and Escape close it; Escape returns
// focus to the trigger. `rtl` pins it to the anchor's start edge in Hebrew.
export default function AnchoredPanel({ open, onClose, anchorRef, width, maxHeight = 480, dir, role, label, id, className = '', children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState<PanelPlacement | null>(null)

  useLayoutEffect(() => {
    if (!open) {
      setPlace(null)
      return
    }
    const measure = () => {
      const anchor = anchorRef.current?.getBoundingClientRect()
      if (!anchor) return
      setPlace(placePanel(anchor, { width: window.innerWidth, height: window.innerHeight }, { width, maxHeight }, false))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open, anchorRef, width, maxHeight])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!panelRef.current?.contains(target) && !anchorRef.current?.contains(target)) onClose(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose(true)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, anchorRef, onClose])

  if (!open || typeof document === 'undefined') return null
  const style: CSSProperties = place
    ? { top: place.top, left: place.left, width: place.width, maxHeight: place.maxHeight }
    : { top: 0, left: 0, width, visibility: 'hidden' }
  return createPortal(
    <div
      ref={panelRef}
      id={id}
      dir={dir}
      role={role}
      aria-label={label}
      aria-modal={role === 'dialog' ? false : undefined}
      style={style}
      className={`landly-panel fixed z-[1001] overflow-y-auto overscroll-contain rounded-2xl border border-[#E2E8F0] bg-white antialiased shadow-[0_12px_32px_-8px_rgba(11,27,61,0.12)] ${className}`}
    >
      {children}
    </div>,
    document.body
  )
}
