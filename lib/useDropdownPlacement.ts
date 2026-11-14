import { useCallback, useLayoutEffect, useState, type RefObject } from 'react'

// Where an absolutely-positioned list under a field should open: below it, or above it when the space below is taken
// by a sticky bottom bar (the admin forms' StickyActionBar, found by [data-sticky-actions]) or by the viewport edge.
// Re-measured each time the list opens and while the window resizes or scrolls. `maxHeight` caps the list to the room
// it has, so it scrolls inside itself instead of being sliced.
const GAP = 12
const MIN_LIST = 144

export function useDropdownPlacement(anchor: RefObject<HTMLElement | null>, open: boolean, preferred = 288) {
  const [placement, setPlacement] = useState<{ up: boolean; maxHeight: number }>({ up: false, maxHeight: preferred })

  const measure = useCallback(() => {
    const el = anchor.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const bar = document.querySelector<HTMLElement>('[data-sticky-actions]')
    const barTop = bar ? bar.getBoundingClientRect().top : window.innerHeight
    const floor = Math.min(window.innerHeight, barTop > rect.top ? barTop : window.innerHeight)
    const below = floor - rect.bottom - GAP
    const above = rect.top - GAP
    const up = below < Math.min(preferred, MIN_LIST + 48) && above > below
    setPlacement({ up, maxHeight: Math.max(MIN_LIST, Math.min(preferred, up ? above : below)) })
  }, [anchor, preferred])

  useLayoutEffect(() => {
    if (!open) return
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, measure])

  return placement
}
