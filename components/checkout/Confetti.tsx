'use client'

import { useEffect, useRef, useState } from 'react'

const COLORS = ['#0038B8', '#2563EB', '#10B981', '#F59E0B', '#EC4899', '#FACC15']
const DURATION_MS = 3500
const COUNT = 140

interface Piece {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  rotation: number
  spin: number
  color: string
  wide: boolean
}

// One celebratory burst for the order confirmation (app/order-success): a
// full-window canvas over the page that ignores the pointer, fires paper
// pieces up from the lower centre, lets them fall and fade, then removes
// itself after 3.5s. No library, no listeners left behind. Skipped entirely
// under prefers-reduced-motion. The Expo app's counterpart is
// landly-mobile/src/components/Confetti.tsx.
export default function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDone(true)
      return
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const width = window.innerWidth
    const height = window.innerHeight
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    const pieces: Piece[] = Array.from({ length: COUNT }, () => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6
      const speed = 9 + Math.random() * 9
      return {
        x: width / 2 + (Math.random() - 0.5) * width * 0.3,
        y: height * 0.75,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 6 + Math.random() * 6,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.3,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        wide: Math.random() > 0.5,
      }
    })

    const start = performance.now()
    let frame = requestAnimationFrame(function draw(now) {
      const elapsed = now - start
      ctx.clearRect(0, 0, width, height)
      // Fade over the last second.
      ctx.globalAlpha = Math.max(0, Math.min(1, (DURATION_MS - elapsed) / 1000))
      for (const p of pieces) {
        p.vy += 0.32
        p.vx *= 0.985
        p.vy *= 0.985
        p.x += p.vx
        p.y += p.vy
        p.rotation += p.spin
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size * (p.wide ? 1.4 : 0.8), p.size / 2)
        ctx.restore()
      }
      if (elapsed < DURATION_MS) frame = requestAnimationFrame(draw)
      else setDone(true)
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  if (done) return null
  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 h-dvh w-screen" />
}
