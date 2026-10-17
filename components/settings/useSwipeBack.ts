'use client'

import { useEffect, useRef } from 'react'
import { isEdgeStart, shouldCommitSwipe, swipeAxis, swipeSign } from '@/lib/navigation/settingsBack'

const TURN_MS = 260
const SETTLE_MS = 320
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)'
// Navigation normally replaces the page well before this; if it doesn't, the page comes back.
const RESTORE_MS = 1200

// The settings pages' "turn back a page" swipe on touch screens (the app's
// settings stack does the same natively, landly-mobile/src/lib/pageFlip.ts).
// A finger dragged toward back (right in left-to-right languages, left in
// Hebrew) pulls the page along with a shadow on its leading edge; let go past
// a third of the width, or with a flick, and it slides away and `onBack`
// runs; otherwise it springs back.
//
// What it leaves alone:
// - the outer 24px on each side, where iOS Safari's edge swipe and Android's
//   back gesture start, so one swipe never goes back twice;
// - vertical scrolling: the element gets touch-action: pan-y pinch-zoom, so
//   the browser scrolls and zooms natively and a vertical start cancels the
//   swipe (pointercancel);
// - text fields and anything inside [data-swipe-ignore] or a sideways
//   scroller;
// - mouse and pen: touch only, so desktop browsers never see it.
// With reduced motion the page doesn't move; a completed swipe just goes back.
export function useSwipeBack<T extends HTMLElement>(onBack: () => void, isRtl: boolean) {
  const ref = useRef<T>(null)
  const onBackRef = useRef(onBack)
  useEffect(() => {
    onBackRef.current = onBack
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const sign = swipeSign(isRtl)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let start: { x: number; y: number; id: number } | null = null
    let axis: 'back' | 'other' | null = null
    let distance = 0
    let last = { x: 0, t: 0 }
    let velocity = 0
    let suppressClick = false
    let timer: number | undefined

    el.style.touchAction = 'pan-y pinch-zoom'

    const place = (offset: number, ms = 0) => {
      el.style.transition = ms ? `transform ${ms}ms ${EASE_OUT}, box-shadow ${ms}ms ${EASE_OUT}` : 'none'
      el.style.transform = offset ? `translate3d(${offset * sign}px, 0, 0)` : ''
      el.style.boxShadow = offset ? `${-sign * 12}px 0 28px -10px rgba(11, 27, 61, 0.28)` : ''
      el.style.willChange = offset ? 'transform' : ''
    }

    const ignored = (target: EventTarget | null) => {
      for (let node = target instanceof Element ? target : null; node && node !== el; node = node.parentElement) {
        if (node.matches('input, textarea, select, [contenteditable="true"], [data-swipe-ignore]')) return true
        const { overflowX } = getComputedStyle(node)
        if ((overflowX === 'auto' || overflowX === 'scroll') && node.scrollWidth > node.clientWidth) return true
      }
      return false
    }

    const reset = () => {
      start = null
      axis = null
      distance = 0
      velocity = 0
    }

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || !e.isPrimary || start) return
      if (isEdgeStart(e.clientX, window.innerWidth) || ignored(e.target)) return
      window.clearTimeout(timer)
      start = { x: e.clientX, y: e.clientY, id: e.pointerId }
      last = { x: e.clientX, t: e.timeStamp }
    }

    const onMove = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return
      if (!axis) {
        axis = swipeAxis(e.clientX - start.x, e.clientY - start.y, isRtl)
        if (axis === 'back') el.setPointerCapture?.(e.pointerId)
      }
      if (axis !== 'back') return
      distance = Math.max(0, (e.clientX - start.x) * sign)
      const dt = e.timeStamp - last.t
      if (dt > 0) velocity = ((e.clientX - last.x) * sign) / dt
      last = { x: e.clientX, t: e.timeStamp }
      if (!reduced.matches) place(distance)
    }

    const onUp = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return
      if (axis === 'back') {
        suppressClick = true
        const width = window.innerWidth
        if (shouldCommitSwipe(distance, width, velocity)) {
          if (reduced.matches) onBackRef.current()
          else {
            place(width, TURN_MS)
            timer = window.setTimeout(() => {
              onBackRef.current()
              timer = window.setTimeout(() => place(0), RESTORE_MS)
            }, TURN_MS)
          }
        } else {
          place(0, SETTLE_MS)
        }
      }
      reset()
    }

    const onCancel = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return
      if (axis === 'back') place(0, SETTLE_MS)
      reset()
    }

    // A drag that ends over a row mustn't also tap it.
    const onClick = (e: MouseEvent) => {
      if (!suppressClick) return
      suppressClick = false
      e.preventDefault()
      e.stopPropagation()
    }
    const onStart = () => {
      suppressClick = false
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onCancel)
    el.addEventListener('click', onClick, true)
    el.addEventListener('touchstart', onStart, { passive: true })
    return () => {
      window.clearTimeout(timer)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onCancel)
      el.removeEventListener('click', onClick, true)
      el.removeEventListener('touchstart', onStart)
      place(0)
      el.style.touchAction = ''
    }
  }, [isRtl])

  return ref
}
