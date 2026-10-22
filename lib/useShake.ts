'use client'

import { useEffect, type RefObject } from 'react'

// A short side-to-side shake for a field that failed validation on submit:
// each increase of `trigger` plays it once, and only while `active` (the
// field has an error). It animates the `translate` property, not
// `transform`, so it composes with a field's focus zoom instead of
// cancelling it. Skipped under reduced motion; the red outline and the
// message still say what's wrong.
export function useShake(ref: RefObject<HTMLElement | null>, trigger: number, active: boolean) {
  useEffect(() => {
    if (!trigger || !active) return
    const el = ref.current
    if (!el || typeof el.animate !== 'function') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    el.animate(
      [{ translate: '0 0' }, { translate: '-6px 0' }, { translate: '6px 0' }, { translate: '-4px 0' }, { translate: '4px 0' }, { translate: '0 0' }],
      { duration: 320, easing: 'ease-out' }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- plays once per trigger
  }, [trigger])
}
