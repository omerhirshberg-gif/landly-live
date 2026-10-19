'use client'

import { useEffect, useRef, useState } from 'react'

// Whether an element is on screen, from one IntersectionObserver. `once`
// stops watching the first time it shows (a scroll reveal); without it the
// flag follows the element in and out (pausing the marquee off screen).
// Without IntersectionObserver it reports visible, so nothing stays hidden.
export function useInView<T extends Element>({ once = false, rootMargin = '0px' }: { once?: boolean; rootMargin?: string } = {}) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          if (once) observer.disconnect()
        } else if (!once) {
          setInView(false)
        }
      },
      { rootMargin },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [once, rootMargin])

  return [ref, inView] as const
}
