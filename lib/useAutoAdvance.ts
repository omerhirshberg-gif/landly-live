'use client'

import { useEffect, useRef, type RefObject } from 'react'
import { AUTO_ADVANCE_MS, nextAutoIndex } from './carouselAutoplay'

// Brings a scroll-snap row's next card into view every 5 seconds (AUTO_ADVANCE_MS),
// then the first again after the last. `active` and `scrollTo` come from
// useSnapIndex, so the dots follow the same index whether the row moved by itself
// or by hand, in Hebrew too (the cards' own boxes are measured, not scrollLeft).
// It holds still, and restarts the full 5 seconds when it lets go, for:
//  - a finger or pen on the row (touchstart/pointerdown until it lifts), then a
//    moment for the momentum to settle;
//  - a real mouse over it (pointerenter/leave, only where the device hovers);
//  - keyboard focus inside it (focusin/focusout), so a card being tabbed to stays put;
//  - Reduce Motion (no timer at all, and it follows a change of the setting);
//  - a hidden tab, or the row scrolled out of view (scrollIntoView would drag the page to it);
//  - a row with nowhere to scroll.
// The timer is cleared on every change and on unmount.
export function useAutoAdvance({
  rowRef,
  count,
  active,
  scrollTo,
  enabled = true,
  offsetMs = 0,
}: {
  rowRef: RefObject<HTMLElement | null>
  count: number
  active: number
  scrollTo: (index: number) => void
  enabled?: boolean
  /** Added to the first wait, so two rails on one page never move on the same beat. */
  offsetMs?: number
}) {
  const activeRef = useRef(active)
  const scrollToRef = useRef(scrollTo)
  useEffect(() => {
    activeRef.current = active
    scrollToRef.current = scrollTo
  })

  useEffect(() => {
    const row = rowRef.current
    const zone = row?.parentElement ?? row
    if (!enabled || !row || !zone || count < 2) return

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const hovers = window.matchMedia('(hover: hover)')
    const held = { touch: false, hover: false, focus: false, hidden: document.hidden, offscreen: false, settling: false }
    let timer: ReturnType<typeof setInterval> | undefined
    let first: ReturnType<typeof setTimeout> | undefined
    let settle: ReturnType<typeof setTimeout> | undefined

    const stop = () => {
      if (timer) clearInterval(timer)
      clearTimeout(first)
      timer = undefined
    }
    const tick = () => {
      if (row.scrollWidth - row.clientWidth <= 1) return
      scrollToRef.current(nextAutoIndex(activeRef.current, count))
    }
    // (Re)starts the whole interval when nothing holds the row, else stops it.
    const sync = () => {
      stop()
      if (motion.matches || held.touch || held.hover || held.focus || held.hidden || held.offscreen || held.settling) return
      first = setTimeout(() => {
        tick()
        timer = setInterval(tick, AUTO_ADVANCE_MS)
      }, AUTO_ADVANCE_MS + offsetMs)
    }
    const set = (key: 'touch' | 'hover' | 'focus', value: boolean) => () => {
      held[key] = value
      sync()
    }
    // After a finger lifts, the momentum and the snap settle before the countdown starts.
    const lift = () => {
      held.touch = false
      held.settling = true
      sync()
      clearTimeout(settle)
      settle = setTimeout(() => {
        held.settling = false
        sync()
      }, 600)
    }
    const press = () => {
      clearTimeout(settle)
      held.settling = false
      held.touch = true
      sync()
    }
    const enter = () => {
      if (hovers.matches) set('hover', true)()
    }
    const leave = set('hover', false)
    const focusIn = set('focus', true)
    const focusOut = (e: FocusEvent) => {
      if (!zone.contains(e.relatedTarget as Node | null)) set('focus', false)()
    }
    const visibility = () => {
      held.hidden = document.hidden
      sync()
    }
    const observer = new IntersectionObserver(([entry]) => {
      held.offscreen = !entry.isIntersecting
      sync()
    }, { threshold: 0.5 })
    observer.observe(row)

    zone.addEventListener('touchstart', press, { passive: true })
    zone.addEventListener('touchend', lift, { passive: true })
    zone.addEventListener('touchcancel', lift, { passive: true })
    zone.addEventListener('pointerenter', enter)
    zone.addEventListener('pointerleave', leave)
    zone.addEventListener('focusin', focusIn)
    zone.addEventListener('focusout', focusOut)
    document.addEventListener('visibilitychange', visibility)
    motion.addEventListener('change', sync)
    sync()

    return () => {
      stop()
      clearTimeout(settle)
      observer.disconnect()
      zone.removeEventListener('touchstart', press)
      zone.removeEventListener('touchend', lift)
      zone.removeEventListener('touchcancel', lift)
      zone.removeEventListener('pointerenter', enter)
      zone.removeEventListener('pointerleave', leave)
      zone.removeEventListener('focusin', focusIn)
      zone.removeEventListener('focusout', focusOut)
      document.removeEventListener('visibilitychange', visibility)
      motion.removeEventListener('change', sync)
    }
  }, [rowRef, count, enabled, offsetMs])
}
