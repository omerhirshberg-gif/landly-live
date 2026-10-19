'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useInView } from '@/lib/useInView'

// A guest-home section (or card) that fades in and rises 12px the first time
// it scrolls into view (.reveal in globals.css). Visible by default: it only
// hides itself after mount, and only when it starts below the fold, so the
// server render, a no-JS visit and anything already on screen never blink.
// Reduced motion keeps the fade and drops the rise.
export default function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const [ref, inView] = useInView<HTMLDivElement>({ once: true, rootMargin: '0px 0px -10% 0px' })
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (el && typeof IntersectionObserver !== 'undefined' && el.getBoundingClientRect().top > window.innerHeight) setArmed(true)
  }, [ref])

  const state = !armed ? 'idle' : inView ? 'shown' : 'armed'
  return (
    <div ref={ref} data-reveal={state} className={`reveal ${className}`} style={delay ? ({ '--reveal-delay': `${delay}ms` } as CSSProperties) : undefined}>
      {children}
    </div>
  )
}
