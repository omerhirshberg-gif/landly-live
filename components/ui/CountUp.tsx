'use client'

import { useEffect, useState } from 'react'
import { useInView } from '@/lib/useInView'

const DURATION_MS = 900

/** The number shown `progress` (0–1) of the way through a count to `value`: ease-out cubic, whole numbers, landing exactly on `value`. */
export function countUpFrame(value: number, progress: number): number {
  const p = Math.min(1, Math.max(0, progress))
  return p >= 1 ? value : Math.round(value * (1 - (1 - p) ** 3))
}

// A stat that counts up from 0 the first time it scrolls into view. The
// server render, a no-JS visit, reduced motion and anything already on
// screen at load all show the real number straight away. The final value,
// laid in the same grid cell but invisible, holds the width, so nothing moves
// while the digits change; screen readers get only the final value.
export default function CountUp({ value, format = String, className = '' }: { value: number; format?: (n: number) => string; className?: string }) {
  const [ref, inView] = useInView<HTMLSpanElement>({ once: true })
  const [shown, setShown] = useState(value)
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || value <= 0) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    if (el.getBoundingClientRect().top < window.innerHeight) return
    setArmed(true)
    setShown(0)
  }, [ref, value])

  useEffect(() => {
    if (!armed || !inView) return
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = (now - start) / DURATION_MS
      setShown(countUpFrame(value, progress))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [armed, inView, value])

  return (
    <span ref={ref} className={`inline-grid tabular-nums ${className}`}>
      <span aria-hidden="true" className="invisible col-start-1 row-start-1">{format(value)}</span>
      <span aria-hidden="true" className="col-start-1 row-start-1">{format(armed ? shown : value)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  )
}
